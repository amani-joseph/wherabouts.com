---
status: diagnosed
trigger: "sign-up succeeds but doesn't redirect to the dashboard"
created: 2026-04-14T00:00:00Z
updated: 2026-04-14T00:00:00Z
---

## Current Focus

hypothesis: Both register.tsx and login.tsx pass `callbackURL` to BetterAuth client methods but never perform a client-side redirect after success. BetterAuth `signUp.email()` and `signIn.email()` for credential flows do NOT auto-redirect — `callbackURL` is only used by OAuth/social flows. The success path falls through to `finally { setIsSubmitting(false) }` with no navigation.
test: Confirmed by reading the code — no `router.navigate()`, `window.location`, or `redirect()` call exists on the success path
expecting: N/A — root cause confirmed by code inspection
next_action: Report diagnosis

## Symptoms

expected: After successful sign-up, user is redirected to /dashboard
actual: Sign-up succeeds (session cookie set), but user stays on sign-up page with no redirect
errors: None — no errors displayed
reproduction: Submit sign-up form with valid credentials
started: Since BetterAuth migration (Phase 01)

## Eliminated

(none needed — root cause found on first hypothesis)

## Evidence

- timestamp: 2026-04-14
  checked: apps/web/src/components/shadcn-space/blocks/register-03/register.tsx
  found: Lines 56-94 — `signUp.email()` is called with `callbackURL: "/dashboard"` but after the await resolves with no error, the code does NOTHING — it falls straight to the `finally` block which just sets `setIsSubmitting(false)`. No `window.location.href`, no `router.navigate()`, no TanStack `redirect()`.
  implication: This is the root cause. The success path is a no-op.

- timestamp: 2026-04-14
  checked: apps/web/src/components/shadcn-space/blocks/login-03/login.tsx
  found: Identical pattern — lines 57-95 have the same missing redirect after successful `signIn.email()`. Same bug affects sign-in too.
  implication: Both forms have the same defect.

- timestamp: 2026-04-14
  checked: BetterAuth client `signUp.email()` / `signIn.email()` behavior
  found: For credential-based (email/password) auth, BetterAuth does NOT perform automatic redirects. The `callbackURL` parameter is primarily used by OAuth flows where the server redirects. For email sign-up/sign-in, the client receives a response and it is the caller's responsibility to navigate.
  implication: `callbackURL` alone is insufficient for credential flows.

- timestamp: 2026-04-14
  checked: apps/web/src/routes/__root.tsx (line 62-68)
  found: Auth state (`isAuthenticated`) is determined in `beforeLoad` via a server function `fetchAuth()`. This runs on route transitions. Even if the session cookie is set, the router won't re-evaluate `isAuthenticated` until a navigation actually occurs.
  implication: Even after the cookie is set, nothing triggers the router to re-run beforeLoad and discover the user is now authenticated.

- timestamp: 2026-04-14
  checked: apps/web/src/routes/_auth/sign-up.tsx (lines 5-8)
  found: The `beforeLoad` guard redirects to `/dashboard` IF `context.isAuthenticated` is true. But this only runs on initial route load — it won't re-fire after the sign-up API call succeeds within the same page.
  implication: The route guard would work on a fresh navigation but not as an automatic post-signup redirect.

## Resolution

root_cause: Both `register.tsx` (line 89-94) and `login.tsx` (line 90-95) are missing a client-side redirect after successful credential auth. When `signUp.email()` or `signIn.email()` resolves without error, the code does nothing — it falls through to `finally { setIsSubmitting(false) }`. BetterAuth's `callbackURL` parameter does NOT trigger automatic client-side navigation for credential flows; it is the app's responsibility to navigate after success. Additionally, the TanStack Router auth context (`isAuthenticated`) is only evaluated during route transitions via `beforeLoad`, so even with the cookie set, the router won't know the user is authenticated until a navigation is triggered.
fix: (not applied — diagnosis only)
verification: (not applied — diagnosis only)
files_changed: []
