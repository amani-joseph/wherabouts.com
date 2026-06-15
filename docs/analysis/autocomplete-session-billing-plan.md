# Plan: Session-based billing for address autocomplete

**Status:** DRAFT — proposal only, **not approved, not implemented.**
**Author:** SDK/React DX workstream · 2026-06-16
**Decision owner:** product/billing (usage-based billing went live in prod 2026-06-13).

> ⚠️ Billing is live in production. Nothing in this document has been built. It
> exists so the change can be reviewed and signed off before any code lands. Do
> not implement without explicit approval — a metering mistake directly affects
> customer invoices.

## Problem

Autocomplete is metered **per request**. Every keystroke that reaches
`GET /api/v1/addresses/autocomplete` increments `apiUsageDaily.requestCount`
(`recordUsage`, `packages/api/src/api-key-auth.ts`), which the meter cron sums
per UTC day and reports to the single Stripe usage meter
(`reportUsageToStripe`, `packages/api/src/billing/meter-reporting.ts`).

A typical "type an address, pick a result" interaction is ~6–12 keystrokes
after the 2-char `minLength` gate. So a customer is billed ~10× per address
captured. This is the opposite of the Google Places model, where a **session
token** groups a run of keystrokes plus the final detail fetch into **one**
billable unit. The SDK already supports this end-to-end:

- `newSessionToken()` (`packages/sdk/src/session.ts`)
- `AutocompleteParams.sessionToken` → sent to the API as `sessionToken`
  (`packages/sdk/src/resources/addresses.ts`)
- `useAutocomplete({ sessionToken })` passthrough (`packages/react`)

What's missing is the **server-side** counting change. Today the API ignores the
`sessionToken` query param.

## Goal

Bill **one** autocomplete unit per distinct `sessionToken` (per billing account,
per day), regardless of how many keystroke requests share that token. Requests
with **no** `sessionToken` keep today's per-request behaviour (back-compat).

## Constraints (from existing code + project memory)

- **No transactions on neon-http** — `db.transaction()` throws on the neon-http
  driver. Use idempotent upserts (`INSERT … ON CONFLICT … RETURNING`) to make
  "first time we've seen this token" an atomic, single-statement decision. See
  memory `neon-http-no-transactions`.
- **Stateless workers** — dedup state cannot live in worker memory; it must be in
  Postgres (or Workers KV). Postgres keeps it next to existing usage data.
- **Usage accounting must never fail the response** — `usageMiddleware` already
  swallows `recordUsage` errors; the session path must do the same.
- **Don't break the meter ledger** — `billingMeterReports` assumes
  `apiUsageDaily.requestCount` only ever grows per (account, date). The session
  approach must still produce a monotonic daily count.

## Proposed design (Option A — recommended)

Count the **first** request of each session as the billable event; treat
subsequent same-token requests as free.

1. **Read the token.** In the autocomplete handler/middleware, parse
   `sessionToken` (validate: opaque string, length-bounded, e.g. ≤ 64 chars).

2. **New table `apiAutocompleteSessions`** (Drizzle migration — DDL, needs DB
   approval per memory `db-changes-require-approval`):
   - `sessionToken text` + `billingAccountId` → composite PK
   - `apiKeyId`, `projectId`, `userId`, `usageDate`, `createdAt`
   - index for TTL cleanup on `createdAt`

3. **Atomic first-seen check** (no transaction):
   ```sql
   INSERT INTO api_autocomplete_sessions (...)
   VALUES (...)
   ON CONFLICT (session_token, billing_account_id) DO NOTHING
   RETURNING session_token;
   ```
   - **Row returned** → first sight of this token → call `recordUsage` (bill 1).
   - **No row** → already counted → record nothing.

4. **No-token requests** keep calling `recordUsage` exactly as today.

5. **Retention/cleanup.** Sessions are short-lived; a daily cron deletes rows
   older than e.g. 48h. Storage stays bounded; the dedup window comfortably
   exceeds any real session. (KV with native TTL is the alternative — see
   Option B.)

This requires **no change** to `meter-reporting.ts`: `apiUsageDaily` still only
increments, just far less often, and the Stripe meter keeps working unchanged.

### Pricing implication
One session ≈ one old request in unit terms, but ~10× fewer units per captured
address. **The per-unit price likely needs to rise to keep revenue neutral.**
This is a pricing/product decision, not an engineering one — flagged here as the
main reason this is approval-gated.

## Option B — Workers KV instead of a table
`KV.put(token, "1", { expirationTtl: 1800 })` after a `get` miss. Pros: native
TTL, no DDL, no cleanup cron. Cons: KV is eventually consistent (a burst of
keystrokes within the propagation window could double-count the first unit —
minor), and it splits billing state across two stores. Postgres (Option A) is
preferred for auditability and single-source-of-truth.

## Abuse / edge cases
- **Token reuse across addresses** — a client could reuse one token forever to
  pay once. Mitigate with a max session lifetime (count a new unit if the token
  is older than the TTL) and/or a max-requests-per-token soft cap.
- **Missing/forged token** — falls back to per-request billing; no worse than
  today.
- **Detail/select fetch** — Google bills the session at Place Details time. We
  have no equivalent "commit" call; first-keystroke billing is the pragmatic
  analogue. If a `getById`/select step is later treated as the commit, revisit.

## Out of scope
SDK/React changes — already shipped. This plan is **server-side only**.

## Open questions for sign-off
1. Approve the pricing change to keep revenue ~neutral? (blocking)
2. Postgres table (Option A) vs KV (Option B)?
3. Session TTL / max-requests cap values?
4. Should no-token requests eventually be deprecated, or stay per-request
   forever for non-interactive callers?

## Rollout (once approved)
1. Pricing decision + Stripe meter/price update.
2. DDL migration for `apiAutocompleteSessions` (DB approval).
3. Handler change behind a flag; shadow-count sessions vs requests in logs first.
4. Validate session-vs-request ratios on real traffic, then cut billing over.
5. E2E with the SDK `sessionToken` flow.
