---
phase: 10-advanced-routing
plan: 01
status: tasks-1-4-complete, task-5-checkpoint-pending
date: 2026-06-12
---

# 10-01 Summary — Multi-profile + matrix foundation

## What shipped (Tasks 1–4, committed)

| Task | Commit | Result |
|------|--------|--------|
| 1 — Profile-aware OSRM client | `eb13502` | `osrmRequest()` shared helper (route\|table service); `RoutingProfile` driving\|walking\|cycling → OSRM car\|foot\|bike; `fetchOsrmRoute(from,to,opts,profile="driving")` |
| 2 — `fetchOsrmTable` | `958c332` | N×M matrix via `/table/v1/{profile}/...?annotations=duration,distance`; returns row-major `durations`/`distances` (+ resolved `sources`/`destinations`); null cells preserved; non-Ok → `RoutingError(unavailable)` |
| 3 — Multi-profile `directions` | `96c76d8` / `ec19759` | `profile` input widened from `z.literal("driving")` to `z.enum([...])`, forwarded to `fetchOsrmRoute` |
| 4 — `/api/v1/routing/matrix` | `ec19759` | GET endpoint; `sources`/`destinations` as `|`-delimited `lat,lng`-or-addressId lists; profile enum; capped 25/side; registered as `routing.matrix` in `public-http.ts` |

**Verification:** `pnpm -F @wherabouts.com/api test` → 90/90 green; `check-types` clean; ultracite clean.

## Success criteria status
- **SC #1 (`/matrix`)** — ✅ met (unit-tested vs mocked OSRM `/table`). Live spot-check pending deploy.
- **SC #2 (walking/cycling)** — 🟡 **code-complete**, not end-to-end until foot/bike graphs deploy (Task 5).

## Deviations from plan
1. **`driving` → `car` in the OSRM URL.** The existing `routing-queries.test.ts` asserted `/route/v1/driving/`; the plan's `must_haves` require the driving→car mapping (Caddy routes on the `car|foot|bike` segment). Updated that one assertion to `/route/v1/car/`. Safe on the current single-graph server (the profile segment is vestigial there) and required for the Task 5 multi-backend Caddy front.
2. **`no_route` message** generalised from "No drivable route…" to "No route … for this profile" (now multi-profile). No test asserts the string.
3. **Test level.** The codebase has **no oRPC procedure harness** (every public router tests pure extracted helpers, e.g. `resolveDirectionsInput`). Followed that convention: exported and unit-tested `parseMatrixSides` (empty/oversize → BAD_REQUEST) and `resolveMatrixPoints` (coord parse, addressId→coords, not-found→404, bad token→400), plus a `fetchOsrmRoute` cycling→`/route/v1/bike/` test. The handler's `RoutingError → 500` mapping is identical to the already-deployed `directions` path. Full HTTP-level assertions (live 2×2, OSRM-down 500) deferred to the post-deploy smoke step.
4. **Matrix method = GET** (D5 left "GET if modest, else POST"). Chose GET with delimited strings for parity with the existing public surface + API explorer; 25/side cap keeps the URL bounded and coords ≤ OSRM `--max-table-size` 100. No `z.number()` on any GET param (all strings/enum) — `z.coerce` pitfall avoided.

## Not done — Task 5 (checkpoint)
**Multi-profile OSRM build + serve is blocked on D1 + host-sizing sign-off.** Serving car+bike+foot mem-maps three graphs (~3–4 GB RAM each for AU) — roughly triples the serve-side footprint. Needs the user's decision before touching `infra/osrm/*`.

## Follow-ups
- SDK `routing.matrix` method + types → plan **10-05**.
- API-explorer catalog entry for `/matrix` (frontend; out of this plan's `files_modified`).
