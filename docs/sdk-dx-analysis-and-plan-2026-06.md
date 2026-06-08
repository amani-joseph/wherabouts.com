# Wherabouts.com — SDK & Developer-Experience Analysis vs Radar / Google / Stripe

**Date:** 2026-06-08
**Author:** engineering / DX review
**Scope:** A *depth* critique of the developer experience — SDK ergonomics, API design, and
documentation — measured against the bar set by Radar, Google Maps Platform, and Stripe (the
de-facto gold standard for API-product DX). Complements the market/feature comparison in
[`competitive-analysis-2026-06.md`](./competitive-analysis-2026-06.md), which is intentionally
*not* a DX analysis.

> **Relationship to in-flight work.** The `sdk-completion` worktree
> (`2026-06-07-typescript-sdk-completion-design.md`) takes the SDK from 4 methods to full 22-method
> coverage with resource namespaces + tests. **That slice fixes *surface coverage*. It explicitly
> defers almost the entire DX layer** — publishing, retries, idempotency, pagination, generated
> types, README, other languages. This document treats the completion slice as the *baseline* and
> plans the DX layer on top of it. Where a recommendation is already covered, it says so.

---

## 1. The bar — what "great SDK DX" actually means

Buyers don't compare geocoding accuracy in a sales call; they compare *time-to-first-success* and
*how the SDK behaves at 2am in production*. The three reference products converge on the same
dimensions:

| Dimension | Stripe | Radar | Google Maps (services-js) | Why it matters |
|---|---|---|---|---|
| Install & first call | `npm i stripe`, 3 lines | `npm i radar-sdk-js` / native, quickstart per framework | `npm i @googlemaps/google-maps-services-js` | Time-to-first-success |
| Resource namespacing | `stripe.customers.create` | `Radar.geocode`, `Radar.trackOnce` | `client.geocode({params})` | Discoverability / autocomplete |
| Auto-retries + backoff | `maxNetworkRetries`, exp backoff, idempotent-safe | built into native SDKs | `retryConfig` (axios-retry) | Resilience without user code |
| Idempotency | idempotency keys, first-class | n/a (event model) | n/a | Safe retries on writes |
| Rich typed errors | `type/code/param/doc_url/requestId` | `RadarStatus` enum | typed `status` + response | Debuggability |
| Pagination helpers | `autoPagingEach`, async iterators | cursor helpers | n/a | Ergonomics over large sets |
| Per-request options | timeout, idempotencyKey, apiVersion | options object | per-call `timeout`, `signal` | Control without new client |
| Request observability | request IDs surfaced, telemetry header | request IDs | response metadata | Support + tracing |
| Generated/typed from spec | hand-tuned but versioned | versioned | TS types shipped | No drift, `.d.ts` shipped |
| Published + versioned | npm/pypi/etc., semver, changelog | npm + native registries | npm | Actually installable |
| Framework adapters | React (`@stripe/react-stripe-js`) | iOS/Android/RN/Flutter/Web | `js-api-loader` for browser | Meet devs where they are |
| Docs: runnable quickstart | ✅ copy-paste, multi-lang tabs | ✅ per-platform | ✅ | Conversion |
| Docs: per-method reference w/ examples | ✅ generated from spec | ✅ | ✅ | Lookup speed |

---

## 2. Wherabouts today — grounded in the code

**SDK (`packages/sdk`, `@wherabouts.com/sdk` v0.1.0, `private: true`)**
- Clean, dependency-free, runtime-agnostic `fetch` client. Good bones.
- **Implements 4 of ~19 endpoints** (`autocomplete`, `getAddressById`, `nearby`, `reverse`).
  `types.ts` *declares* Zones/Geocode/Batch/Devices/Webhooks types, but `client.ts` never wires
  them up — and the `request` helper is **GET-only**, so every POST/PUT/DELETE endpoint is
  unreachable. (The `sdk-completion` slice fixes both.)
- **No build/publish:** exports raw `./src/index.ts`, `private: true`. External devs cannot
  `npm install` it. No `.d.ts`, no `dist`, no `exports`/`types`/`files`, no README, no changelog.
- **No resilience:** no retries, no backoff, no timeout, no `AbortSignal`, no rate-limit handling.
- **No per-request options:** headers are frozen at client-construction; you can't pass a timeout
  or idempotency key on a single call.
- **No pagination helpers:** `page`/`limit` only; no async iterator over zones/addresses.
- **No observability surfaced:** errors carry `status/code/message/payload` but no `requestId`.
- **Single language** (TS). No Python, no browser-loader, no mobile/on-device SDK.
- Version drift smell: `package.json` says `0.1.0`; `types.ts` says `0.1.0-preview`.

**API-level DX (the SDK can only be as good as the API underneath)**
- **Thin error taxonomy:** only `bad_request | internal_error | not_found | unauthorized`. No
  `rate_limited`, `forbidden`, `conflict`, `unprocessable`/validation-field detail, and no
  `doc_url` or `request_id` in the envelope. Stripe/Radar errors are self-describing; these aren't.
- **No rate-limit signalling:** no `X-RateLimit-*` or `Retry-After` headers found — so a correct
  client *cannot* back off intelligently.
- **No idempotency** support on writes (`zones.create`, `devices.pushLocation`, `webhooks.create`).
- **Offset/`page` pagination**, not cursor — fine at small scale, but no `has_more`/`next_cursor`
  to drive auto-pagination.
- **OpenAPI 3.1 is served** (`/api/openapi.json`, `api-docs` route, `lib/openapi.ts`) — a real
  asset. But the SDK is **hand-written and not generated from it**, so types can drift (the
  completion spec mitigates with a coverage test, not type generation).
- **Docs are a hand-maintained 2,287-line `docs-page.tsx`** — high maintenance, easy to desync from
  the spec, and not the per-method, multi-language reference buyers expect.

---

## 3. Gap scorecard (DX dimensions)

Legend: ✅ strong · ⚠️ partial · ❌ absent

| DX dimension | Wherabouts (after completion slice) | Radar | Google | Stripe |
|---|---|---|---|---|
| Installable from a public registry | ❌ (still private) | ✅ | ✅ | ✅ |
| Full endpoint coverage | ✅ (22 methods) | ✅ | ✅ | ✅ |
| Resource namespacing | ✅ | ✅ | ⚠️ | ✅ |
| Ships `.d.ts` / typed | ✅ (src TS) | ✅ | ✅ | ✅ |
| Auto-retry + backoff | ❌ (deferred) | ✅ | ✅ | ✅ |
| Idempotency keys | ❌ (no API support) | n/a | n/a | ✅ |
| Per-request timeout / `AbortSignal` | ❌ | ✅ | ✅ | ✅ |
| Rich, documented error taxonomy | ⚠️ (4 codes) | ✅ | ✅ | ✅ |
| `request_id` surfaced for support | ❌ | ✅ | ⚠️ | ✅ |
| Rate-limit headers honoured | ❌ (no headers) | ✅ | ✅ | ✅ |
| Auto-pagination helpers | ❌ (deferred) | ⚠️ | n/a | ✅ |
| Generated-from-spec types | ⚠️ (hand + coverage test) | ✅ | ✅ | ✅ |
| Browser/edge build target | ⚠️ (runtime-agnostic, unpublished) | ✅ | ✅ | ✅ |
| Second language (Python) | ❌ | ✅ | ✅ | ✅ |
| Mobile / on-device SDK | ❌ | ✅ (the moat) | ✅ | n/a |
| Runnable multi-language quickstart docs | ⚠️ (hand-rolled page) | ✅ | ✅ | ✅ |
| Per-method reference from spec | ❌ | ✅ | ✅ | ✅ |
| Changelog / semver / migration notes | ❌ | ✅ | ✅ | ✅ |

**Headline:** even after the completion slice lands, Wherabouts is at *surface parity* but
*resilience- and distribution-poor*. The three things a server-side buyer judges first —
**can I `npm install` it, does it retry safely, and can I find a per-method doc** — are all ❌/⚠️.

---

## 4. Critical findings (ranked)

**F1 — It isn't installable. (blocker)** `private: true` + raw-source export means there is no SDK a
customer can adopt. Everything else is moot until there's a published, versioned, `.d.ts`-shipping
package. *The completion spec explicitly defers this.* This is the single highest-leverage DX fix.

**F2 — No resilience layer.** No retries/backoff/timeout/abort. Geocoding-at-scale and device-push
workloads *will* hit transient 5xx/network blips; today every blip surfaces to the caller. Stripe's
`maxNetworkRetries` is the canonical model. Requires (a) SDK retry logic and (b) API `Retry-After` +
`X-RateLimit-*` headers so retries are well-behaved, not blind.

**F3 — Error envelope is too thin to debug.** Four codes, no `request_id`, no `doc_url`, no
field-level validation detail. A developer who gets a 400 can't tell *which param* was wrong without
guessing. This is an API-side fix that the SDK then surfaces (`error.requestId`, `error.docUrl`,
`error.fieldErrors`).

**F4 — Docs are hand-maintained and will drift.** 2,287 lines of `docs-page.tsx` duplicating an
OpenAPI spec that already exists. Buyers expect a per-endpoint reference with copy-paste
SDK + curl + Python tabs. Generate docs *from* the OpenAPI spec (Scalar/Redoc/Mintlify) instead of
hand-curating.

**F5 — No idempotency on writes.** `devices.pushLocation` and `zones.create` are exactly the calls a
client will retry. Without idempotency keys, retries risk duplicate zones / double-counted crossings.
(Recall the prior `neon-http` no-transactions constraint — idempotent upserts are already the house
pattern; expose an `Idempotency-Key` header to extend it to the API edge.)

**F6 — One language, no client SDK.** Python is the obvious second server SDK (data/geocoding
buyers). The mobile/on-device SDK is the strategic moat per the market analysis but is a multi-quarter
effort — scope separately.

**F7 — Hand-written types can drift from the API.** The coverage test guards *existence*, not
*shape*. Long-term, generate request/response types from the OpenAPI spec and keep the hand-written
ergonomic layer thin on top.

---

## 5. The plan — phased, building on the completion slice

### Phase 0 — Land the completion slice (in flight, no change)
Full 22-method coverage, resource namespaces, vitest. *Baseline for everything below.*

### Phase 1 — Make it real: publish + harden (highest leverage, ~1–2 wks)
*Turns an internal package into an adoptable product.*
1. **Build & publish pipeline:** tsup/unbuild → ESM+CJS+`.d.ts`; set `exports`/`types`/`files`;
   drop `private`; semver from `0.2.0`; npm publish; CHANGELOG + README with a 60-second quickstart.
2. **Resilience layer** (the completion slice's deferred "harden" phase): configurable
   `maxRetries` + exponential backoff with jitter, retry only idempotent/safe statuses
   (429/5xx/network), `timeoutMs`, and per-request `signal` (`AbortSignal`).
3. **Per-request options object** so timeout / idempotencyKey / extra headers can be set per call.
4. Reconcile the `0.1.0` vs `0.1.0-preview` version mismatch; single source of truth.

### Phase 2 — API-side DX (unblocks F2/F3/F5, ~1–2 wks)
*The SDK can't be resilient or debuggable without these.*
1. **Expand the error envelope:** add `rate_limited`/`forbidden`/`conflict`/`unprocessable`,
   `request_id`, `doc_url`, and `fields[]` validation detail. Surface all of it on
   `WheraboutsApiError` (`.requestId`, `.docUrl`, `.fields`).
2. **Rate-limit headers:** emit `X-RateLimit-Limit/Remaining/Reset` + `Retry-After` on 429; SDK
   honours `Retry-After` in its backoff.
3. **Idempotency keys** on writes (`Idempotency-Key` header), backed by the existing idempotent-upsert
   pattern; SDK auto-generates a UUID per write unless the caller supplies one.

### Phase 3 — Docs as a product (parallelizable, ~1 wk)
1. **Generate the API reference from the OpenAPI 3.1 spec** (Scalar or Mintlify) — retire most of the
   2,287-line hand page; keep curated guides (auth, geofencing concepts, webhooks signing).
2. **Per-endpoint examples in tabs:** SDK (TS) · curl · Python. Drive them from the spec so they can't
   drift.
3. **Recipe guides** matching the moat: "detect when a device enters a zone," "classify a coordinate
   to ABS regions," "batch-geocode a CSV."
4. **Webhook DX:** document signature verification + ship a `verifyWebhookSignature(payload, sig,
   secret)` helper in the SDK (note: secret is returned once at creation — call that out loudly).

### Phase 4 — Reach (strategic, scope separately)
1. **Auto-pagination** async iterators over `zones.list` / `zones.addresses` / `webhooks.list`
   (needs `has_more`/`next_cursor` from the API — pairs with a cursor-pagination upgrade).
2. **Python SDK** — second server language for the data buyer; mirror the namespaced surface.
3. **Browser/edge quickstart + `js-api-loader`-style** entry for the runtime-agnostic client.
4. **Generated types from OpenAPI** feeding the hand-written ergonomic layer (kills F7 drift).
5. **Mobile/on-device SDK** — the Radar moat; multi-quarter, own milestone (per market analysis P1).

### Sequencing rationale
Phase 1 + 2 together are *table stakes for any external adoption* and are small. Phase 3 converts
trials. Phase 4 is the differentiation/expansion tier. Phases 1–3 are the "win the server-side buyer
today" bundle the market analysis calls the cheapest high-leverage move; Phase 4.5 (mobile) is the
strategic moat tracked separately.

---

## 6. Quick wins (this sprint, low effort / high signal)
- Publish the package (even a `0.2.0` preview on npm) — removes the F1 blocker.
- Add `request_id` to the error envelope + surface `error.requestId` — instantly better support.
- Add `timeoutMs` + `AbortSignal` to the client — a few lines, big resilience signal.
- Ship a README with a copy-paste quickstart — the cheapest conversion lever that exists.
- Fix the `0.1.0` / `0.1.0-preview` version mismatch.
