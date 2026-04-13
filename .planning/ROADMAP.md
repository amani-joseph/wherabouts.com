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

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. BetterAuth Infrastructure | 0/3 | In progress | - |
| 2. Auth Flows | 0/3 | Not started | - |
| 3. Legacy Auth Removal | 0/1 | Not started | - |
