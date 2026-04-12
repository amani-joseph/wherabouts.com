# Architecture Patterns: Project-Scoped API Key Management

**Domain:** Geocoding SaaS - API key management with project organization
**Researched:** 2026-04-12
**Confidence:** HIGH (based on existing codebase analysis + established industry patterns)

## Current Architecture (As-Is)

The existing system uses a **flat user-to-key model**:

```
Clerk User ──1:N──> API Keys ──1:N──> Usage Records (daily)
```

### Current Components

| Component | Location | Responsibility |
|-----------|----------|---------------|
| Schema (Drizzle) | `packages/database/src/schema/api-keys.ts` | `api_keys` and `api_usage_daily` tables |
| DB Client | `packages/database/src/client.ts` | Neon serverless + Drizzle ORM |
| Auth Middleware | `apps/web/src/lib/with-api-key.ts` | Wraps API route handlers, validates key, records usage |
| Key Validation | `apps/web/src/lib/api-key-auth.ts` | scrypt hashing, timing-safe comparison, key parsing |
| Server Functions | `apps/web/src/lib/api-keys-server.ts` | CRUD via TanStack `createServerFn` (list, create, revoke) |
| Dashboard Server | `apps/web/src/lib/dashboard-server.ts` | Aggregated stats (active keys, usage, endpoint breakdown) |
| UI | `apps/web/src/routes/_protected/api-keys.tsx` | Key management UI with create dialog, revoke, copy |
| API Routes | `apps/web/src/routes/api/v1/addresses/*` | Geocoding endpoints (autocomplete, nearby, reverse, by-id) |

### Current Key Format

```
wh_<uuid>_<base64url-secret>
```

Key is shown once at creation. Only a hash + salt are stored. Display uses `wh_<first8ofuuid>...<last4ofsecret>`.

### Current Key Lifecycle

```
Created (active) ──revoke──> Revoked (soft-delete via revokedAt timestamp)
```

No expiration, no rotation, no scoping -- keys grant full access to all endpoints for the owning user.

---

## Recommended Architecture (To-Be): Project-Scoped Keys

### Data Model

Introduce a `projects` table as an organizational container. API keys become project-scoped. Usage tracking gains project context.

```
Clerk User ──1:N──> Projects ──1:N──> API Keys ──1:N──> Usage Records
                        |
                        +──> Project Settings (rate limits, allowed endpoints, etc.)
```

#### New Tables

```sql
-- projects table
projects (
  id              uuid PK DEFAULT gen_random_uuid(),
  clerk_user_id   text NOT NULL,              -- owner
  name            text NOT NULL,              -- "Production", "Staging"
  slug            text NOT NULL,              -- URL-safe identifier
  environment     text NOT NULL DEFAULT 'development',  -- 'production' | 'staging' | 'development'
  created_at      timestamptz NOT NULL DEFAULT now(),
  archived_at     timestamptz,                -- soft delete
  UNIQUE(clerk_user_id, slug)
)

-- Modify api_keys: add project_id column
api_keys (
  ...existing columns...
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,  -- nullable during migration
  scopes          text[],                     -- future: ['addresses:read', 'geocode:*']
  expires_at      timestamptz,                -- optional expiration
)

-- Modify api_usage_daily: add project_id for faster aggregation
api_usage_daily (
  ...existing columns...
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
)
```

#### Migration Strategy

The `project_id` column on `api_keys` starts **nullable**. A data migration creates a "Default Project" for each existing user, then assigns orphaned keys to it. After migration, add `NOT NULL` constraint.

```
Phase 1: Add projects table + nullable project_id on api_keys
Phase 2: Backfill migration (create default projects, assign keys)
Phase 3: Make project_id NOT NULL
Phase 4: Update all queries to filter by project_id
```

### Component Boundaries (To-Be)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Project Schema** (`packages/database/src/schema/projects.ts`) | Drizzle table definition for `projects` | Referenced by api-keys schema |
| **Project Server Fns** (`apps/web/src/lib/projects-server.ts`) | CRUD for projects (list, create, archive, rename) | DB client, Clerk auth |
| **API Key Server Fns** (`apps/web/src/lib/api-keys-server.ts`) | Extended CRUD -- now project-scoped | DB client, Clerk auth, Projects |
| **Key Validation** (`apps/web/src/lib/api-key-auth.ts`) | Add project context to `ValidatedApiKey` return | DB client |
| **Auth Middleware** (`apps/web/src/lib/with-api-key.ts`) | Unchanged interface, but `ValidatedApiKey` now carries `projectId` | Key validation |
| **Dashboard Server** (`apps/web/src/lib/dashboard-server.ts`) | Stats become project-filterable | DB client |
| **Projects UI** (`apps/web/src/routes/_protected/projects.tsx`) | Project list, create, switch, archive | Project server fns |
| **Project Detail UI** (`apps/web/src/routes/_protected/projects/$projectId.tsx`) | Keys + usage for a specific project | API key server fns, dashboard server |

### Data Flow

#### API Request Flow (runtime)

```
Client Request
    |
    v
[API Route Handler] (e.g., /api/v1/addresses/autocomplete)
    |
    v
[withApiKeyGET middleware]
    |-- parseApiKeyFromRequest(request)  --> extract token from Bearer/X-API-Key header
    |-- validateApiKey(db, token)        --> lookup key by embedded UUID
    |   |-- Check not revoked
    |   |-- Check not expired (NEW)
    |   |-- scrypt verify secret
    |   |-- Return { apiKeyId, clerkUserId, projectId } (projectId is NEW)
    |
    v
[Handler executes] --> Response
    |
    v
[recordUsage(db, { apiKeyId, clerkUserId, projectId, endpoint })]
    (fire-and-forget, non-blocking)
```

#### Dashboard Management Flow

```
User authenticates via Clerk
    |
    v
[Projects List Page]
    |-- listProjects() --> all user's projects
    |
    v
[Project Detail Page]  (selected project)
    |-- listApiKeys({ projectId }) --> keys for this project
    |-- getProjectStats({ projectId }) --> usage stats for this project
    |
    v
[Create/Revoke/Rotate Key]
    |-- createApiKey({ projectId, name })
    |-- revokeApiKey({ id })
    |-- rotateApiKey({ id }) --> revoke old + create new with same name (NEW)
```

### Key Lifecycle State Machine (Enhanced)

```
                          +-----------+
          create          |           |    validate (on each request)
     +------------------->|  ACTIVE   |<-----------+
     |                    |           |             |
     |                    +-----+-----+       (update lastUsedAt)
     |                          |
     |              +-----------+-----------+
     |              |                       |
     |         revoke (manual)        expires (automatic)
     |              |                       |
     |              v                       v
     |        +-----------+          +-----------+
     |        |  REVOKED  |          |  EXPIRED  |
     |        +-----------+          +-----------+
     |
  rotate -----> creates new ACTIVE key
                revokes old key
```

States are derived, not stored as an enum:
- **ACTIVE**: `revokedAt IS NULL AND (expiresAt IS NULL OR expiresAt > now())`
- **REVOKED**: `revokedAt IS NOT NULL`
- **EXPIRED**: `revokedAt IS NULL AND expiresAt IS NOT NULL AND expiresAt <= now()`

This avoids state synchronization issues -- expiration is checked at validation time, not via a cron job.

### Patterns to Follow

#### Pattern 1: Soft-Delete with Timestamps (already used)

The existing `revokedAt` pattern is correct. Extend it to projects with `archivedAt`. Never hard-delete data that has usage history attached.

```typescript
// Drizzle query pattern for "active" records
const activeProjects = await db
  .select()
  .from(projects)
  .where(and(eq(projects.clerkUserId, userId), isNull(projects.archivedAt)));
```

#### Pattern 2: Server Functions as API Layer

Continue using TanStack `createServerFn` for all dashboard operations. These provide RPC-style calls with automatic serialization, Clerk auth integration, and type safety across client/server boundary.

```typescript
// Pattern: project-scoped server function
export const listApiKeys = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ projectId: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<ApiKeyListItem[]> => {
    const { userId } = await auth();
    // Verify project belongs to user before returning keys
    const project = await verifyProjectOwnership(db, data.projectId, userId);
    // ...fetch keys for this project
  });
```

#### Pattern 3: Ownership Verification Helper

Every project-scoped operation must verify the requesting user owns the project. Extract this into a shared helper to prevent authorization bypass.

```typescript
// lib/projects-server.ts
export async function verifyProjectOwnership(
  db: Database,
  projectId: string,
  userId: string
): Promise<Project> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.clerkUserId, userId)))
    .limit(1);

  if (!project) {
    throw new Error("Project not found");
  }
  return project;
}
```

#### Pattern 4: Additive Schema Migration

Never remove columns in the same migration that adds replacements. The nullable-then-backfill-then-constrain approach ensures zero downtime.

### Anti-Patterns to Avoid

#### Anti-Pattern 1: Storing Key State as an Enum Column

**What:** Adding a `status` enum column ('active', 'revoked', 'expired').
**Why bad:** Expiration is time-based -- you would need a cron job to flip status from 'active' to 'expired', creating race conditions and stale state.
**Instead:** Derive state from `revokedAt` and `expiresAt` timestamps at query time. The current codebase already does this correctly for revocation.

#### Anti-Pattern 2: Project ID in the Key Format

**What:** Embedding project ID in the API key string (e.g., `wh_<projectId>_<keyId>_<secret>`).
**Why bad:** If a key is moved between projects (unlikely but possible), the token becomes misleading. The key-to-project mapping should live in the database only.
**Instead:** Keep current format `wh_<keyId>_<secret>`. The key ID lookup returns the project context.

#### Anti-Pattern 3: Cascading Deletes on Projects

**What:** `ON DELETE CASCADE` that deletes keys when a project is deleted.
**Why bad:** Accidental project deletion wipes all keys and usage history.
**Instead:** Use soft-delete (`archivedAt`). Archived projects keep their keys (also revoked) and usage data for billing/audit. The schema above uses CASCADE only as a safety net -- the application layer should never hard-delete projects.

#### Anti-Pattern 4: Separate Auth Paths for Scoped vs Unscoped Keys

**What:** Building a second validation path for project-scoped keys alongside the existing one.
**Why bad:** Dual code paths for authentication are a maintenance and security liability.
**Instead:** The existing `validateApiKey` function should return the project context for ALL keys (including migrated ones assigned to a default project). One path, always project-aware.

## Suggested Build Order

Dependencies flow top-to-bottom. Each layer depends on the one above it.

```
1. Schema (projects table + api_keys migration)
   |  No runtime dependencies. Pure DDL.
   |
2. Migration script (backfill default projects)
   |  Depends on: schema
   |
3. Project CRUD server functions
   |  Depends on: schema
   |  Includes: verifyProjectOwnership helper
   |
4. Update api-key-auth.ts (return projectId from validateApiKey)
   |  Depends on: schema migration (project_id column exists)
   |
5. Update api-keys-server.ts (project-scoped create/list/revoke)
   |  Depends on: project CRUD, updated auth
   |
6. Update dashboard-server.ts (project-filtered stats)
   |  Depends on: project CRUD
   |
7. Projects UI (list, create, detail pages)
   |  Depends on: project CRUD server fns, updated key server fns
   |
8. Key expiration + rotation (optional enhancement)
   |  Depends on: updated key validation
```

**Critical path:** Steps 1-2 must complete before anything else. Steps 3 and 4 can run in parallel. Steps 5-6 can run in parallel once 3-4 are done.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|-------------|-------------|-------------|
| Key validation lookup | Single index lookup by UUID -- fast | Same | Add read replica or Redis cache for hot keys |
| Usage recording | Upsert on unique index -- fast | Same, partition by month | Partition `api_usage_daily` by date range |
| Project listing | N+0 query (single SELECT) | Same | Same (user has <100 projects typically) |
| Key hashing (scrypt) | ~100ms per validation | CPU-bound concern | Move to edge worker or use Argon2id with lower cost |

## Sources

- Existing codebase analysis (HIGH confidence -- direct code review)
- Drizzle ORM schema patterns (HIGH confidence -- matches existing usage)
- Industry patterns for API key management (Stripe, Twilio, Mapbox key models) (MEDIUM confidence -- training data, not verified against current docs)
