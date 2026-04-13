---
status: diagnosed
trigger: "sign-in shows no response and stays on the sign-in page"
created: 2026-04-14T00:00:00Z
updated: 2026-04-14T00:00:00Z
goal: find_root_cause_only
---

## Current Focus

hypothesis: LoginForm calls signIn.email() which sets the session cookie but never triggers navigation — no router.navigate() or router.invalidate() after successful sign-in
test: Checked login.tsx for any post-signin navigation logic
expecting: A call to router.navigate or router.invalidate after signIn.email resolves without error
next_action: report diagnosis

## Symptoms

expected: After signing in, user should be redirected to /dashboard
actual: No redirection, no error message, no response — page stays on sign-in
errors: None visible — session cookie IS set in dev console
reproduction: Submit valid credentials on /sign-in form
started: After BetterAuth migration (Phase 01)

## Eliminated

- hypothesis: signIn.email() is failing silently
  evidence: User confirmed session cookie IS being set, meaning backend auth succeeds
  timestamp: 2026-04-14

- hypothesis: callbackURL parameter triggers automatic redirect
  evidence: BetterAuth's signIn.email() callbackURL is for OAuth redirect flows only — for email/password it just returns the result and does NOT perform client-side navigation
  timestamp: 2026-04-14

## Evidence

- timestamp: 2026-04-14
  checked: apps/web/src/components/shadcn-space/blocks/login-03/login.tsx (entire file)
  found: handleSubmit calls signIn.email() with callbackURL, checks for error, but on SUCCESS does NOTHING — no navigate, no invalidate, no redirect. The success path falls through to finally block which just sets isSubmitting=false.
  implication: This is the root cause. After successful auth, the form resets its loading state and stays put.

- timestamp: 2026-04-14
  checked: apps/web/src/routes/_auth/sign-in.tsx
  found: beforeLoad checks context.isAuthenticated and redirects to /dashboard if true. But this only runs on route navigation — it does NOT re-run reactively after signIn.email() completes.
  implication: The route guard would redirect on a full page reload or fresh navigation, but since nothing triggers re-evaluation of the route after sign-in, it never fires.

- timestamp: 2026-04-14
  checked: apps/web/src/routes/__root.tsx (beforeLoad)
  found: Root beforeLoad calls fetchAuth() server function to get token, sets isAuthenticated in context. This runs once per navigation — NOT reactively when auth state changes client-side.
  implication: Even though the cookie is set, isAuthenticated in router context remains false until something triggers a re-navigation or router invalidation.

- timestamp: 2026-04-14
  checked: login.tsx for router usage
  found: No import of useRouter or useNavigate anywhere in the login component. Zero navigation logic exists.
  implication: Confirms the form was built without post-login navigation.

## Resolution

root_cause: |
  In apps/web/src/components/shadcn-space/blocks/login-03/login.tsx, the handleSubmit function (line 24-122) calls signIn.email() and handles errors, but the SUCCESS path (after line 95) has NO navigation logic.

  The callbackURL parameter passed to signIn.email() does NOT trigger client-side navigation for email/password sign-in — it is only used by OAuth redirect flows.

  Additionally, the TanStack Router context (isAuthenticated) is set in __root.tsx beforeLoad, which only re-evaluates on navigation events. Since no navigation is triggered after sign-in, the router never learns the user is now authenticated, and the _auth/sign-in.tsx beforeLoad guard never re-fires.

  Two things are missing:
  1. PRIMARY: After successful signIn.email() (no error), the form needs to call router.invalidate() to force the root beforeLoad to re-run (which will re-fetch auth state and set isAuthenticated=true), followed by router.navigate({ to: "/dashboard" }) — or just invalidate, since the _auth/sign-in.tsx beforeLoad will redirect automatically once isAuthenticated becomes true.
  2. SECONDARY: The same issue exists in the register form (register.tsx) and social sign-in handler.

fix: empty (diagnosis only)
verification: empty
files_changed: []
