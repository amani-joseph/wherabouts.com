---
status: complete
phase: 01-betterauth-infrastructure
plan: 02
started: 2026-04-14
completed: 2026-04-14
---

## Summary

Wired BetterAuth into the TanStack Start frontend: created auth client/server modules, added the API proxy route, swapped ClerkProvider for ConvexBetterAuthProvider, updated route guard, and configured env vars.

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Create auth modules, proxy route, env var, and Vite SSR config | complete |
| 2 | Swap root route provider and update route guard | complete |
| 3 | Verify BetterAuth infrastructure end-to-end | complete |

## Key Files

### Created
- `apps/web/src/lib/auth-client.ts` — BetterAuth client with convexClient plugin
- `apps/web/src/lib/auth-server.ts` — convexBetterAuthReactStart helpers
- `apps/web/src/routes/api/auth/$.ts` — Auth proxy route

### Modified
- `apps/web/src/routes/__root.tsx` — Swapped ClerkProvider for ConvexBetterAuthProvider
- `apps/web/src/routes/_protected.tsx` — Updated route guard to use isAuthenticated
- `apps/web/vite.config.ts` — Added SSR noExternal for @convex-dev/better-auth
- `packages/env/src/web.ts` — Added VITE_CONVEX_SITE_URL env var
- `packages/backend/convex/auth.ts` — Added trustedOrigins config

## Deviations

- Import path `@convex-dev/better-auth/client` does not exist in v0.11.4; corrected to `@convex-dev/better-auth/client/plugins`
- Added `trustedOrigins` to BetterAuth config to fix INVALID_ORIGIN error
- Convex env vars (VITE_CONVEX_SITE_URL, BETTER_AUTH_URL, BETTER_AUTH_SECRET) needed to be set on deployment

## Self-Check: PASSED

- Sign-up returns user object and token
- Sign-in returns user object and session token
- Auth proxy route forwards requests to Convex site URL
- Protected routes use isAuthenticated guard
