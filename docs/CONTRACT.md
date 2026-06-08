# SDK ↔ API Wire Contract

**Status:** LOCKED · **Contract version:** `1.0` · **Date:** 2026-06-08

This is the **single source of truth** for the HTTP interface between `@wherabouts/sdk` (the client)
and the public API (`/api/v1/*` on `api.wherabouts.com`). It exists so the SDK work
([Phase 1 plan](./superpowers/plans/2026-06-08-sdk-phase1-publish-and-harden.md)) and the API work
([Phase 2 plan](./superpowers/plans/2026-06-08-sdk-phase2-api-dx.md)) can be built by different
workers **in parallel without drift**.

> **Change control.** Any change to this file is a contract change: bump the contract version, and
> update *both* plans in the same PR. The SDK is the **consumer**; the API is the **producer**.
> Producer may ship a field before the consumer reads it (forward-compatible); consumer must tolerate
> a field being absent (the API may lag). Never repurpose a header/field name — add a new one.

---

## 1. Authentication (existing — recap, not changing)

- `Authorization: Bearer <key>` **or** `X-API-Key: <key>`. Key format: `wh_<uuid>_<secret>`.
- Missing/invalid key → `401 unauthorized` (see §4). Auth is checked **before** rate limiting, so
  unauthenticated requests never consume rate-limit budget.

---

## 2. Headers

### 2.1 Request headers (SDK → API)
| Header | When | Notes |
|---|---|---|
| `Authorization` / `X-API-Key` | always | §1 |
| `Idempotency-Key` | **writes only** (§6) | client-generated UUID v4; SDK auto-sends if caller omits |
| `x-wherabouts-sdk` | always | telemetry: `js-ts/<sdkVersion> api/<apiVersion>` (informational) |

### 2.2 Response headers (API → SDK) — on **every** `/api/v1/*` response (success *and* error)
| Header | Value | Meaning |
|---|---|---|
| `X-Request-Id` | `req_<opaque>` (≤64 chars) | Correlation id; **identical** to `error.request_id` on errors. SDK surfaces as `error.requestId`. |
| `X-RateLimit-Limit` | integer | Requests allowed in the current window |
| `X-RateLimit-Remaining` | integer | Requests left in the current window (`0` when throttled) |
| `X-RateLimit-Reset` | unix epoch **seconds** | When the window resets |
| `Retry-After` | integer **seconds** | **Only** on `429` and `503`. SDK backoff honours this (capped). |
| `Idempotency-Replayed` | `true` | **Only** on a replayed idempotent write (§6) |

All four `X-*` headers MUST be in the CORS expose-list so the browser explorer can read them.

---

## 3. Error envelope

Every non-2xx `/api/v1/*` response has this JSON body (`content-type: application/json`,
`cache-control: no-store`):

```jsonc
{
  "error": {
    "code": "rate_limited",                                  // §4 enum — REQUIRED
    "message": "Rate limit exceeded. Retry after 12s.",      // human-readable — REQUIRED
    "request_id": "req_01J9X…",                              // === X-Request-Id — REQUIRED
    "doc_url": "https://docs.wherabouts.com/errors/rate_limited", // REQUIRED
    "fields": [                                              // OPTIONAL — only for validation errors
      { "path": "lat", "message": "Expected number, received string" }
    ]
  }
}
```

Backward-compat: pre-existing consumers reading only `{ code, message }` keep working; `request_id`,
`doc_url`, `fields` are additive.

---

## 4. Error code → HTTP status (canonical map)

The API producer MUST map oRPC errors to exactly these codes (this supersedes the old flattening in
`ORPC_TO_API_ERROR`):

| `error.code` | HTTP status | Meaning |
|---|---|---|
| `bad_request` | 400 | Malformed request / generic validation |
| `unauthorized` | 401 | Missing/invalid API key |
| `forbidden` | 403 | Authenticated but not allowed (e.g. cross-project resource) |
| `not_found` | 404 | Resource does not exist |
| `conflict` | 409 | State conflict (incl. idempotency in-flight, §6) |
| `unprocessable` | 422 | Semantically invalid (incl. idempotency body-mismatch, §6) |
| `rate_limited` | 429 | Rate limit exceeded (carries `Retry-After`) |
| `timeout` | 408 / 504 | Request/upstream timeout |
| `internal_error` | 500 / 502 / 503 | Server-side failure (502/503 keep their status; `503` may carry `Retry-After`) |

`fields[]` is populated for `bad_request` and `unprocessable` validation failures (mapped from Zod
issues).

---

## 5. Retry semantics (SDK behaviour — the resilience contract)

- **Retryable** conditions: network/transport error, or HTTP status in
  **`{408, 425, 429, 500, 502, 503, 504}`**. Nothing else is retried.
- **Method safety:** `GET`/`PUT`/`DELETE` are idempotent → always retryable. `POST` is retried
  **only** when an `Idempotency-Key` is present (the SDK always attaches one on writes, §6).
- **Backoff:** exponential with full jitter, base `200ms`, cap `5s`, default `maxRetries = 2`.
- **`Retry-After` precedence:** when present on `429`/`503`, it **overrides** computed backoff
  (capped at `5s`).
- The SDK surfaces the final failure as `WheraboutsApiError` with `.status`, `.code`, `.message`,
  `.requestId`, `.docUrl`, `.fields`.

---

## 6. Idempotency semantics

- **Scope:** the 5 write endpoints only —
  `POST /zones`, `PUT /zones/{id}`, `POST /webhooks`, `POST /devices/{deviceId}/location`,
  `POST /geocode/batch`.
- **Key:** `Idempotency-Key` header, client-generated UUID v4. SDK auto-generates one per write
  unless the caller supplies it. Scope of uniqueness: `(apiKeyId, key)`.
- **Window / TTL:** stored results expire after **24h**.
- **Body fingerprint:** SHA-256 of the canonicalized request body, size-capped.
- **Behaviour:**
  | Situation | Result |
  |---|---|
  | First use | Process normally; store `{status, body}`; respond. |
  | Replay, completed, **same** body hash | Return stored response + `Idempotency-Replayed: true`. |
  | Replay while still **in-flight** | `409 conflict` ("still processing"). |
  | Same key, **different** body hash | `422 unprocessable` ("reused with a different payload"). |
- **Note:** until the API producer (Phase 2) ships enforcement, the SDK still *sends* the key — it is
  simply ignored. Forward-compatible; no SDK change needed when enforcement lands.

---

## 7. Rate-limit semantics

- **Granularity:** per `apiKeyId`, fixed window.
- **Limit source:** `api_keys.rate_limit_rpm ?? DEFAULT_RATE_LIMIT_RPM` (config-driven; plan-based
  tiers are a later concern).
- **Headers:** §2.2 on every response. `X-RateLimit-Reset` and `Retry-After` are consistent
  (reset − now ≈ retry-after) on a `429`.

---

## 8. Ownership matrix

| Contract element | Producer (Phase 2 / API) | Consumer (Phase 1 / SDK) |
|---|---|---|
| `X-Request-Id` + `error.request_id` | emit on all responses | surface as `error.requestId` |
| Error envelope `code`/`message` | emit (§4 map) | parse → `WheraboutsApiError` |
| `error.doc_url` / `error.fields` | emit | surface `.docUrl` / `.fields` |
| `X-RateLimit-*` / `Retry-After` | emit + enforce `429` | honour in backoff |
| `Idempotency-Key` | enforce (§6) | auto-send on writes |
| Retry policy (§5) | n/a | implement |

---

## 9. Versioned constants
- API version: `v1` (path prefix `/api/v1`).
- This contract: `1.0`. SDK advertises both via `x-wherabouts-sdk`.
