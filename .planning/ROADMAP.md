# Roadmap: Wherabouts.com — BetterAuth Migration

## Overview

Adopt BetterAuth in three phases: stand up BetterAuth infrastructure on Convex, implement all auth flows (email/password + OAuth), then remove legacy auth residue entirely. Each phase delivers a verifiable capability, and the final state is zero legacy-auth residue with full feature parity.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: BetterAuth Infrastructure** - BetterAuth server running on TanStack Start with Convex storage
- [ ] **Phase 2: Auth Flows** - Email/password and OAuth login fully functional through BetterAuth
- [ ] **Phase 3: Legacy Auth Removal** - All legacy auth code, dependencies, and config purged with no regressions

## Phase Details

### Phase 1: BetterAuth Infrastructure
**Goal**: BetterAuth is configured, connected to Convex, and protecting routes -- the foundation all auth flows depend on
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04
**Success Criteria** (what must be TRUE):
  1. BetterAuth server initializes without errors on app startup
  2. Convex stores user and session records created by BetterAuth
  3. Protected routes redirect unauthenticated visitors to login
  4. Client-side hooks expose current user and loading/authenticated state
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Install BetterAuth packages and configure Convex backend (component, auth, HTTP routes)
- [x] 01-02-PLAN.md — Wire BetterAuth into TanStack Start frontend (auth client, proxy, provider swap, route guard)
- [ ] 01-03-PLAN.md — Fix UAT gaps: post-auth redirects and route guard error handling (gap closure)

### Phase 2: Auth Flows
**Goal**: Users can sign up, sign in, verify email, reset passwords, and use Google/GitHub OAuth -- all through BetterAuth
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, OATH-01, OATH-02
**Success Criteria** (what must be TRUE):
  1. User can create an account with email and password and is stored in Convex
  2. User receives a verification email after signup and can verify their address
  3. User can reset a forgotten password via email link
  4. User session survives browser refresh without re-login
  5. User can sign in with Google OAuth and with GitHub OAuth
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD
- [ ] 02-03: TBD

### Phase 3: Legacy Auth Removal
**Goal**: Every trace of legacy auth is removed and the app runs exclusively on BetterAuth with full feature parity
**Depends on**: Phase 2
**Requirements**: MIGR-01, MIGR-02, MIGR-03, MIGR-04
**Success Criteria** (what must be TRUE):
  1. No legacy auth packages exist in package.json or lock file
  2. No legacy auth middleware, components, or API routes remain in the codebase
  3. No legacy auth environment variables exist in .env files or deployment config
  4. User profile and metadata are accessible through BetterAuth (no data loss)
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Implement APIs using oRPC with mutations and procedures
**Goal**: All data fetching and mutations consolidated through oRPC procedures with TanStack Query integration -- no createServerFn wrappers or thin proxy files remain
**Depends on**: Phase 3
**Requirements**: ORPC-01, ORPC-02, ORPC-03, ORPC-04
**Success Criteria** (what must be TRUE):
  1. API explorer requests execute through an oRPC protectedProcedure
  2. TanStack Query utils (createTanstackQueryUtils) are wired up for cache key management
  3. All route components fetch data via orpcClient directly (no thin wrapper files)
  4. Only one createServerFn remains (fetchSession in __root.tsx for SSR optimization)
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Create api-explorer oRPC procedure and wire TanStack Query utils
- [x] 04-02-PLAN.md — Remove thin wrapper files and migrate all consumers to direct orpcClient

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. BetterAuth Infrastructure | 0/3 | In progress | - |
| 2. Auth Flows | 0/3 | Not started | - |
| 3. Legacy Auth Removal | 0/1 | Not started | - |
| 4. oRPC API Layer | 0/2 | Not started | - |
| 5. Tiered Autocomplete Search | 0/3 | Not started | - |

### Phase 5: Optimize autocomplete search with tiered strategy

**Goal:** Autocomplete returns ranked, relevant results in <100ms using tiered search (prefix, trigram, fuzzy, phonetic) with population/proximity boosting -- no Elasticsearch
**Depends on:** Phase 4
**Requirements**: SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04, SEARCH-05, SEARCH-06
**Success Criteria** (what must be TRUE):
  1. pg_trgm and fuzzystrmatch extensions enabled in PostgreSQL
  2. Queries 3-4 chars use fast prefix search, 5+ use trigram+fuzzy, 8+ widen fuzzy tolerance
  3. Results ranked by population score, admin level, similarity, and optional proximity
  4. Phonetic fallback (dmetaphone) fires when fuzzy returns zero results for 8+ char queries
  5. API accepts optional lat/lon for proximity boosting
**Plans:** 3 plans

Plans:
- [ ] 05-01-PLAN.md — Enable pg_trgm/fuzzystrmatch extensions, add population_score/admin_level columns and indexes
- [ ] 05-02-PLAN.md — Rewrite autocomplete query with tiered search strategy and result ranking
- [ ] 05-03-PLAN.md — Wire lat/lon proximity parameters through the API endpoint
