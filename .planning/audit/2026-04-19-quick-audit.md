# Quick Project Audit — 2026-04-19

Scope: ad-hoc audit of repo state at HEAD `90c9493`. Focus areas: secrets, config drift, uncommitted work, code hygiene, planning/state coherence.

## Critical (fix before next deploy)

### C1. `wrangler.jsonc` hardcodes `NODE_ENV=production` — affects local dev
File: `apps/server/wrangler.jsonc` (line in `vars`).
Diff also adds `nodejs_compat_populate_process_env` flag, which means `vars` are exposed as `process.env` to the Worker. So `wrangler dev` (port 3003) will now run with `process.env.NODE_ENV === "production"`. Any code branching on `NODE_ENV` (logging, error redaction, cookie `Secure`/`SameSite`, framework dev-only assertions, BetterAuth dev cookie behavior) will silently take the production path locally — masking bugs and producing misleading dev sessions.

**Fix:** Remove `NODE_ENV` from the static `vars` block. If you need it set in production, scope it via a `[env.production].vars` override or set it in the Cloudflare dashboard as a secret/var, leaving `wrangler dev` to run without it (or with `NODE_ENV=development`).

### C2. CLAUDE.md / reality mismatch on auth storage
`CLAUDE.md` says: *"Auth data must be stored in Convex (not a separate DB)."*
Actual stack: BetterAuth + Drizzle + Postgres (`packages/database/src/schema/auth.ts`, `packages/database/drizzle/*`). No `convex/` directory exists. `packages/backend` only contains skills metadata.

**Fix:** Update `CLAUDE.md` to reflect the chosen storage (Postgres via Drizzle) so future sessions don't act on a stale constraint.

## High

### H1. Five uncommitted modifications + bug-fix in flight, not committed
Modified, no commit:
- `apps/server/wrangler.jsonc` (see C1)
- `apps/web/public/brand.html` (+173 lines, asset inventory section)
- `packages/database/src/index.ts` (teams barrel exports)
- `packages/database/src/queries/autocomplete.ts` (slash-unit fix per `.planning/debug/slash-unit-address-parse-slow.md` Resolution section — confirmed fix, awaiting human verification)
- `.claude/worktrees/agent-a03d95ac` shows `-dirty` submodule pointer

**Fix:** Verify the autocomplete fix per the debug doc's Verification Plan (4 inputs), then split into focused commits (`fix(autocomplete):`, `feat(brand):`, `feat(db):`). Do **not** commit the wrangler change as-is — fix C1 first.

### H2. Worktree submodule shows dirty marker
`.claude/worktrees/agent-a03d95ac` is tracked and now points at a `-dirty` commit. This will follow into any commit/PR.

**Fix:** Either commit/discard inside the worktree, or remove it via `git submodule deinit` + `.gitmodules` cleanup if it's stale.

## Medium

### M1. Phase 08 (Teams) schema lands ahead of executor work
Recent commits show schema (`teams`, `teamMembers`, `teamInvitations`), migration SQL, and crypto helper merged, but the barrel export change (`packages/database/src/index.ts`) is still uncommitted. Downstream packages importing from the barrel will not see the new types until this lands.

**Fix:** Commit the barrel change before any 08-04+ phase tasks start consuming `Team*` types.

### M2. STATE.md last touched 2026-04-18; current focus unclear
`.planning/STATE.md` not updated since the autocomplete debug session (2026-04-19) started.

**Fix:** Run `/gsd:update` or refresh STATE.md so resume picks up Phase 08 cleanly.

## Low

- **L1.** `console.log` in `packages/database/src/backfill-default-projects.ts` lines 25, 38 — acceptable for a one-shot script; safe to ignore.
- **L2.** Single `: any` in `packages/ui/src/components/ui/globe.tsx:173` — third-party `three-globe` interop, narrow cast follows immediately; acceptable.
- **L3.** Test fixture `sk_live_super_secret_api_key_value_123` in `apps/web/src/lib/api-key-crypto.test.ts:25` — synthetic, not a real key. Safe.
- **L4.** Top-level `.env`, `apps/server/.env`, `apps/web/.env`, `packages/database/.env`, `packages/backend/.env.local` exist; verify all are gitignored (status confirms none are tracked). No action unless `.gitignore` audit fails.
- **L5.** No TODO/FIXME debt detected in `apps/` or `packages/`.

## Suggested order of operations

1. Edit `apps/server/wrangler.jsonc` to remove `NODE_ENV=production` from `vars`.
2. Verify autocomplete fix manually (debug doc has 4 test inputs).
3. Update `CLAUDE.md` storage constraint.
4. Commit the four real changes as separate, scoped commits.
5. Resolve the worktree submodule dirtiness.
6. Refresh `.planning/STATE.md`.
