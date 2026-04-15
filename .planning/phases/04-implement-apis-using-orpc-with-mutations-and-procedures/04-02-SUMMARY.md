---
phase: 04-implement-apis-using-orpc-with-mutations-and-procedures
plan: 02
subsystem: api
tags: [orpc, tanstack-start, createServerFn, refactor, client-migration]

requires:
  - phase: 04-implement-apis-using-orpc-with-mutations-and-procedures
    plan: 01
    provides: oRPC routers, orpcClient, and orpc TanStack Query utils

provides:
  - All route components fetch data via orpcClient directly
  - Zero thin wrapper files remain (dashboard-server, api-keys-server, projects-server, api-explorer-server deleted)
  - Only createServerFn usage is fetchSession in __root.tsx (SSR optimization)

affects: []

tech-stack:
  added: []
  patterns:
    - "Inferred types from orpcClient via Awaited<ReturnType<...>> instead of manually defined interfaces"
    - "Direct orpcClient calls from components without intermediate wrapper layer"

key-files:
  created: []
  modified:
    - apps/web/src/components/api-explorer.tsx
    - apps/web/src/routes/_protected/dashboard.tsx
    - apps/web/src/routes/_protected/analytics.tsx
    - apps/web/src/routes/_protected/api-keys.tsx
    - apps/web/src/routes/_protected/projects.tsx

key-decisions:
  - "Use Awaited<ReturnType<...>> for type inference from orpcClient instead of duplicating interface definitions"

patterns-established:
  - "Direct orpcClient usage: components import orpcClient from @/lib/orpc and call procedures directly"

requirements-completed: [ORPC-03, ORPC-04]

duration: 4min
completed: 2026-04-15
---

# Phase 04 Plan 02: Remove Thin Wrappers Summary

**Eliminated all thin wrapper files and migrated every consumer to direct orpcClient calls, leaving fetchSession as the only createServerFn in the codebase**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-15T06:41:37Z
- **Completed:** 2026-04-15T06:45:43Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Migrated api-explorer component from createServerFn-based sendApiExplorerRequest to orpcClient.apiExplorer.sendRequest
- Migrated dashboard, analytics, api-keys, and projects routes from thin wrappers to direct orpcClient calls
- Removed all { data: { ... } } nesting patterns (createServerFn artifact) in favor of direct oRPC input
- Deleted 4 thin wrapper files (dashboard-server.ts, api-keys-server.ts, projects-server.ts, api-explorer-server.ts)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate api-explorer component and remove api-explorer-server.ts** - `ec18910` (feat)
2. **Task 2: Remove remaining thin wrappers and update all consumers** - `6764b44` (feat)

## Files Created/Modified

- `apps/web/src/components/api-explorer.tsx` - Uses orpcClient.apiExplorer.sendRequest and orpcClient.apiKeys.list
- `apps/web/src/routes/_protected/dashboard.tsx` - Uses orpcClient.dashboard.getStats directly
- `apps/web/src/routes/_protected/analytics.tsx` - Uses orpcClient.dashboard.getStats directly
- `apps/web/src/routes/_protected/api-keys.tsx` - Uses orpcClient.apiKeys.list/create/revoke directly
- `apps/web/src/routes/_protected/projects.tsx` - Uses orpcClient.projects.list/create/assignApiKey/listApiKeyOptions directly

## Decisions Made

- Used `Awaited<ReturnType<typeof orpcClient.X.Y>>` for type inference instead of duplicating interface definitions inline, keeping types always in sync with the oRPC router

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all data sources are wired through orpcClient procedures.

## Next Phase Readiness

- Phase 04 is now complete: all oRPC routers are defined (Plan 01) and all consumers migrated (Plan 02)
- The only createServerFn remaining is the justified fetchSession in __root.tsx for SSR auth
- Ready for any subsequent phases that build on the oRPC infrastructure

---
*Phase: 04-implement-apis-using-orpc-with-mutations-and-procedures*
*Completed: 2026-04-15*
