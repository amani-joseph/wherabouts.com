# Usage Tracking & Free-Tier Enforcement — Reliability Fix

Status: investigation complete, awaiting approval on scope
Date: 2026-06-22

## Symptom

11,000 requests simulated against a deployed account via an API key did not appear in
the analytics dashboard (`/dashboard` getStats).

## Root causes (confirmed by code trace)

### RC1 — Orphaned usage write on Cloudflare Workers (why tracking shows ~0)
`usageMiddleware` (`packages/api/src/routers/public-middleware.ts:107-134`) calls
`recordUsage(...)` fire-and-forget (`.catch()`, not awaited) and immediately returns the
handler result. The promise is **never registered with `ctx.waitUntil()`**.

On workerd, once the `fetch` handler returns its Response, in-flight I/O not held by
`waitUntil()` is cancelled. `recordUsage` performs ~4-5 sequential neon-http round trips
(`getOrCreateBillingAccount`: insert-on-conflict + select + maybe reset-update;
`api_usage_daily` upsert; `incrementBillingUsage` update). Under a fast load test the
worker returns each response and the runtime kills the pending writes → few/no rows land.

Dashboard reads `api_usage_daily` summed by `userId` + `requestSource='production'`
(`packages/api/src/routers/domains/dashboard.ts:28-36`), so missing rows = ~0 shown.

Does not reproduce under local Node (process stays alive) — only on deployed Workers.

### RC2 — Lost-update race on the billing counter (enforcement undercounts)
`incrementBillingUsage` (`packages/api/src/billing/account.ts:143-158`) reads
`currentPeriodRequests`, computes `+1` in JS, writes the absolute value. neon-http has no
transactions. Under concurrency, N requests read V and all write V+1 → counter advances
by 1 instead of N. The `blocked` flag (free-tier gate) is therefore undercounted and the
10k cap is not reliably enforced.

`api_usage_daily.requestCount` uses an atomic SQL `+1` upsert and is safe per-row — only
the `billing_accounts` counter is racy.

### RC3 — Per-account model is correct; dashboard scoping is per-user
`freeAllotment` (10,000) and `currentPeriodRequests` live on `billing_accounts`, uniquely
keyed by `userId`/`teamId` (`packages/database/src/schema/billing.ts:27,41-42`). All of a
user's API keys map to one billing account (`billingOwnerFromKey`), so **new keys do not
grant new free quota** — the abuse vector is closed at the model level.

Minor inconsistency: dashboard `getStats` aggregates usage by `userId`, while billing is
per-owner (team or user). For team-owned keys the dashboard under-reports. Not the abuse
vector, but worth aligning.

## Fix plan

### Phase 1 — Make the write survive (no DB schema change)
1. Thread `executionCtx.waitUntil` from the Hono `/api/v1/*` handler into the oRPC
   context (`createContext`).
2. `usageMiddleware` registers the `recordUsage` promise via `waitUntil` instead of bare
   fire-and-forget, so workerd keeps it alive after the response returns.

### Phase 2 — Make the counter atomic (no DDL; SQL change only)
3. Replace the read-modify-write in `incrementBillingUsage` with a single atomic SQL
   `UPDATE ... SET current_period_requests = current_period_requests + 1`, computing
   `blocked` from the new value in the same statement (or on read). Eliminates the race.
4. Collapse `getOrCreateBillingAccount` + increment into fewer round trips where possible.

### Phase 3 — Real-time correctness & enforcement
5. Enforce the 10k gate off the atomic counter; return 402 when exceeded.
6. (Optional, scale) For true real-time aggregation under heavy load, evaluate batching
   writes via a Cloudflare Queue or aggregating in a Durable Object keyed by billing
   account, flushing to Postgres periodically. Larger change — separate decision.

### Verification
- Unit tests for `nextCounterState` / atomic increment semantics (pure logic).
- A load-style integration test asserting row counts match request counts.
- Read-only live DB check to confirm current row counts for the affected account.

## Notes / constraints
- Any DDL requires explicit user approval (shared Neon DB). Phases 1-2 need none.
- No CI/CD: fixes must be manually deployed via wrangler to take effect in prod.
