---
phase: 06-mirror-cloudflare-deployment-configurations-from-mydeffo-com-web
plan: 01
subsystem: env, dependencies
tags: [cloudflare-workers, env-loading, dependency-cleanup]
dependency_graph:
  requires: []
  provides: [worker-compatible-env, clean-dependencies]
  affects: [packages/env, apps/web]
tech_stack:
  added: []
  patterns: [dotenv-config-side-effect-import]
key_files:
  created: []
  modified:
    - packages/env/src/server.ts
    - apps/web/package.json
    - package.json
    - pnpm-lock.yaml
decisions:
  - "Use import \"dotenv/config\" side-effect pattern instead of filesystem env walking -- harmless no-op on Workers, loads .env locally"
  - "Remove @neondatabase/serverless from root package.json since it is only consumed by packages/database"
metrics:
  duration: 20min
  completed: 2026-04-17
---

# Phase 06 Plan 01: Worker-Compatible Env Loading and Dependency Cleanup Summary

Worker-compatible env loading via dotenv/config side-effect import, plus removal of 7 dead dependencies from apps/web and root package.json.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace filesystem env loader with dotenv/config pattern | 72c69ad | packages/env/src/server.ts |
| 2 | Remove dead and unnecessary dependencies from apps/web | b0a51dc | apps/web/package.json, package.json, pnpm-lock.yaml |

## Changes Made

### Task 1: Worker-Compatible Env Loading
- Removed `node:fs` (existsSync) and `node:path` imports from server.ts
- Removed `resolveEnvSearchRoots()` and `loadWorkspaceEnv()` functions (53 lines deleted)
- Replaced with single `import "dotenv/config"` side-effect import
- Added `AUTH_COOKIE_DOMAIN: z.string().optional()` to server env schema (needed by Plan 03)
- Kept `WEB_BASE_URL` fallback for local dev compatibility

### Task 2: Dead Dependency Removal
Removed from apps/web dependencies:
- `next` (16.1.1) -- wrong framework, not imported anywhere
- `@neondatabase/serverless` (^1.0.2) -- belongs in packages/database only

Removed from apps/web devDependencies:
- `eslint-config-next` (16.0.3) -- pairs with next
- `@tailwindcss/postcss` (^4) -- unnecessary with @tailwindcss/vite
- `autoprefixer` (^10.4.22) -- unnecessary with Tailwind v4 Vite
- `postcss` (^8.5.6) -- unnecessary with Tailwind v4 Vite

Removed from root package.json:
- `@neondatabase/serverless` (^1.0.2) -- only used in packages/database

Lockfile reduced by ~1888 lines.

## Decisions Made

1. **dotenv/config side-effect pattern**: On Cloudflare Workers, `dotenv/config` is a harmless no-op (no .env file), while `nodejs_compat_populate_process_env` ensures wrangler vars/secrets populate process.env. Locally, it loads .env from cwd.
2. **Root @neondatabase/serverless removal**: Only `packages/database/src/client.ts` imports it, so the root dependency was redundant.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Removed @neondatabase/serverless from root package.json**
- **Found during:** Task 2
- **Issue:** Plan mentioned checking root for this dep. It was present and redundant.
- **Fix:** Removed it since only packages/database uses it.
- **Files modified:** package.json
- **Commit:** b0a51dc

## Known Stubs

None -- no stubs introduced.

## Verification

- `packages/env/src/server.ts` contains 0 references to node:fs or node:path
- `packages/env/src/server.ts` contains `import "dotenv/config"` and `AUTH_COOKIE_DOMAIN`
- `apps/web/package.json` contains 0 references to next, eslint-config-next, @tailwindcss/postcss, autoprefixer, postcss, @neondatabase/serverless
- `pnpm install` completed successfully
