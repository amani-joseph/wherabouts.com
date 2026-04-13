# Requirements: Wherabouts.com — Clerk to BetterAuth Migration

**Defined:** 2026-04-14
**Core Value:** Users can authenticate seamlessly — login, signup, OAuth, and session persistence must work without disruption after the migration.

## v1 Requirements

Requirements for the migration. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can create account with email and password
- [ ] **AUTH-02**: User receives email verification after signup
- [ ] **AUTH-03**: User can reset password via email link
- [ ] **AUTH-04**: User session persists across browser refresh

### OAuth

- [ ] **OATH-01**: User can sign in with Google OAuth
- [ ] **OATH-02**: User can sign in with GitHub OAuth

### Infrastructure

- [ ] **INFR-01**: BetterAuth server configured for TanStack Start
- [ ] **INFR-02**: Convex adapter stores users and sessions
- [ ] **INFR-03**: Auth middleware protects routes requiring authentication
- [ ] **INFR-04**: Client-side auth hooks provide current user and auth state

### Migration

- [ ] **MIGR-01**: All Clerk packages and dependencies removed
- [ ] **MIGR-02**: All Clerk middleware, components, and API routes removed
- [ ] **MIGR-03**: All Clerk environment variables removed
- [ ] **MIGR-04**: User profile/metadata accessible via BetterAuth

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Additional Auth

- **AAUTH-01**: User can sign in with Apple Sign In
- **AAUTH-02**: User can enable two-factor authentication (2FA)
- **AAUTH-03**: Magic link passwordless login

## Out of Scope

| Feature | Reason |
|---------|--------|
| Apple Sign In | Not currently used, can add later |
| Multi-tenancy / organizations | Not part of current auth setup |
| Automated user data migration tooling | Manual migration if needed |
| Additional OAuth providers beyond Google/GitHub | Defer to future |
| 2FA | Not currently implemented with Clerk |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| OATH-01 | Phase 2 | Pending |
| OATH-02 | Phase 2 | Pending |
| INFR-01 | Phase 1 | Pending |
| INFR-02 | Phase 1 | Pending |
| INFR-03 | Phase 1 | Pending |
| INFR-04 | Phase 1 | Pending |
| MIGR-01 | Phase 3 | Pending |
| MIGR-02 | Phase 3 | Pending |
| MIGR-03 | Phase 3 | Pending |
| MIGR-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-04-14*
*Last updated: 2026-04-14 after roadmap creation*
