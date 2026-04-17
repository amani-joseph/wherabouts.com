---
status: awaiting_human_verify
trigger: "sign-in-page-shows-email-only-no-github"
created: 2026-04-17T00:00:00Z
updated: 2026-04-17T00:03:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — two distinct bugs found and fixed.
  1. Cookie attrs unconditional (sameSite:none+secure:true in dev) — already fixed in prior session.
  2. login.tsx was never made GitHub-only despite commit 95bb023 claiming so — email form present in both HEAD and working tree. Working tree also had a hardcoded prod callbackURL in handleSocialSignIn.
  3. emailAndPassword: { enabled: true } in auth config caused 500 on /api/auth/sign-in/email.
test: All three fixes applied. User restarts pnpm dev and retries GitHub sign-in.
expecting: Only GitHub button shown; clicking it completes OAuth and redirects to /dashboard
next_action: await human verification

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Sign-in page shows a "Sign in with GitHub" button that completes an OAuth flow.
actual: Sign-in page shows only a "Sign in with email" option, and submitting the email form doesn't work (no clear error described).
errors: User didn't paste a console error — capture them during investigation.
reproduction: pnpm dev from repo root, visit the sign-in route in a browser.
started: Observed right after executing phase 07 (auth extracted into its own package). May have been latent before or introduced by the refactor.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: login.tsx component is missing the GitHub button
  evidence: login.tsx already has a correct "Sign in with GitHub" button calling handleSocialSignIn("github") — component is not the issue
  timestamp: 2026-04-17T00:01:00Z

- hypothesis: auth-client.ts has wrong baseURL or missing credentials
  evidence: auth-client.ts correctly points to http://localhost:3003 in dev and includes credentials:"include" — client config is not the issue
  timestamp: 2026-04-17T00:01:00Z

- hypothesis: socialProviders.github missing from new packages/auth/src/index.ts
  evidence: github social provider is present in packages/auth/src/index.ts — provider config is not the issue
  timestamp: 2026-04-17T00:01:00Z

- hypothesis: login.tsx was rewritten to GitHub-only by commit 95bb023
  evidence: git show HEAD:login.tsx contains full email+password form — the commit claim was inaccurate. The "GitHub-only" intent was never actually implemented in the file.
  timestamp: 2026-04-17T00:03:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-17T00:01:00Z
  checked: packages/auth/src/index.ts (current) vs git show HEAD:packages/api/src/auth.ts (original)
  found: The phase 07 move dropped the IS_PRODUCTION constant and made cookie attrs unconditional — sameSite:"none" and secure:true in both dev and prod.
  implication: Browsers refuse to set sameSite:"none" cookies over plain HTTP (localhost). OAuth state cookie and session cookie are never stored, so the GitHub redirect comes back with no valid state and auth fails silently. Email form submissions also fail for the same reason (session cookie not set).

- timestamp: 2026-04-17T00:01:00Z
  checked: apps/web/src/routes/_auth/sign-in.tsx
  found: Route correctly imports and renders LoginForm from login.tsx. No conditional rendering — GitHub button is always shown.
  implication: UI "email only" symptom is explained by the GitHub OAuth flow failing immediately and the user perceiving only the email form as functional.

- timestamp: 2026-04-17T00:03:00Z
  checked: git show HEAD:apps/web/src/components/shadcn-space/blocks/login-03/login.tsx
  found: HEAD still has full email+password form. The working tree's callbackURL change (window.location.origin vs hardcoded prod URL) was actually correct. The email form existed in both HEAD and working tree.
  implication: 500 on POST /api/auth/sign-in/email is explained by emailAndPassword: { enabled: true } in packages/auth/src/index.ts — the server was accepting email sign-in calls but apparently crashing internally (likely DB or missing email sender).

- timestamp: 2026-04-17T00:03:00Z
  checked: POST http://localhost:3003/api/auth/sign-in/email 500 (user-reported)
  found: emailAndPassword was enabled in auth config. Since intent is GitHub-only, the correct fix is to remove it rather than debug why it crashes.
  implication: Removing emailAndPassword from config eliminates the endpoint entirely (404 instead of 500) and aligns server with intended GitHub-only auth.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Three compounding bugs:
  1. (Prior session) Phase 07 dropped IS_PRODUCTION guard — sameSite:none+secure:true in dev breaks cookie storage over http.
  2. Commit 95bb023 claimed to make login GitHub-only but never actually rewrote login.tsx — the email form remained in both HEAD and working tree.
  3. emailAndPassword: { enabled: true } in auth config caused the 500 on POST /api/auth/sign-in/email — the server accepted the call but crashed (likely missing email sender or DB issue); removing it is correct since intent is GitHub-only.
fix:
  1. (Prior session) Restored IS_PRODUCTION conditional in packages/auth/src/index.ts.
  2. Rewrote apps/web/src/components/shadcn-space/blocks/login-03/login.tsx to GitHub-only: removed email form, handleSubmit, all email state, and unused imports. callbackURL uses window.location.origin (correct for both dev and prod).
  3. Removed emailAndPassword: { enabled: true } from packages/auth/src/index.ts.
verification: awaiting user confirmation
files_changed: [packages/auth/src/index.ts, apps/web/src/components/shadcn-space/blocks/login-03/login.tsx]
