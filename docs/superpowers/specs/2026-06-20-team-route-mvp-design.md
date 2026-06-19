# Team Route MVP — Design Spec

**Date:** 2026-06-20
**Status:** Approved (design) — ready for implementation planning
**Scope:** Turn the static `/team` route into a functional multi-member team workspace (MVP slice of phase 08).

---

## 1. Background & Current State

The `/team` route (`apps/web/src/routes/_protected/team.tsx`) is currently 100% mock data — a hardcoded `teamMembers` array and a fake pending-invitation card.

What already exists in the codebase (verified):

- **Custom Drizzle tables are the source of truth:** `teams`, `team_members`, `team_invitations` (`packages/database/src/schema/teams.ts`). `projects.team_id`, `api_keys.team_id`, `api_keys.secret_ciphertext`, `api_keys.secret_iv`, and `billing.ts` all reference them.
- **Migration is live:** Read-only DB check confirms all three tables + the column additions exist; 6 `teams` rows already present (auto-created Personal teams). **No new migration/backfill is required for this MVP.**
- **A `databaseHooks.user.create.after` hook** in `packages/auth/src/index.ts` auto-creates a `"<name>'s Personal"` team (in the custom tables) and adds the new user as `owner`.
- **A BetterAuth `organization` plugin is half-wired** in `packages/auth` (with a Resend `sendInvitationEmail` + `buildInviteHtml`/`buildInviteText` helpers) — **but its required tables (`organization`/`member`/`invitation`) do not exist**, and the client has no `organizationClient()`. The plugin is dead and cannot fire.
- **The codebase is oRPC everywhere** (`packages/api/src/routers/domains/*`), registered in `packages/api/src/routers/index.ts`, consumed via `orpcClient` (`apps/web/src/lib/orpc.ts`). The old phase-08 plan's "use `createServerFn`, NOT oRPC" decision is obsolete.

### Locked decisions (from brainstorming)

1. **Team engine:** Custom tables + oRPC. The org plugin is neutralized (removed). Lowest risk — keeps billing + FKs + the `user.create` hook intact.
2. **Scope:** MVP — functional team route (list/create/rename/delete teams, invite/accept/resend/revoke, manage members). Per-member scoped API keys + secret encryption are **deferred**.
3. **No global "active team."** Teams are a membership + billing boundary, not a global app mode. `/team` **renders each team the user belongs to as its own section**. Project and API-key selection stay completely independent of teams.
4. **Roles:** `owner` / `admin` / `member`. owner = everything (incl. delete team). admin = invite/remove members + change roles, not delete. member = read-only view of the team.
5. **Invite security:** Bound to the invited email — accepter must be authenticated as the exact invited email (signing up with it if new).
6. **Guard rails:** block last-owner removal/demotion; dedupe invites; honor 72h expiry; allow members to leave.

---

## 2. Architecture

New oRPC domain router `teams` mirroring the structure of `packages/api/src/routers/domains/projects.ts`.

- **Location:** `packages/api/src/routers/domains/teams.ts`
- **Registration:** add `teams: teamsRouter` to `appRouter` in `packages/api/src/routers/index.ts`
- **Procedures:** built on `protectedProcedure` (provides `context.db` and `context.session.user`), except `getInvite` which is `publicProcedure`.
- **Inputs:** Zod schemas inline (matching the `projects.ts` convention).
- **Permission helper:** a local `requireTeamRole(db, teamId, userId, allowed[])` that loads the caller's `team_members` row and throws `ORPCError("FORBIDDEN")` if their role isn't in `allowed` (or `NOT_FOUND` if they aren't a member).

### Procedure contract

| Procedure | Auth gate | Behavior |
|---|---|---|
| `listMine` | member | Returns all teams the caller belongs to: `[{ team: {id,name,slug}, myRole, members: [{userId,name,email,role,joinedAt}], pendingInvites: [{id,email,role,expiresAt,createdAt}] }]`. Invites filtered to `status='pending'`. |
| `create({ name })` | any user | Insert team (name + generated unique slug), insert caller as `owner`. Returns the new team. |
| `rename({ teamId, name })` | owner/admin | Update `name`, bump `updated_at`. |
| `delete({ teamId })` | owner | **Blocked if the team owns any projects** (return `CONFLICT` with a clear message) — prevents the FK cascade from silently deleting projects + keys. |
| `invite({ teamId, email, role })` | owner/admin | Dedupe: reject if `email` is already an active member or has a pending invite for this team. Insert `team_invitations` (`status='pending'`, `expiresAt = now + 72h`). Send Resend email. `role` ∈ {admin, member} (admins cannot mint owners). |
| `resendInvite({ invitationId })` | owner/admin | Re-send the email; refresh `expiresAt` to now + 72h. |
| `revokeInvite({ invitationId })` | owner/admin | Set `status='revoked'`. |
| `getInvite({ invitationId })` | public | Minimal payload for the landing page: `{ teamName, invitedEmail, role, status, expired }`. No member list. |
| `acceptInvite({ invitationId })` | invited email only | Require: signed in as exactly `invitation.email`; `status='pending'`; not past `expiresAt`. On success: insert `team_members` row, set invite `status='accepted'`. Idempotent if already a member. |
| `changeRole({ teamId, userId, role })` | owner/admin | Block demoting the last `owner`. admins cannot promote to/from `owner`. |
| `removeMember({ teamId, userId })` | owner/admin | Block removing the last `owner`. |
| `leave({ teamId })` | self | Caller removes their own membership; blocked if they are the last `owner` (they must delete the team or transfer ownership first). |

### Slug generation

Reuse the pattern from the existing `user.create` hook: lowercase, replace non-alphanumerics with `-`, trim, append a short disambiguator to satisfy `uq_teams_slug`.

---

## 3. Email (invitations)

- **Reuse, don't rebuild.** Export `buildInviteHtml` and `buildInviteText` from `packages/auth` (currently private functions) — or move them to a shared module the API package can import. Call them from `teams.invite` / `teams.resendInvite`.
- **Send via Resend** directly in the oRPC procedure (Cloudflare Worker): `new Resend(serverEnv.RESEND_API_KEY).emails.send({ from: serverEnv.EMAIL_FROM, to, subject, html, text })`.
- **Link format:** `${WEB_BASE_URL}/invite/<invitationId>` (matches the existing helper).
- **Failure handling:** email send failures must not roll back the invite row in a way that loses the invite; surface a non-fatal warning so the user can use "Resend." (Follow the codebase's fire-and-forget-with-catch convention for non-critical side effects, but still report send failure to the caller.)

### Neutralize the dead org plugin

Remove the `organization()` plugin block from `packages/auth/src/index.ts` (its `sendInvitationEmail` can never fire — no org tables exist). Keep the `buildInviteHtml`/`buildInviteText` helpers (now consumed by oRPC). Verified: `organization`/`organizationClient` are referenced only within `packages/auth` — no other consumers.

---

## 4. Frontend

### `/team` route (`apps/web/src/routes/_protected/team.tsx`)

Replace all mock data with a single `teams.listMine` query (React Query via the oRPC tanstack utils). Render **each team as its own section/card**:

- **Header:** team name, the caller's role badge, and (gated) **Rename** / **Delete** actions.
- **Members list:** avatar + name + email + role badge; a kebab menu (gated to owner/admin) with **Change role** and **Remove**. The caller's own row is labeled "(you)".
- **Pending Invitations:** email, role, "invited N ago"; **Resend** / **Revoke** buttons (gated to owner/admin).
- **Invite Member dialog:** email input + role select (`member` default; `admin` selectable by owners). Submit → `invite` → toast + query invalidation.
- **Create team** button at the top of the page → dialog with a name field → `create` → invalidate.

All mutations use optimistic-friendly query invalidation and `sonner` toasts, matching `api-keys.tsx`.

### `/invite/$id` route (new — `apps/web/src/routes/invite.$id.tsx`)

- Calls `getInvite`.
- If `status` is not `pending` or `expired` is true → show the corresponding terminal message (revoked / already accepted / expired).
- If the visitor is **not signed in** → prompt them to sign in or sign up **as `invitedEmail`** (show the email and team name), returning to `/invite/<id>` afterward.
- If signed in and the session email **matches** `invitedEmail` → show "Join <team> as <role>" with an **Accept** button → `acceptInvite` → redirect `/team` with a success toast.
- If signed in but the email **does not match** → show a clear "This invite is for `<invitedEmail>`; you're signed in as `<x>`" message with a sign-out option.

---

## 5. Out of Scope (deferred)

These belong to the full phase-08 vision but are explicitly **not** in this MVP:

- Auto-generated per-member, team-scoped API keys on invite acceptance.
- AES-256-GCM secret encryption at rest (`KEY_ENC_KEY`) and `revealApiKeySecret`.
- Membership-revocation enforcement in `api-key-auth.ts` (rejecting keys when membership is gone).
- A global team switcher / project + API-key filtering by team.
- Transfer-ownership UI, seat limits / billing-by-seat, SSO-enforced membership.

---

## 6. Setup Required (ops)

- `RESEND_API_KEY` and `EMAIL_FROM` must be configured as `apps/server` wrangler secrets (they are declared in `packages/env/src/server.ts` but their presence in the deployed Worker must be verified before invites can send).
- `WEB_BASE_URL` must point at the web app origin for correct invite links.

---

## 7. Files Touched

**Created**
- `packages/api/src/routers/domains/teams.ts` — the teams oRPC router.
- `apps/web/src/routes/invite.$id.tsx` — invite acceptance landing route.
- (likely) `packages/api/src/routers/domains/teams.test.ts` — unit tests for permission/guard logic.

**Modified**
- `packages/api/src/routers/index.ts` — register `teams` router.
- `packages/auth/src/index.ts` — remove `organization()` plugin; export `buildInviteHtml`/`buildInviteText` (or move to shared module).
- `apps/web/src/routes/_protected/team.tsx` — replace mock data with real, multi-team-section UI + dialogs.

---

## 8. Verification (end-to-end)

1. Sign up User A → Personal team auto-created; `/team` shows it as a section with A as sole owner.
2. A clicks **Create team** "Acme" → second section appears.
3. A invites `joe+test@…` as `member` → Resend fires; a Pending Invitation row appears under Acme.
4. Re-inviting the same email → rejected (dedupe).
5. Joe opens the link in incognito → prompted to sign up as `joe+test@…` → after auth, Accept → lands on `/team` as an Acme member.
6. Signing in as a different email and opening the link → blocked with the mismatch message.
7. A changes Joe's role to `admin`; Joe (now admin) can invite others but cannot delete Acme.
8. A tries to remove themselves while sole owner → blocked (last owner). A removes Joe → succeeds.
9. Let an invite pass 72h (or fake `expiresAt`) → acceptance fails with "expired."
10. A tries to delete Acme while it owns a project → blocked with the projects-present message.
