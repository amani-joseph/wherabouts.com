# SDK Phase 2 — API-side DX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` (or
> `superpowers:subagent-driven-development`). Checkbox (`- [ ]`) steps. `pnpm dlx ultracite fix`
> before each commit; one commit per task.

**Goal:** Make the public API debuggable, resilient, and safe to retry — the server half of the DX
work. Three workstreams: **(A) rich error envelope**, **(B) rate-limit signalling**,
**(C) idempotency on writes**. Phase 1's SDK already consumes all of it forward-compatibly.

**Wire contract (LOCKED):** `docs/CONTRACT.md` — authoritative for headers, error codes/envelope,
rate-limit + idempotency semantics this plan produces. Changes go through that file.
**Sketch (background):** `docs/superpowers/specs/2026-06-08-sdk-phase2-api-dx-sketch.md`.
**Companion plan:** `docs/superpowers/plans/2026-06-08-sdk-phase1-publish-and-harden.md`.

**Runtime:** Cloudflare Workers (`apps/server`), Hono + oRPC `OpenAPIHandler`. `neon-http` has **no
transactions** — hot-path counters/locks must NOT use Postgres.

---

## Decisions (locked)

- **Storage backend = Durable Objects.** Two classes: `RateLimiterDO` (instance per `apiKeyId`) and
  `IdempotencyDO` (instance per `${apiKeyId}:${idempotencyKey}`). DO chosen over KV/CF-rate-limit
  binding because it gives **exact** `X-RateLimit-Remaining/Reset` and **race-free** idempotency via
  per-key single-threading — the serialization `neon-http` can't provide. *(Revisable; the lighter
  CF-binding+KV alternative is in sketch §2.)*
- **Guard logic lives at the Hono `/api/v1/*` handler**, not oRPC middleware (oRPC response-headers
  aren't wired here, and the handler is the single chokepoint with the full `Response` in hand).
- **Tiers are config-driven** (no plan model exists in the schema today): a `DEFAULT_RATE_LIMIT_RPM`
  constant + optional nullable `rate_limit_rpm` override column on `api_keys`. Real plan-based tiers
  are deferred.
- **Idempotency:** writes only (`zones.create/update`, `webhooks.create`, `devices.pushLocation`,
  `geocode.batch.submit`); 24h TTL; `409` in-flight; `422` on same-key/different-body.

---

## ⚠️ Dependencies & sequencing

- **The wire contract is locked in `docs/CONTRACT.md`** — header names + envelope fields. Then Phase 1 and
  Phase 2 proceed in parallel (disjoint code: SDK vs Worker).
- **Within this plan:** **A first** (no infra, unblocks `request_id`), then **B + C together** (they
  share the DO infra from Task 4 — building separately means two wrangler migrations).
- **Anchors confirmed in code:**
  - Envelope producer: `reformatErrorResponse()` + `ORPC_TO_API_ERROR` in `apps/server/src/index.ts`.
  - Request chokepoint: `app.use("/api/v1/*", …)` in `apps/server/src/index.ts`.
  - Error code type: `packages/api/src/api-response.ts` (`ApiErrorCode`).
  - Auth helpers reusable at Hono layer: `parseApiKeyFromRequest`, `validateApiKey`
    (`packages/api/src/api-key-auth.ts`).

**Working dir:** worktree `worktree-sdk-phase2-api-dx` (`superpowers:using-git-worktrees`).

---

## File structure (target)

```
apps/server/
  wrangler.jsonc                 # MODIFIED: durable_objects bindings + migrations
  src/
    index.ts                     # MODIFIED: request-id mw, rate-limit+idempotency guard, export DOs
    request-id.ts                # NEW: edge request-id generation
    guard/rate-limiter-do.ts     # NEW: RateLimiterDO class
    guard/idempotency-do.ts      # NEW: IdempotencyDO class
    guard/guard.test.ts          # NEW
packages/api/src/
  api-response.ts                # MODIFIED: expand ApiErrorCode + envelope (request_id/doc_url/fields)
  error-doc-url.ts               # NEW: code -> docs URL
```

---

## Workstream A — Rich error envelope

### Task A1: Expand error-code type + envelope shape
- [ ] In `packages/api/src/api-response.ts` extend `ApiErrorCode` with `rate_limited`, `forbidden`,
      `conflict`, `unprocessable`, `timeout`.
- [ ] Add **optional** `request_id?`, `doc_url?`, `fields?: { path: string; message: string }[]` to
      `ApiErrorResponseBody["error"]`; extend `createApiErrorBody` to accept them.
- [ ] New `error-doc-url.ts`: `errorDocUrl(code) => https://docs.wherabouts.com/errors/{code}`.

**Acceptance:** type-checks; existing 4-code callers still compile (new fields optional).

### Task A2: Edge request-id middleware
- [ ] New `request-id.ts`: `generateRequestId()` → `req_` + ULID/uuid. Hono middleware on
      `/api/v1/*` (and ideally all routes) that creates an id, stores it on `context.set("requestId", …)`,
      and sets `X-Request-Id` on the outgoing response.
- [ ] Ensure it runs **before** the `/api/v1/*` handler so the id is available to `reformatErrorResponse`.

**Acceptance:** every `/api/v1/*` response (2xx + error) carries `X-Request-Id`.

### Task A3: Un-flatten `reformatErrorResponse`
- [ ] Update `ORPC_TO_API_ERROR`: `FORBIDDEN→forbidden`, `CONFLICT→conflict`,
      `UNPROCESSABLE_CONTENT→unprocessable`, `TOO_MANY_REQUESTS→rate_limited`,
      `TIMEOUT/GATEWAY_TIMEOUT→timeout` (stop collapsing to `bad_request`/`unauthorized`).
- [ ] Inject `request_id` (from `context`) and `doc_url` (`errorDocUrl(code)`) into every error body.
- [ ] Map oRPC/Zod validation issues → `fields[]` (the handler already receives the wrapped issue
      list in `message`/`data`; parse it into `{ path, message }` for `bad_request`/`unprocessable`).

**Acceptance:** a Zod failure returns `code: "bad_request"` + `fields[]`; a 403 returns
`code: "forbidden"`; all errors carry `request_id` + `doc_url`. SDK `WheraboutsApiError.requestId`
populates (Phase 1); add `.docUrl`/`.fields` surfacing in the SDK follow-up (Task V).

---

## Workstream B + C — Durable Object guard (schedule together)

### Task BC1: DO infrastructure
- [ ] `wrangler.jsonc`: add
  ```jsonc
  "durable_objects": { "bindings": [
    { "name": "RATE_LIMITER", "class_name": "RateLimiterDO" },
    { "name": "IDEMPOTENCY",  "class_name": "IdempotencyDO" }
  ]},
  "migrations": [ { "tag": "v1", "new_sqlite_classes": ["RateLimiterDO", "IdempotencyDO"] } ]
  ```
- [ ] `export { RateLimiterDO } from "./guard/rate-limiter-do.ts"` and `IdempotencyDO` from
      `apps/server/src/index.ts` (DOs must be exported from the Worker entry).
- [ ] Extend the `cfEnv` type in the `/api/v1/*` handler with
      `RATE_LIMITER: DurableObjectNamespace`, `IDEMPOTENCY: DurableObjectNamespace`.
- [ ] Add `@cloudflare/vitest-pool-workers` (dev-dep) for DO tests.

**Acceptance:** `wrangler dev` boots with both DOs; `wrangler deploy --dry-run` accepts the migration.

### Task BC2: Rate limiting (`RateLimiterDO` + guard)
- [ ] `RateLimiterDO`: SQLite-backed fixed-window counter. Method `check(limit, windowSecs)` →
      `{ allowed, limit, remaining, reset, retryAfter }`. Reset via `alarm()` (or lazy compare on
      `now`). Instance id = `idFromName(apiKeyId)`.
- [ ] At the **top** of `/api/v1/*` (after request-id, before `openApiHandler.handle`): resolve the
      validated key once (`parseApiKeyFromRequest` → `validateApiKey`); thread the validated key into
      `createContext` so oRPC `apiKeyAuth` can **trust it and skip re-hashing** (small refactor in
      `public-middleware.ts` to accept a pre-validated key from context). On no/invalid key →
      existing 401 path (don't spend a DO call on unauth requests).
- [ ] Resolve `limit` = `apiKey.rate_limit_rpm ?? DEFAULT_RATE_LIMIT_RPM`; add the nullable
      `rate_limit_rpm` column to `api_keys` (Drizzle migration, single baseline — never hand-write
      out-of-journal SQL, per the lineage rule).
- [ ] Set `X-RateLimit-Limit/Remaining/Reset` on **all** `/api/v1/*` responses. If `!allowed`,
      short-circuit `429` `rate_limited` with `Retry-After` (don't call the handler).

**Acceptance:** burst > limit → `429` + `Retry-After` + `X-RateLimit-Remaining: 0`; the Phase 1 SDK
auto-retries and succeeds; headers present on 2xx too.

### Task BC3: Idempotency (`IdempotencyDO` + write guard)
- [ ] `IdempotencyDO` (id = `idFromName(\`${apiKeyId}:${key}\`)`): `lookup(bodyHash)`,
      `begin(bodyHash)`, `complete(status, body, headers)`. Stores state in DO SQLite; `alarm()`
      purges entries > 24h.
- [ ] In `/api/v1/*`, **only for write methods on the 5 write paths** and when `Idempotency-Key`
      present: before the handler, `begin`/`lookup`:
      - completed + same `bodyHash` → return stored response + `Idempotency-Replayed: true`.
      - in-flight → `409 conflict`.
      - same key + different `bodyHash` → `422 unprocessable`
        ("Idempotency-Key reused with a different payload").
      - else mark in-flight, run handler, `complete(...)` with the final response, return.
- [ ] `bodyHash` = SHA-256 of the canonicalized request body, size-capped before storage.

**Acceptance:** double `zones.create` with one key → **one** zone, identical body twice (2nd carries
`Idempotency-Replayed`); concurrent dup → one `409`; reused key + changed body → `422`.

---

## Task T: Tests
- [ ] **Envelope (A):** unit-test `reformatErrorResponse` for each new code mapping + `request_id`/
      `doc_url`/`fields[]` presence; a Zod 422 produces `fields[]`.
- [ ] **Rate limit (B):** `@cloudflare/vitest-pool-workers` — N+1 requests → last is `429` with
      correct headers + `Retry-After`; window reset restores capacity.
- [ ] **Idempotency (C):** replay returns stored body + header; in-flight → `409`; body-mismatch →
      `422`; entry expires after TTL.

## Task V: SDK + docs follow-up
- [ ] Surface `.docUrl` and `.fields` on `WheraboutsApiError` (Phase 1 already added `.requestId`);
      bump SDK patch.
- [ ] Stub `docs/errors/{code}` targets (full pages = Phase 3); add the new codes + `request_id`
      header to the OpenAPI spec / error schema.

## Task Z: Verification & self-review
- [ ] `pnpm -F @wherabouts.com/server test` + `pnpm check-types` green; `wrangler deploy --dry-run` ok.
- [ ] Manual: a 429 and an idempotent replay observed against `wrangler dev`.
- [ ] Mark Phase 2 items done in `docs/sdk-dx-analysis-and-plan-2026-06.md` §5.

---

## Risks & notes
- **Per-request DO hop latency/cost:** every `/api/v1/*` call now makes ≥1 DO call (rate limit), +1
  for writes. Cheap, but real — measure p50 impact; co-location is automatic per-key. If latency
  regresses, the CF Rate-Limiting binding (sketch §2) is the fallback for the limit check.
- **Double API-key validation:** avoided by threading the Hono-layer-validated key into
  `createContext`/`apiKeyAuth` (BC2). If that refactor is risky, accept one extra scrypt verify
  initially and optimize later.
- **DO migration is irreversible-ish:** `new_sqlite_classes` tag must be stable; never rename a tag.
- **Drizzle migration** for `rate_limit_rpm`: single baseline, in-journal only (lineage rule).
- **`Idempotency-Replayed`/`X-RateLimit-*` must be in the CORS `allowHeaders`/expose list** if the
  browser explorer reads them — update the Hono `cors()` config.
