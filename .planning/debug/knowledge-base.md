# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## github-provider-not-found — Better Auth "Provider not found" due to uncommitted socialProviders config and missing CF Worker secrets
- **Date:** 2026-04-16
- **Error patterns:** Provider not found, PROVIDER_NOT_FOUND, socialProviders, github, sign-in social
- **Root cause:** socialProviders.github block in auth.ts was only in the working tree (never committed/deployed), and CF Worker secrets GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET were not set
- **Fix:** Committed auth.ts with socialProviders.github config; user set CF Worker secrets via `wrangler secret put`
- **Files changed:** packages/api/src/auth.ts
---
