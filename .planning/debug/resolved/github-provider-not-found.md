---
status: resolved
trigger: "After deploying both app (web) and server, clicking 'Sign in with GitHub' produces a 'Provider not found' error."
created: 2026-04-16T00:00:00Z
updated: 2026-04-16T00:00:00Z
---

## Current Focus

hypothesis: GitHub social provider config is uncommitted and CF Worker secrets are missing
test: Verified via git history and wrangler secret list
expecting: Committing auth.ts + setting CF secrets resolves the error
next_action: Apply fix — commit auth.ts changes, add .dev.vars entries, prompt user to set CF secrets

## Symptoms

expected: GitHub OAuth login should redirect to GitHub and complete authentication
actual: "Provider not found" error when trying to sign in with GitHub
errors: "Provider not found" (Better Auth PROVIDER_NOT_FOUND)
reproduction: Deploy app and server, click "Sign in with GitHub" button
started: After adding GitHub social provider to auth config (uncommitted change)

## Eliminated

- hypothesis: Better Auth client needs social provider plugin
  evidence: signIn.social() is a built-in method on the base client, no plugin needed
  timestamp: 2026-04-16

- hypothesis: Auth route proxy misconfiguration
  evidence: auth-client.ts points directly to server URL, not through web proxy; server Hono routes /api/auth/* to auth.handler correctly
  timestamp: 2026-04-16

- hypothesis: Better Auth doesn't support "github" as a provider key
  evidence: @better-auth/core/dist/social-providers/github.mjs exists; socialProviders["github"] is valid
  timestamp: 2026-04-16

## Evidence

- timestamp: 2026-04-16
  checked: CF Worker secrets via `wrangler secret list`
  found: Only BETTER_AUTH_SECRET and DATABASE_URL are set. GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are NOT set.
  implication: Even if code is deployed, Better Auth won't have valid GitHub credentials.

- timestamp: 2026-04-16
  checked: git log for packages/api/src/auth.ts
  found: Last commit (9cd53bd) does NOT have socialProviders block. Current working tree has it as uncommitted change.
  implication: The deployed server has no social providers configured at all.

- timestamp: 2026-04-16
  checked: apps/server/.dev.vars
  found: Missing GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET entries
  implication: Local dev would also fail (or crash due to Zod validation) once env schema changes are deployed.

- timestamp: 2026-04-16
  checked: Better Auth source code (sign-in.mjs line 79-82)
  found: getAwaitableValue looks up provider by id in socialProviders array. If not found, throws PROVIDER_NOT_FOUND.
  implication: Server-side error confirms socialProviders array is empty (no providers configured in deployed code).

## Resolution

root_cause: Two-part issue — (1) socialProviders.github config in packages/api/src/auth.ts is uncommitted/undeployed, so deployed server has zero social providers; (2) CF Worker secrets GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are not set, so even after deploy the provider would lack valid credentials.
fix: Commit auth.ts with socialProviders.github config. User must set CF Worker secrets before deploying.
verification: auth.ts committed (a00e79f) with socialProviders.github config; CF Worker secrets confirmed set by user
files_changed:
  - packages/api/src/auth.ts (already modified, needs commit)
  - apps/server/.dev.vars (needs GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET for local dev)
