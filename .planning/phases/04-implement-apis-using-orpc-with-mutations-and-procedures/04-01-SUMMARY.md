---
phase: 04-implement-apis-using-orpc-with-mutations-and-procedures
plan: 01
subsystem: api
tags: [orpc, tanstack-query, zod, api-explorer, rpc]

# Dependency graph
requires:
  - phase: 03-create-orpc-package-with-hono-server
    provides: oRPC package structure, procedures, context, app router
provides:
  - API explorer oRPC procedure (sendRequest) with auth and validation
  - TanStack Query utils (orpc) for type-safe cache key management
affects: [04-02, frontend-api-explorer-migration]

# Tech tracking
tech-stack:
  added: ["@orpc/tanstack-query"]
  patterns: [domain-router-with-inline-constants, tanstack-query-utils-pattern]

key-files:
  created:
    - packages/api/src/routers/domains/api-explorer.ts
  modified:
    - packages/api/src/routers/index.ts
    - apps/web/src/lib/orpc.ts

key-decisions:
  - "Inline endpoint config and auth constants in api-explorer.ts to avoid cross-package imports from apps/web"

patterns-established:
  - "Domain router with self-contained constants: constants duplicated in API package rather than importing from app layer"
  - "TanStack Query utils export: orpcClient for direct calls, orpc for query key management"

requirements-completed: [ORPC-01, ORPC-02]

# Metrics
duration: 1min
completed: 2026-04-15
---

# Phase 04 Plan 01: API Explorer Procedure and TanStack Query Utils Summary

**API explorer sendRequest oRPC procedure with Zod validation and managed/raw key auth, plus TanStack Query utils wired via createTanstackQueryUtils**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-15T06:38:14Z
- **Completed:** 2026-04-15T06:39:33Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created api-explorer domain router with sendRequest protected procedure supporting managed and raw API key auth modes
- Registered apiExplorerRouter in the app router
- Wired up createTanstackQueryUtils in orpc.ts for type-safe query key management

## Task Commits

Each task was committed atomically:

1. **Task 1: Create api-explorer oRPC procedure and register in app router** - `f4366f2` (feat)
2. **Task 2: Wire up TanStack Query utils in orpc.ts** - `ee2a03c` (feat)

## Files Created/Modified
- `packages/api/src/routers/domains/api-explorer.ts` - API explorer sendRequest procedure with Zod input validation, managed/raw key auth, endpoint config
- `packages/api/src/routers/index.ts` - Added apiExplorer domain to appRouter
- `apps/web/src/lib/orpc.ts` - Added createTanstackQueryUtils integration, exports orpc alongside orpcClient

## Decisions Made
- Inlined endpoint configuration and auth header constants in api-explorer.ts rather than importing from apps/web to maintain correct package dependency direction (packages should not import from apps)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data sources are wired to real implementations.

## Next Phase Readiness
- API explorer procedure ready for frontend migration from createServerFn to oRPC calls
- TanStack Query utils ready for use in all frontend data fetching

---
*Phase: 04-implement-apis-using-orpc-with-mutations-and-procedures*
*Completed: 2026-04-15*
