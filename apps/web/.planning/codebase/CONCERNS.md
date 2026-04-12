# Codebase Concerns

**Analysis Date:** 2026-04-12

## Tech Debt

**Hardcoded Mock Data in Dashboard Pages:**
- Issue: Multiple protected routes render entirely static/hardcoded data instead of fetching from the backend. These pages look functional but are non-interactive shells.
- Files:
  - `src/routes/_protected/analytics.tsx` - Stats, endpoint usage, and recent activity are all hardcoded constants (lines 28-78)
  - `src/routes/_protected/billing.tsx` - Plans, invoices, payment methods are all hardcoded (lines 23-71)
  - `src/routes/_protected/projects.tsx` - Project list is a hardcoded array (lines 22-55)
  - `src/routes/_protected/team.tsx` - Team members are hardcoded except the current user's name (lines 24-50)
  - `src/routes/_protected/integrations.tsx` - Integration list is hardcoded (lines 18-61)
  - `src/routes/_protected/help.tsx` - FAQ and categories are hardcoded (lines 25-73)
- Impact: Users see realistic-looking UI that does nothing. Buttons like "Save Changes", "Invite Member", "Connect", "Upgrade", "Delete Account", "Contact Support" have no handlers. This creates a misleading user experience.
- Fix approach: Either implement backend functionality for each page, or clearly mark them as "Coming Soon" with disabled states. Prioritize settings.tsx (has a "Delete Account" button with no confirmation or handler) and billing.tsx (shows fake payment info).

**Settings Page Is Entirely Non-Functional:**
- Issue: The settings page at `src/routes/_protected/settings.tsx` renders form inputs (name, workspace, timezone) with `defaultValue` props but no `onChange` handlers, no form submission logic, and no server functions. The "Save Changes" button does nothing. Notification toggles use `defaultChecked` with no persistence. The "Delete Account" button has no handler.
- Files: `src/routes/_protected/settings.tsx`
- Impact: Users may attempt to change settings and believe they saved, only to find nothing persisted. The "Delete Account" button is especially dangerous as a placeholder since it sets user expectations.
- Fix approach: Either wire up Clerk user profile updates for profile tab, implement notification preference storage, or remove/disable the settings page until ready.

**Hardcoded Plan Limit in Dashboard:**
- Issue: `PLAN_LIMIT` is hardcoded to `100_000` at `src/routes/_protected/dashboard.tsx` (line 32). The billing page shows different plan tiers (1,000 / 100,000 / unlimited) but the dashboard always shows 100K as the limit.
- Files: `src/routes/_protected/dashboard.tsx`
- Impact: Usage percentage shown to users will be wrong for Free-tier (1,000 limit) and Enterprise (unlimited) users.
- Fix approach: Fetch the user's actual plan limit from the backend and pass it into the dashboard stats.

**Duplicate `API_KEY_PREFIX` Constants:**
- Issue: The `API_KEY_PREFIX` string `"wh_"` is defined in two separate files with no shared source of truth.
- Files:
  - `src/lib/api-key-auth.ts` (line 6)
  - `src/lib/api-keys-server.ts` (line 14)
- Impact: If the prefix changes, one file could be updated while the other is missed, causing key generation/validation mismatch.
- Fix approach: Export `API_KEY_PREFIX` from `api-key-auth.ts` only and import it in `api-keys-server.ts`. Note: `api-key-auth.ts` already exports it (line 167), so `api-keys-server.ts` should import from there instead of re-declaring.

**`next` Listed as a Dependency in a TanStack Start Project:**
- Issue: `package.json` includes `"next": "16.1.1"` and `"eslint-config-next"` as dependencies, but this project uses TanStack Start (Vite-based SSR), not Next.js. No Next.js files or imports exist in the codebase.
- Files: `package.json` (lines 39-40, 62)
- Impact: Unnecessary ~15MB+ dependency bloating `node_modules`. Could cause confusion about which framework is in use. `eslint-config-next` rules may conflict with the actual stack.
- Fix approach: Remove `next`, `eslint-config-next`, and `next-themes` from `package.json`. If dark mode toggling is needed, implement it without the Next.js-specific `next-themes` package.

**Duplicate Animation Libraries:**
- Issue: Both `framer-motion` (v12.23.24) and `motion` (v12.38.0) are listed as dependencies. `motion` is the renamed successor of `framer-motion` -- having both is redundant.
- Files: `package.json` (lines 36-38)
- Impact: Bundle size inflation. Risk of importing from the wrong package in different components.
- Fix approach: Standardize on `motion` (the newer package) and remove `framer-motion`. Update any imports accordingly.

## Security Considerations

**No Rate Limiting on API Endpoints:**
- Risk: The API routes at `src/routes/api/v1/addresses/` authenticate via API key but have no rate limiting. A valid API key can make unlimited requests.
- Files:
  - `src/lib/with-api-key.ts`
  - `src/routes/api/v1/addresses/autocomplete.ts`
  - `src/routes/api/v1/addresses/reverse.ts`
  - `src/routes/api/v1/addresses/nearby.ts`
  - `src/routes/api/v1/addresses/$id.ts`
- Current mitigation: Usage is tracked in `apiUsageDaily` table via `recordUsage()` in `src/lib/api-key-auth.ts`, but it is never checked against a limit before serving the response. The billing page references plan limits but enforcement does not exist.
- Recommendations: Add rate limiting middleware in `withApiKeyGET()` that checks `apiUsageDaily` counts against the user's plan limit before processing the request. Return HTTP 429 when exceeded.

**No CORS Headers on API Endpoints:**
- Risk: API endpoints return plain `Response.json()` without CORS headers. Browser-based API consumers will be blocked by same-origin policy. Server-to-server is fine but client-side SDK use is prevented.
- Files: `src/routes/api/v1/addresses/*.ts`, `src/lib/with-api-key.ts`
- Current mitigation: None
- Recommendations: Add appropriate `Access-Control-Allow-Origin` headers in `withApiKeyGET()` or via a middleware layer. Consider an OPTIONS handler for preflight requests.

**Silent Error Swallowing in Usage Recording:**
- Risk: In `src/lib/with-api-key.ts` (lines 33-39), usage recording failures are silently caught with an empty `.catch(() => {})`. If the database is down or the usage table has issues, no one will know.
- Files: `src/lib/with-api-key.ts`
- Current mitigation: The comment says "Usage accounting must not fail the client response" which is correct, but there is no logging.
- Recommendations: Add structured logging in the catch block so usage recording failures are observable.

**Silent Error Swallowing in Dashboard:**
- Risk: `src/routes/_protected/dashboard.tsx` (lines 339-341) has an empty `catch` block when fetching dashboard stats. If the server function fails, the user sees nothing with no error indication.
- Files: `src/routes/_protected/dashboard.tsx`
- Current mitigation: None
- Recommendations: Set an error state and show an error message to the user, similar to how `src/routes/_protected/api-keys.tsx` handles errors.

**TanStack Router Devtools Shipped Unconditionally:**
- Risk: `TanStackRouterDevtools` is rendered in the root layout without any environment check.
- Files: `src/routes/__root.tsx` (line 111)
- Current mitigation: None -- devtools render in production builds.
- Recommendations: Wrap in a lazy-loaded component gated by `import.meta.env.DEV`, or use the `@tanstack/react-router-devtools` lazy import pattern.

**`listApiKeys` Returns Empty Array for Unauthenticated Users Instead of Error:**
- Risk: `src/lib/api-keys-server.ts` (lines 39-42) returns `[]` when `userId` is null, rather than throwing an error. This means an unauthenticated request silently succeeds with empty data rather than getting a 401.
- Files: `src/lib/api-keys-server.ts`
- Current mitigation: The `/_protected` route layout redirects unauthenticated users, so this path is unlikely to be hit in the UI. But the server function itself is callable directly.
- Recommendations: Throw an `Unauthorized` error consistently, matching `createApiKey` and `revokeApiKey` which already throw.

## Performance Bottlenecks

**Synchronous `scryptSync` for API Key Validation:**
- Problem: Every API request runs `scryptSync()` which is CPU-blocking. Under load, this blocks the Node.js event loop.
- Files: `src/lib/api-key-auth.ts` (line 82)
- Cause: `scryptSync` is the synchronous variant of the crypto scrypt function. With the configured parameters (N=16384, r=8, p=1), each call takes ~50-100ms of CPU time.
- Improvement path: Replace `scryptSync` with the async `scrypt` from `node:crypto` (callback-based) or use `util.promisify(scrypt)`. This allows the event loop to handle other requests during key derivation.

**Dashboard Fetches Data Client-Side After Mount:**
- Problem: The dashboard component fetches stats via `useEffect` after mounting, causing a loading skeleton flash on every navigation.
- Files: `src/routes/_protected/dashboard.tsx` (lines 335-348)
- Cause: Data is fetched imperatively with `useEffect` + `useState` instead of using TanStack Router's `loader` or `beforeLoad` for server-side data fetching.
- Improvement path: Move `getDashboardStats()` into the route's `loader` function so data is fetched before the component renders. Same applies to `src/routes/_protected/api-keys.tsx` (lines 278-292).

**API Routes Select All Columns for Address By ID:**
- Problem: `src/routes/api/v1/addresses/$id.ts` uses `db.select()` with no column selection, which fetches every column including the `geom` geometry column (potentially large binary data).
- Files: `src/routes/api/v1/addresses/$id.ts` (line 19)
- Cause: Using `.select()` without specifying columns defaults to `SELECT *`.
- Improvement path: Specify explicit columns like the other API endpoints do (`reverse.ts`, `nearby.ts`).

## Fragile Areas

**API Key Revocation Race Condition in UI:**
- Files: `src/routes/_protected/api-keys.tsx` (lines 86-95)
- Why fragile: The `KeyRow` component's `handleRevoke` function calls `onRevoke(apiKey.id)` but wraps it in try/finally without awaiting the parent's async operation. The `setRevoking(false)` fires immediately, not after the revoke completes.
- Safe modification: Make `onRevoke` return a promise and `await` it: `await onRevoke(apiKey.id)`.
- Test coverage: No tests exist.

**Database Singleton Without Connection Cleanup:**
- Files: `src/lib/db.ts`
- Why fragile: The module-level `db` singleton is created lazily but never closed. In serverless environments (e.g., Vercel Edge), this could lead to connection pool exhaustion. The singleton also means connection errors on startup are cached permanently.
- Safe modification: Consider using the `@neondatabase/serverless` driver's connection pooling or a per-request connection pattern.
- Test coverage: No tests exist.

## Test Coverage Gaps

**Zero Test Files:**
- What's not tested: The entire codebase has zero test files. No `.test.ts`, `.test.tsx`, `.spec.ts`, or `.spec.tsx` files exist anywhere in `apps/web/`.
- Files: All of `src/`
- Risk: Any refactoring or new feature has no safety net. Critical paths especially at risk:
  - API key hashing and validation (`src/lib/api-key-auth.ts`) -- cryptographic logic that is easy to break silently
  - API endpoint input validation (`src/routes/api/v1/addresses/*.ts`) -- boundary conditions, SQL injection via raw `sql` template tags
  - Auth guard (`src/routes/_protected.tsx`) -- redirect logic for unauthenticated users
  - Server functions (`src/lib/api-keys-server.ts`, `src/lib/dashboard-server.ts`) -- database interaction and auth checks
- Priority: High -- especially for `api-key-auth.ts` (crypto correctness) and API routes (public-facing endpoints)

## Dependencies at Risk

**TanStack Start at v1.141.1 (Pre-Stable):**
- Risk: TanStack Start is pre-1.0-stable with frequent breaking changes. The server handler API (`server: { handlers: { GET: ... } }`) may change.
- Impact: Major version updates could require rewriting all API routes and server functions.
- Migration plan: Pin versions carefully and test upgrades in isolation. Monitor the TanStack Start changelog.

**`@dnd-kit` Packages Likely Unused:**
- Risk: `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` are in dependencies but no component in `src/` imports from them.
- Impact: Unnecessary bundle size and maintenance burden.
- Migration plan: Remove from `package.json` if confirmed unused.

## Missing Critical Features

**No API Rate Limiting Enforcement:**
- Problem: The billing page shows plan limits (1K/100K/unlimited) but nothing enforces them. Users on the Free plan can make unlimited requests.
- Blocks: Monetization -- cannot charge for overages or enforce plan tiers.

**No Error Monitoring or Logging Infrastructure:**
- Problem: No error tracking service (Sentry, etc.) and no structured logging. Errors in API routes and server functions are either silently swallowed or thrown without capture.
- Blocks: Ability to diagnose production issues, track error rates, or alert on failures.

---

*Concerns audit: 2026-04-12*
