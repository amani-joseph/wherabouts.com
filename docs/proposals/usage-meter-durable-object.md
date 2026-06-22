# Real-Time Usage Metering via Durable Object

Status: IMPLEMENTED (code complete, lint/types/tests green, wrangler dry-run OK) — pending production deploy + live load verification
Date: 2026-06-22
Builds on: docs/proposals/usage-tracking-reliability.md (Phases 1, 2, 3a shipped)

## Goal

Per-account real-time request counting + free-tier enforcement that stays exact
under high concurrency, without relying on Postgres read-modify-write on the hot
path. A Cloudflare Durable Object (DO) gives a single-threaded serialization
point per billing account, so increments are atomic by construction.

## Architecture

```
Request
  -> apiKeyAuth:  USAGE_METER.get(billingAccountId).peek()  -> { blocked }
                  if blocked -> 402 PAYMENT_REQUIRED (synchronous gate)
  -> handler
  -> usageMiddleware (on success):
        waitUntil( USAGE_METER.increment() )      # billing counter (DO = truth)
        waitUntil( recordUsageDaily() )           # per-endpoint analytics (Postgres upsert, atomic +1)
DO alarm (every ~10s): flush counter -> billing_accounts; refresh hasPaymentMethod/freeAllotment from Postgres
```

### Why two DO interactions (peek at auth, increment after success)
Preserves today's semantics exactly: the free-tier gate reads the current count
*before* the handler runs, and the counter only advances on a **successful**
request. Both the DO counter and `api_usage_daily` therefore count successful
requests, staying consistent. Both ops are in-memory on a warm DO.

### DO is source of truth for the live counter; Postgres is the durable mirror
- First init (DO storage empty): seed counter + `freeAllotment` +
  `hasPaymentMethod` + `currentPeriodStart` from `billing_accounts`.
- Thereafter DO `state.storage` is authoritative and is written on every
  increment (durable across eviction).
- A periodic alarm flushes the counter back to `billing_accounts` so the
  existing Stripe meter-reporting pipeline (reads Postgres) keeps working
  unchanged, and re-reads `hasPaymentMethod`/`freeAllotment` so a newly added
  card unblocks within one flush interval. The Stripe webhook may also call the
  DO directly for instant refresh (optional follow-up).

### Month rollover
Handled inside the DO on peek/increment: if `currentPeriodStart` is an earlier
UTC month than now, reset counter to 0 and advance the period before applying
the gate/increment. Same rule as `account.ts` `isInNewUtcMonth`.

## Safe fallback (de-risks rollout + keeps local/dev/tests working)
If `env.USAGE_METER` is not bound (local dev, tests, or a Worker deployed before
the migration), the code falls back to the synchronous Postgres path shipped in
Phases 1+2+3a (atomic SQL increment + `account.blocked` gate). No behavior gap,
no hard dependency on the DO for correctness.

## Pure, unit-testable core
Counter/gate/rollover logic lives in pure functions (`meter-core.ts`):
`peekState`, `incrementState`, `computeBlocked`, rollover — tested without the
Workers runtime. The DO class is a thin durable wrapper around them.

## Infra changes (no DB schema/DDL)
- `wrangler.jsonc`: add `durable_objects.bindings` (`USAGE_METER` ->
  `UsageMeter`) and a `migrations` entry (`new_sqlite_classes`).
- `apps/server/src/index.ts`: `export { UsageMeter }` and thread the namespace
  into the oRPC context alongside `env`.
- Requires the Workers paid plan (DOs). Deploy via wrangler (no CI/CD).

## Verification
- Unit tests for `meter-core.ts` (rollover, gate at boundary, card-on-file,
  exactness across 11k sequential increments). DONE — 9 tests.
- `wrangler deploy --dry-run` confirms the `USAGE_METER` binding + bundle. DONE.
- Read-only `EXPLAIN` confirmed the Phase 2 atomic UPDATE is valid. DONE.
- Post-deploy (pending): re-run `scripts/qa/verify-usage-tracking.mjs`; fire a
  load test; confirm `api_usage_daily` sum and the billing counter match volume.

## Files changed
- `packages/api/src/billing/meter-core.ts` (+ `.test.ts`) — pure counter logic.
- `packages/api/src/billing/usage-meter-client.ts` — DO client (peek/increment).
- `packages/api/src/billing/account.ts` — atomic `incrementBillingUsage` (Phase 2).
- `packages/api/src/api-key-auth.ts` — `recordUsage` reuse id + `skipBillingIncrement`.
- `packages/api/src/routers/public-middleware.ts` — gate via DO, increment via DO/waitUntil.
- `packages/api/src/context.ts` (+ index export) — `WaitUntil`, `USAGE_METER` env.
- `apps/server/src/usage-meter.ts` — `UsageMeter` Durable Object.
- `apps/server/src/index.ts` — thread `waitUntil`, export `UsageMeter`.
- `apps/server/wrangler.jsonc` — DO binding + `new_sqlite_classes` migration.

## Deploy runbook (manual — no CI/CD)
1. `cd apps/server && pnpm exec wrangler deploy`
   - First deploy creates the `UsageMeter` SQLite DO class (migration tag v1).
   - Requires the Workers paid plan (DOs). Server secrets already configured.
2. Smoke test: hit a `/api/v1/*` endpoint a few times with a real key; then run
   `node scripts/qa/verify-usage-tracking.mjs` and confirm `api_usage_daily` rows
   appear and the account's `current_period_requests` advances within ~10s.
3. Load test: fire N (e.g. 11k) requests; confirm the counter == N (exact) and the
   dashboard reflects them. Confirm a 2nd key on the same account shares the count
   (per-account, not per-key).
4. Rollback: removing the `durable_objects`/`migrations` blocks and redeploying
   reverts to the synchronous Postgres path (Phase 1+2+3a) with no data loss —
   the DO flushes to `billing_accounts` which the fallback reads.

## Optional follow-up (not built)
Instant unblock on payment-method add: have the Stripe webhook call the DO's
`refresh` directly instead of waiting for the ~10s flush. Auto-refresh already
covers correctness; this only tightens latency.
