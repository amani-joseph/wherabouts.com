# SDK Phase 2 — API-side DX — Design Sketch

**Date:** 2026-06-08
**Status:** Sketch (pre-plan) — enough to schedule alongside Phase 1.
**Source analysis:** `docs/sdk-dx-analysis-and-plan-2026-06.md` §5 "Phase 2".
**Companion:** `docs/superpowers/plans/2026-06-08-sdk-phase1-publish-and-harden.md`.

**Goal:** Make the API *debuggable, resilient, and safe to retry* — the server side of the same coin
as Phase 1. Three workstreams: **(1) rich error envelope**, **(2) rate-limit signalling**,
**(3) idempotency enforcement on writes.** Phase 1's SDK is built to *consume* all of this
forward-compatibly, so the two phases share one wire contract and can be built in parallel.

---

## 0. Why this schedules with Phase 1 — the shared wire contract

> **Superseded:** the contract is now LOCKED in `docs/CONTRACT.md` (v1.0) — that file is
> authoritative. The summary below is retained for narrative context only.


Phase 1 already *sends* `Idempotency-Key`, *honors* `Retry-After` + `X-RateLimit-*`, and *surfaces*
`error.requestId`. Phase 2 makes the server *emit/enforce* them. Neither phase changes the other's
code once this contract is fixed — lock it before either starts, then build both in parallel.

**Headers (server emits / SDK reads):**
- `X-Request-Id` — on **every** response (success + error). Generated at the Worker edge.
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (unix secs) — on every response.
- `Retry-After` (secs) — on `429` and `503`.
- `Idempotency-Key` (SDK→server, writes only); `Idempotency-Replayed: true` on a replayed response.

**Error envelope (superset — additive, backward-compatible):**
```jsonc
{
  "error": {
    "code": "rate_limited",          // expanded enum (see §1)
    "message": "Rate limit exceeded. Retry after 12s.",
    "request_id": "req_01J...",       // === X-Request-Id
    "doc_url": "https://docs.wherabouts.com/errors/rate_limited",
    "fields": [                        // present only for unprocessable/bad_request validation
      { "path": "lat", "message": "Expected number, received string" }
    ]
  }
}
```
Existing `{ code, message }` consumers keep working; new fields are optional.

---

## 1. Workstream A — Rich error envelope

**Anchor:** `apps/server/src/index.ts` (the oRPC `onError` handler, ~L73–155, already maps
`ORPCErrorCode → {status, code}` and unwraps Zod) + `packages/api/src/api-response.ts`
(`ApiErrorCode`, `createApiErrorBody`, `jsonApiError`).

- Expand `ApiErrorCode`: add `rate_limited` (429), `forbidden` (403), `conflict` (409),
  `unprocessable` (422), `timeout` (504/408). Extend the `onError` code map to cover the new
  `ORPCError` codes (`FORBIDDEN`, `CONFLICT`, `UNPROCESSABLE_CONTENT`, `TOO_MANY_REQUESTS`).
- Extend `createApiErrorBody`/`ApiErrorResponseBody` with optional `request_id`, `doc_url`,
  `fields[]`. Generate `request_id` once at the edge; thread it into both the success path
  (`X-Request-Id` header) and the error body.
- **Field-level validation:** the `onError` handler already sees the wrapped Zod issue list — map
  `error.issues[]` → `fields[{ path, message }]` for `bad_request`/`unprocessable` instead of
  flattening to a single string.
- `doc_url`: derive `https://docs.wherabouts.com/errors/{code}` (stub pages land in Phase 3 docs).

**Acceptance:** every error response carries `request_id` + `doc_url`; a Zod failure returns
`fields[]`; the SDK's `WheraboutsApiError` populates `.requestId`/`.docUrl`/`.fields` (Phase 1
already reads `requestId`; add the other two when this lands).

**Effort:** S. Pure server, no new infra. Ship first — unblocks the others' `request_id`.

---

## 2. Workstream B — Rate-limit signalling

**Anchor:** the existing post-handler `usageMiddleware` in
`packages/api/src/routers/public-middleware.ts` already runs per request keyed by
`validatedApiKey.apiKeyId` — the natural counting hook. Limits are per API key (and/or per project).

**Storage decision (the key open question — see §5).** The Worker has **no KV / DO / rate-limit
binding today** (only Queues + R2). And `neon-http` has no transactions, so Postgres must stay off
the hot path. Two viable backends:

| Option | Accurate `Remaining/Reset` headers | Race-free | Cost to add | Notes |
|---|---|---|---|---|
| **Durable Object counter (recommended)** | ✅ exact (fixed window + `alarm()` reset) | ✅ (single-threaded per key) | DO class + wrangler migration | Also solves §3 idempotency races; pairs with no-transactions constraint |
| CF **Rate Limiting binding** + headers approximated | ⚠️ binding returns `{success}` only | ✅ | smallest | Faster to ship, but can't emit exact `Remaining/Reset` |

Recommendation: **one Durable Object** (`RateLimiterDO`), instance-per-API-key, fixed-window counter
with an `alarm()` to reset the window; returns `{ limit, remaining, reset }`. The middleware calls it
**before** the handler, sets the three headers on the response, and short-circuits to a `429`
(`rate_limited` + `Retry-After`) when exceeded. Tiers (free/paid limits) come from the project/plan
already loaded in auth context.

**Acceptance:** burst past the limit → `429` with `Retry-After` + `X-RateLimit-Remaining: 0`; the
Phase 1 SDK auto-backs-off and succeeds on retry (already implemented). Headers present on 2xx too.

**Effort:** M (mostly the new DO + wrangler migration + tier config).

---

## 3. Workstream C — Idempotency enforcement on writes

**Scope:** the 5 write endpoints — `zones.create`/`update`, `webhooks.create`,
`devices.pushLocation`, `geocode.batch.submit`. SDK already auto-sends `Idempotency-Key` (Phase 1).

**Mechanism:** key = `(apiKeyId, idempotencyKey)`. On a write:
1. First request: record key as **in-flight**, run handler, store `{ status, body, headers }`, return.
2. Replay (same key, completed): return the stored response verbatim + `Idempotency-Replayed: true`.
3. Replay while still **in-flight**: return `409 conflict` (`code: "conflict"`, "request with this
   Idempotency-Key is still processing").
4. TTL: expire stored entries after **24h**.

**Storage:** the **same Durable Object** as §2 (or a sibling `IdempotencyDO`) is the clean fit — its
per-key single-threading makes step 1↔3 race-free, which KV (eventually consistent) cannot guarantee
and `neon-http` (no transactions) cannot lock. KV is acceptable *only* if the in-flight race is
deemed tolerable; DO is recommended. Body is hashed/size-capped before storage.

**Edge case:** same key + **different request body** → `422 unprocessable`
(`"Idempotency-Key reused with a different payload"`), matching Stripe semantics.

**Acceptance:** double-submitting `zones.create` with one key creates **one** zone and returns the
same body twice (2nd with `Idempotency-Replayed`); concurrent dup → one `409`; reused key with
changed body → `422`.

**Effort:** M. Shares the DO infra with §2, so schedule B and C together.

---

## 4. Sequencing & coupling with Phase 1

```
Lock §0 wire contract  ──┬──> Phase 1 (SDK: send/honor/surface)   [can run fully in parallel]
                         └──> Phase 2A errors (S, no infra)  ── ship first
                                   └──> Phase 2B rate-limit (M) ─┐ share the DO
                                   └──> Phase 2C idempotency (M) ─┘ → schedule together
```
- **Parallelizable:** Phase 1 and Phase 2 touch disjoint code (SDK vs API/Worker). The only
  dependency is the §0 contract — lock it, then both teams proceed.
- **Within Phase 2:** A first (cheap, unblocks `request_id` everywhere), then B+C together (shared
  Durable Object). B and C in one slice avoids two wrangler migrations.
- **No SDK rework when Phase 2 lands:** Phase 1 is forward-compatible by design — behavior simply
  "lights up." Only addition: surface `.docUrl`/`.fields` on `WheraboutsApiError` (trivial) once the
  envelope ships.

---

## 5. Open decisions (resolve at plan time)
1. **Storage backend** — Durable Object (recommended: exact headers + race-free idempotency, one new
   binding) vs CF Rate-Limiting binding + KV (faster, weaker guarantees). Biggest decision; drives
   B + C effort.
2. **Limit tiers** — exact per-plan request budgets + window size (e.g. fixed 60s vs daily). Pull
   from the existing project/plan model.
3. **Idempotency TTL & body-hash cap** — 24h / size limit before storage.
4. **`doc_url` host** — confirm `docs.wherabouts.com/errors/{code}` (pages stubbed in Phase 3).

## 6. Out of scope (Phase 4)
Cursor pagination + `has_more`/`next_cursor` (enables SDK auto-pagination), generated-from-spec
types, OpenAPI-driven error-code pages (Phase 3 docs).
