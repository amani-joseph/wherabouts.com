---
phase: quick
plan: 260416-qlh
subsystem: auth
tags: [oauth, github, env-validation, ui-cleanup]
dependency_graph:
  requires: []
  provides: [github-oauth-env-validation]
  affects: [auth-config, login-ui, register-ui]
tech_stack:
  added: []
  patterns: [t3-env-zod-validation]
key_files:
  created: []
  modified:
    - packages/env/src/server.ts
    - apps/web/src/components/shadcn-space/blocks/login-03/login.tsx
    - apps/web/src/components/shadcn-space/blocks/register-03/register.tsx
decisions: []
metrics:
  duration: 1min
  completed: "2026-04-16T09:12:18Z"
---

# Quick Task 260416-qlh: Check and Configure Better Auth GitHub Social Provider

GitHub OAuth env vars added to Zod server schema for fail-fast validation; Google sign-in buttons removed from login/register UI since no Google provider is configured.

## Task Summary

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add GitHub OAuth env vars to server env schema | dc2994a | packages/env/src/server.ts |
| 2 | Remove Google OAuth buttons from login and register forms | 7e6f6d4 | login.tsx, register.tsx |

## What Changed

### Task 1: Server Env Schema
Added `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` with `z.string().min(1)` validation to the `createEnv` server schema. The `runtimeEnv` already spreads `...process.env`, so no additional mapping was needed. The app now fails fast at startup if these credentials are missing.

### Task 2: Remove Google OAuth UI
Removed the Google sign-in/sign-up buttons from both `login.tsx` and `register.tsx`. Narrowed the `socialProvider` state type from `"google" | "github" | null` to `"github" | null`. Changed the `handleSocialSignIn` parameter type accordingly. Simplified the divider text from "or sign in/up with" to "or". Removed the wrapping grid div since only one button remains.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Verification

- `packages/env/src/server.ts` contains both `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in Zod schema
- `packages/api/src/auth.ts` references `serverEnv.GITHUB_CLIENT_ID` and `serverEnv.GITHUB_CLIENT_SECRET` (unchanged, already correct)
- Zero references to "google" remain in login.tsx and register.tsx
- All modified files pass `ultracite check`

## Self-Check: PASSED
