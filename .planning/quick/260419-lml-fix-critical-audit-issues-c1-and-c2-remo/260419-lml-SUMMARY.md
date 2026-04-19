---
phase: 260419-lml-fix-critical-audit-issues-c1-and-c2-remo
plan: 01
type: quick
subsystem: config/docs
tags: [audit, wrangler, claude-md, cloudflare, docs]
requirements: [C1, C2]
dependency_graph:
  requires:
    - ".planning/audit/2026-04-19-quick-audit.md"
  provides:
    - "Clean wrangler vars (no NODE_ENV in dev)"
    - "Accurate CLAUDE.md Project section (Postgres/Drizzle)"
  affects:
    - "apps/server/wrangler.jsonc"
    - "CLAUDE.md"
tech_stack:
  added: []
  patterns:
    - "Scoped single-file commits per audit H1 guidance"
key_files:
  created:
    - ".planning/quick/260419-lml-fix-critical-audit-issues-c1-and-c2-remo/260419-lml-SUMMARY.md"
  modified:
    - "apps/server/wrangler.jsonc"
    - "CLAUDE.md"
decisions:
  - "C1 scope limited to NODE_ENV removal; nodejs_compat_populate_process_env and routes left untouched (user will handle any [env.production] overrides via Cloudflare dashboard)"
  - "C2 preserves a brief historical note about the abandoned Convex direction (prevents future planners from revisiting the idea without context)"
metrics:
  duration_minutes: 2
  tasks: 2
  files_changed: 2
  completed_date: "2026-04-19"
commits:
  - "7b0e382: fix(server): remove NODE_ENV from wrangler vars to prevent prod path in dev"
  - "5b3ce0b: docs: correct CLAUDE.md project section — auth is Postgres/Drizzle, not Convex"
---

# Quick Task 260419-lml: Fix Critical Audit Issues C1 and C2 — Summary

Two scoped, single-file commits landed on `master` resolving the critical findings from `.planning/audit/2026-04-19-quick-audit.md`: the `NODE_ENV=production` leak into `wrangler dev` is removed, and `CLAUDE.md` now names Postgres/Drizzle (not Convex) as the auth store.

## What Changed

### Task 1 — C1: Remove `NODE_ENV` from wrangler static vars
- **File:** `apps/server/wrangler.jsonc`
- **Change:** Removed the `"NODE_ENV": "production"` entry from the `vars` block. Kept `AUTH_COOKIE_DOMAIN`, `BETTER_AUTH_URL`, `WEB_BASE_URL`, and the unchanged `compatibility_flags` (including `nodejs_compat_populate_process_env`). No `[env.production]` override added (explicitly out of scope per the plan).
- **Why:** With `nodejs_compat_populate_process_env` active, a static `NODE_ENV=production` in `vars` silently flipped `wrangler dev` into prod code paths (cookies, logging, auth branches).
- **Commit:** `7b0e382`

### Task 2 — C2: Correct `CLAUDE.md` Project section
- **File:** `CLAUDE.md`
- **Change:** Rewrote the content between `<!-- GSD:project-start source:PROJECT.md -->` and `<!-- GSD:project-end -->` to state auth data lives in Postgres (Neon) via Drizzle ORM, pointing to `packages/database/src/schema/auth.ts`. Dropped Convex from the Stack and Data-storage constraints, replaced with Cloudflare Workers (`apps/server`) + Neon. Added a one-line historical note explaining the abandoned Convex direction. All other GSD-managed sections (stack, conventions, architecture, workflow, profile) and their markers untouched.
- **Why:** Prior text described a stack (TanStack Start + Convex, Convex auth store) that no longer matches reality — confirmed by auth schema file and the audit's sweep for Convex deps/directory.
- **Commit:** `5b3ce0b`

## Verification

- `grep '"NODE_ENV"[[:space:]]*:[[:space:]]*"production"' apps/server/wrangler.jsonc` → no match
- `grep 'AUTH_COOKIE_DOMAIN' apps/server/wrangler.jsonc` → present
- `grep 'nodejs_compat_populate_process_env' apps/server/wrangler.jsonc` → present (flag preserved per plan)
- `grep 'Postgres (Neon) via Drizzle' CLAUDE.md` → present
- `grep 'TanStack Start \+ Convex' CLAUDE.md` → no match
- `grep 'Auth data must be stored in Convex' CLAUDE.md` → no match
- All six GSD markers (`project`, `stack`, `conventions`, `architecture`, `workflow`, `profile`) — both start and end — present and intact
- `git log --oneline -n 2` → `5b3ce0b`, `7b0e382` — two scoped commits, one file each
- `git status --short` — confirms the four unrelated in-flight changes from audit H1 remain **uncommitted and separately staged for the user** (see below)

## In-Flight Changes Still Pending (Audit H1)

Per plan constraints, the following pre-existing uncommitted modifications were **deliberately not included** in either commit and remain in the working tree for the user to address next:

- `apps/web/public/brand.html` (modified)
- `packages/database/src/index.ts` (modified)
- `packages/database/src/queries/autocomplete.ts` (modified)
- `.claude/worktrees/agent-a03d95ac` (dirty submodule pointer)

Also still untracked (out of scope for this quick task):
- `.planning/audit/`
- `.planning/debug/slash-unit-address-parse-slow.md`
- `apps/web/public/brand/README.md`

## Deviations from Plan

None. Both tasks executed exactly as written. Scope boundaries from the plan (no `[env.production]` override, no re-introduction of Convex, no touching the other in-flight changes) were all respected.

## Self-Check: PASSED

- `apps/server/wrangler.jsonc` — present, NODE_ENV line absent, other vars + compat flag intact
- `CLAUDE.md` — present, Postgres/Drizzle named, Convex constraint removed, all markers intact
- Commit `7b0e382` — found in `git log --oneline`
- Commit `5b3ce0b` — found in `git log --oneline`
- Summary file — this file exists at `.planning/quick/260419-lml-fix-critical-audit-issues-c1-and-c2-remo/260419-lml-SUMMARY.md`
