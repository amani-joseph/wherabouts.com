---
phase: 01-schema-migration
plan: 01
subsystem: database
tags: [drizzle, postgres, neon, migration, schema]

requires:
  - phase: none
    provides: greenfield database schema
provides:
  - projects table with id, user_id, name, slug, created_at, archived_at
  - api_keys.project_id NOT NULL FK to projects
  - api_keys.expires_at nullable column
  - api_usage_daily.project_id nullable FK to projects
  - backfill script for default project creation
affects: [02-project-crud, 03-api-key-scoping, 04-key-lifecycle, 05-dashboard]

tech-stack:
  added: []
  patterns: [multi-step migration nullable->backfill->NOT NULL, direct SQL apply for non-TTY environments]

key-files:
  created:
    - packages/database/src/schema/projects.ts
    - packages/database/src/backfill-default-projects.ts
    - packages/database/drizzle/0001_remarkable_ted_forrester.sql
    - packages/database/drizzle/0002_rich_mimic.sql
  modified:
    - packages/database/src/schema/api-keys.ts
    - packages/database/src/schema/index.ts

key-decisions:
  - "Used direct SQL execution via Neon driver for migrations since drizzle-kit migrate failed in non-TTY environment"
  - "Kept apiUsageDaily.projectId nullable as it is denormalized and can be backfilled lazily"
  - "Schema kept minimal for Phase 1 -- no environment or description columns on projects"

patterns-established:
  - "Multi-step migration: add nullable column -> backfill data -> add NOT NULL constraint"
  - "Direct SQL migration apply pattern for CI/non-TTY environments"

requirements-completed: [MIG-01, MIG-02]

duration: 12min
completed: 2026-04-12
---

# Phase 1 Plan 1: Schema Migration Summary

**Drizzle projects table with user-slug unique index, api_keys.project_id NOT NULL FK, and backfill script assigning orphaned keys to default projects**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-12T10:21:40Z
- **Completed:** 2026-04-12T10:34:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created projects table with id, user_id, name, slug, timestamps, and unique index on (user, slug)
- Added project_id FK and expires_at to api_keys; project_id FK to api_usage_daily
- Backfilled 1 existing user with "My First Project" and assigned 1 orphaned API key
- Enforced NOT NULL on api_keys.project_id via second migration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create projects schema and update api_keys** - `6f36b0a` (feat)
2. **Task 2: Backfill default projects and enforce NOT NULL** - `9de01b0` (feat)

## Files Created/Modified
- `packages/database/src/schema/projects.ts` - Drizzle table definition for projects
- `packages/database/src/schema/api-keys.ts` - Added projectId (NOT NULL FK), expiresAt, project_id index
- `packages/database/src/schema/index.ts` - Re-exports projects, Project, NewProject
- `packages/database/src/backfill-default-projects.ts` - Standalone backfill script
- `packages/database/drizzle/0001_remarkable_ted_forrester.sql` - Migration: add projects table, add columns
- `packages/database/drizzle/0002_rich_mimic.sql` - Migration: NOT NULL constraint on project_id

## Decisions Made
- Used direct SQL execution via Neon serverless driver because `drizzle-kit migrate` failed silently in non-TTY shell and `drizzle-kit push` requires interactive TTY prompts
- Kept `apiUsageDaily.projectId` nullable since it is denormalized data that can be backfilled lazily
- Schema kept minimal (no environment/description columns) per plan guidance -- deferred to Phase 2

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] drizzle-kit migrate/push failed in non-TTY environment**
- **Found during:** Task 1 (migration application)
- **Issue:** `drizzle-kit migrate` failed with exit code 1 (no error message); `drizzle-kit push` requires interactive TTY prompts
- **Fix:** Created temporary Node script using `@neondatabase/serverless` `sql.query()` to execute migration SQL statements directly
- **Files modified:** None committed (temp scripts deleted)
- **Verification:** All 10 SQL statements applied successfully; NOT NULL constraint applied
- **Committed in:** Part of task commits (schema files only)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Migration approach changed but identical SQL was applied. No scope creep.

## Issues Encountered
- `drizzle-kit migrate` exits with code 1 and no visible error in non-TTY environments. Root cause unclear -- may be related to missing `__drizzle_migrations` journal table or Neon driver compatibility. Workaround via direct SQL execution worked correctly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Projects table exists and is populated with default projects for existing users
- All API keys are project-scoped with NOT NULL constraint enforced
- Ready for Phase 2 (project CRUD) to build on this schema

---
*Phase: 01-schema-migration*
*Completed: 2026-04-12*
