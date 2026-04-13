---
status: diagnosed
trigger: "Protected route guard blinks and stays on sign-in page without clean redirect"
created: 2026-04-14T00:00:00Z
updated: 2026-04-14T00:00:00Z
---

## Current Focus

hypothesis: Two root causes - (1) missing _auth layout route causes sign-in to not render, (2) getToken silently returns falsy on error causing redirect loop between root beforeLoad and _protected beforeLoad
test: Trace the redirect chain for unauthenticated user hitting /dashboard
expecting: Redirect lands on /sign-in but page may not render or may re-trigger root beforeLoad
next_action: Report diagnosis

## Symptoms

expected: Unauthenticated user navigating to /dashboard gets cleanly redirected to /sign-in and sees login form
actual: Page blinks and stays on sign-in page with no response and no error message
errors: None visible
reproduction: Open incognito, navigate to /dashboard
started: After BetterAuth migration (Phase 01)

## Eliminated

- hypothesis: beforeLoad not used for route guard
  evidence: _protected.tsx line 5 correctly uses beforeLoad with throw redirect
  timestamp: 2026-04-14

- hypothesis: Route tree misconfigured
  evidence: routeTree.gen.ts correctly wires _protected children and _auth/sign-in route
  timestamp: 2026-04-14

## Evidence

- timestamp: 2026-04-14
  checked: _protected.tsx route guard
  found: Uses beforeLoad correctly - checks context.isAuthenticated, throws redirect to /sign-in
  implication: Guard mechanism is correct for TanStack Start

- timestamp: 2026-04-14
  checked: __root.tsx beforeLoad
  found: Calls fetchAuth() server fn which calls getToken(). Sets isAuthenticated = !!token. This runs on EVERY navigation including the redirect to /sign-in.
  implication: If getToken() fails or throws during redirect to /sign-in, the root beforeLoad could error silently

- timestamp: 2026-04-14
  checked: auth-server.ts getSession and getToken
  found: getSession fetches from convexSiteUrl /api/auth/get-session. If response is not ok, returns null. getToken comes from convexBetterAuthReactStart.
  implication: For incognito users with no cookies, get-session returns null -> token is null -> isAuthenticated is false. This is correct.

- timestamp: 2026-04-14
  checked: _auth layout route file
  found: NO _auth.tsx layout file exists. The routes/_auth/ directory has sign-in.tsx and sign-up.tsx but there is no parent layout route at routes/_auth.tsx
  implication: CRITICAL - TanStack Router pathless layout routes require a layout file. Without _auth.tsx, the _auth/sign-in route has no layout wrapper. The route IS registered in routeTree.gen.ts with parent as rootRouteImport (not an _auth layout), so it should still render. However, this is unusual.

- timestamp: 2026-04-14
  checked: sign-in route beforeLoad
  found: _auth/sign-in.tsx has its OWN beforeLoad that checks if context.isAuthenticated and redirects to /dashboard if true. For unauthenticated users this should be a no-op.
  implication: No circular redirect for unauth users - isAuthenticated is false, so sign-in beforeLoad does nothing.

- timestamp: 2026-04-14
  checked: Root beforeLoad error handling
  found: fetchAuth() calls getToken() with NO try-catch. If getToken() throws (e.g., getRequestHeaders() fails during client-side navigation, or the Convex site URL is unreachable), the entire navigation will fail silently.
  implication: ROOT CAUSE CANDIDATE - If getToken() throws during the redirect navigation to /sign-in, TanStack Router may catch the error internally, causing the "blink" with no visible error.

- timestamp: 2026-04-14
  checked: getToken origin - convexBetterAuthReactStart
  found: getToken is from @convex-dev/better-auth/react-start. It likely calls getRequestHeaders() internally. On client-side navigations (SPA transitions), getRequestHeaders() may not have proper request context.
  implication: The fetchAuth server function uses createServerFn({method:"GET"}) which should work for both SSR and client-side calls. But if the Convex site URL is misconfigured or the auth endpoint is down, it will throw.

## Resolution

root_cause: |
  PRIMARY: The root beforeLoad (__root.tsx line 62-68) calls fetchAuth() -> getToken() with NO error handling.
  If getToken() throws (network error to Convex auth endpoint, missing/invalid VITE_CONVEX_SITE_URL, or
  getRequestHeaders() issues during client-side navigation), the navigation fails silently.
  TanStack Router catches the thrown error internally, causing the page to "blink" and stay put.

  SECONDARY: There is no _auth.tsx layout route file, though this alone would not cause the blink -
  the routes are correctly registered as direct children of root in routeTree.gen.ts.

  The redirect chain for an unauthenticated user is:
  1. Navigate to /dashboard
  2. Root beforeLoad runs -> fetchAuth() -> getToken() -> returns null (no session) -> isAuthenticated = false
  3. _protected beforeLoad runs -> !isAuthenticated -> throw redirect({to: "/sign-in"})
  4. Router navigates to /sign-in
  5. Root beforeLoad runs AGAIN for /sign-in -> fetchAuth() -> getToken()
  6. If step 5 throws (or is slow/hanging), the redirect never completes -> blink + stuck

  The "blink" pattern (renders briefly then stays) confirms the issue is in the redirect TARGET's
  beforeLoad (step 5-6), not in the guard itself (step 2-3).

fix:
verification:
files_changed: []
