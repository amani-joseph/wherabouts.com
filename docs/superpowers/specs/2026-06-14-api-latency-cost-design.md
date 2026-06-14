# Design — API Latency & Cost Remediation (Track A)

**Date:** 2026-06-14
**Author:** brainstorming session (evidence-driven via prod `EXPLAIN (ANALYZE)`)
**Source audits:** `docs/audits/api-endpoint-audit-2026-06-13.md`, `docs/audits/api-endpoint-audit-2026-06-14.md`, `docs/audit/project-audit-2026-06-12.md`
**Status:** Approved design — pending spec review, then implementation plan.

---

## Context

Endpoint audits flagged two production availability bugs (forward geocode and `addresses/nearby` hang >25–30s) plus latency/cost concerns. Several audit hypotheses were **disproven by direct inspection of the schema and prod query plans**:

- The "missing GiST index on `geom`" — **exists** (`idx_addresses_geom`, 8 GB).
- The "missing trigram index on `search_text`" — **exists** (`idx_addresses_search_text_trgm`, `gin_trgm_ops`).
- The "missing geography index" — **exists** (`idx_addresses_geom_geography` = `gist((geom::geography))`).
- `dashboard.getStats` "≈6 sequential queries" — actually `Promise.all` (concurrent); query executes in **1.5 ms**.

The `addresses` table is **173.8 M rows / 86 GB**. Every sequential scan is large, billed Neon compute — so "make it cheap" = "never let a hot endpoint seq-scan or sort the candidate set."

### Evidence (prod `EXPLAIN (ANALYZE, BUFFERS)`, 2026-06-14)

| Query | Result |
|-------|--------|
| `nearby` geography-cast, `ORDER BY ST_Distance(...)`, r=2000 | **>25 s timeout** — Index Scan feeds a **Sort** of ~17 K candidates computing spheroidal distance each |
| `nearby` geography KNN, `ORDER BY geom::geography <-> point`, r=2000 (Sydney) | **495 ms**, index-ordered KNN, no Sort |
| same, Melbourne r=1000 (prior cold-region timeout) | **540 ms** |
| same, ocean point (zero matches) r=5000 | **0.05 ms** — bbox `Index Cond` bounds the scan |
| geocode Tier-3 `word_similarity('Sydney Opera House') <%`, threshold 0.3 | **>25 s timeout** |
| `getStats` endpoint-breakdown groupBy | **1.5 ms** exec |

**Root causes (confirmed):**
1. `nearby`/`reverse` order by the `ST_Distance(...)` *function*, which the planner cannot satisfy from the index → it materializes and sorts every candidate in the radius bbox, computing expensive geography distance per row. The `<->` KNN *operator* is index-ordered and stops at `LIMIT N`.
2. Forward geocode/autocomplete Tier-3 `word_similarity`/`<%` is non-selective on common trigrams over 173 M rows → unbounded bitmap + recheck. G-NAF is a street-address dataset with no POI entries, so POI-style queries have no correct answer yet scan exhaustively.
3. `neon-http` is stateless per request, so a per-request `SET statement_timeout` does not persist — runaway queries keep running (and billing) on Neon even after the Worker aborts the HTTP wait.

---

## Scope

**In scope (Track A — this spec):** A1 spatial proximity, A2 fuzzy search bounding, A3 dashboard read, A4 cost backstop. A5 (`regions`) is documented as a data gap, not implemented here.

**Out of scope (Track B — separate sequenced checklist, per `project-audit-2026-06-12.md`):** commit uncommitted SSR/playground/map fixes, merge-train to master, billing E2E, SDK npm publish, branch/planning cleanup. Run interactively, each step gated on the full test suite.

---

## A1 — Spatial proximity (`nearby`, `reverse`)

**File:** `packages/api/src/routers/public-http.ts` (the `nearby` and `reverse` handlers).

**Change:** Replace the order-by expression
`ORDER BY ST_Distance(geom::geography, point)`
with the geography KNN operator
`ORDER BY geom::geography <-> point::geography`.

Keep unchanged: the `ST_DWithin(geom::geography, point, radius)` WHERE filter (it provides the bounding `Index Cond` via `idx_addresses_geom_geography`), and the `ST_Distance(geom::geography, point)` projection in the SELECT (computes exact metres — now only on the `LIMIT N` returned rows).

**Properties:**
- Uses the **existing** `idx_addresses_geom_geography` index. **No DDL, no new index.**
- Exact-metre distances preserved (no metres→degrees approximation).
- **No radius cap** (per decision): the bbox `Index Cond` bounds the scan to the radius even when there are zero matches (ocean case = 0.05 ms). Radius input validation stays as-is (max 50 km).
- `reverse` (LIMIT 1, r=200) gets the same operator change for consistency and index-ordered behaviour.

**Diff size:** one expression per handler.

**Verification:**
- Regression test (integration, against a representative dataset or prod read-only): `nearby` at Sydney r=2000, Melbourne r=1000, and a no-match point all return < 2 s and correct ordering.
- Re-run the audit radius sweep (100 m → 5 km) and confirm sub-second across the board.

---

## A4 — Cost backstop (session-capable driver on hot paths)

**Rationale:** Enables a real per-request `statement_timeout` so a runaway query is cancelled **server-side** (stops Neon compute billing), without a global `ALTER ROLE`. Required as the safety net under A1's no-cap and A2's fuzzy path.

**Design:**
- Add a small, isolated DB-client module exposing a **pooled, session-capable** Neon client (`Pool` / WebSocket from `@neondatabase/serverless`) alongside the existing `neon-http` client in `packages/database/src/client.ts`.
- Use the pooled client **only** on the hot, cost-risky paths: forward geocode, autocomplete, `nearby`, `reverse`. Everything else stays on `neon-http` (no behaviour change, no connection overhead where unneeded).
- On each pooled request: `SET LOCAL statement_timeout = '<budget>'` inside a transaction (e.g. 5 s for nearby, 3 s for geocode/autocomplete). A timeout surfaces as a clean error mapped to the API error envelope, not a hang.
- Document the Workers compatibility constraints (WebSocket driver under `nodejs_compat`) and connection lifecycle (pool per isolate).

**Open implementation detail (for the plan):** confirm `Pool`/WebSocket works under the current `wrangler` `compatibility_date`/flags; if not, fall back to a single-statement `statement_timeout` wrapper that the http driver can honour, or a role-scoped timeout on a dedicated API DB role (would require approval).

**Verification:** a deliberately pathological query on a hot path returns a timeout error within budget; Neon shows the statement cancelled (not still running).

---

## A2 — Fuzzy geocode / autocomplete Tier-3 bounding

**Files:** `packages/database/src/queries/autocomplete.ts` (tiered search; shared by forward geocode and autocomplete), and the geocode handler in `packages/api/src/routers/public/geocode.ts`.

**Change — pre-filter before the fuzzy operator:** Before running `word_similarity`/`<%` (Tier 3), require a **selective anchor** to bound the candidate set:
- a first-token prefix predicate `search_text ILIKE '<firstToken>%'` (B-tree/trigram supported), and/or
- a `country`/`state`/`locality` equality filter when the query parses into structured parts.

`word_similarity` then runs only over the bounded set, not all 173 M rows.

**Change — hard budget:** Run the geocode/autocomplete path on the A4 pooled client with a `statement_timeout` (~3 s). If the anchor cannot be derived or the budget is hit, **fast-fail**.

**Behaviour change (approved):** When no confident match is found cheaply, forward geocode returns a **fast 404 / empty result**, surfacing any low-confidence candidates with an explicit low-confidence flag rather than performing an exhaustive scan. Document this in the API/SDK docs (POI-style queries are not supported by the current G-NAF address corpus).

**Verification:**
- Regression test: `Sydney Opera House`, `1 George St, Sydney` return < 2 s (404/low-confidence acceptable).
- Regression test: known-good queries (`10 Bourke St`, `George Street`) still return correct matches and existing autocomplete unit tests pass.
- `EXPLAIN (ANALYZE)` on the anchored Tier-3 query confirms a bounded candidate set (no full-table bitmap).

---

## A3 — Dashboard reads

**File:** `packages/api/src/routers/domains/projects.ts` (`projects.list`, `projects.listApiKeyOptions`).

**Change:** Parallelize the two currently-sequential round-trips (project rows, then `listActiveApiKeyRowsForUser`) with `Promise.all`. Both are independent reads.

**Explicitly not changing:** `dashboard.getStats` — already `Promise.all`; query executes in 1.5 ms. Its p95 tail is `neon-http` per-request connection variance, not query cost. Consolidating its queries would add code for no measurable gain. (If A4's pooled client is later generalized, getStats can opt in for connection reuse, but that is not in scope here.)

**Verification:** `projects.list` p95 re-measured; confirm the sequential second round-trip is gone (single wall-clock round-trip for the two reads).

---

## A5 — `regions` (documented, not implemented)

`EXPLAIN`/count confirmed the `regions` table has **0 rows**. The empty `{}` response for valid coordinates is a **data-ingestion gap**, not a query or latency defect. No code change. Tracked as a separate data task: load boundary/region layers, then re-test `GET /api/v1/regions`.

---

## Cross-cutting verification

- Full API + DB test suites green (`pnpm test` across `apps/server`, `packages/api`, `packages/database`).
- `tsc --noEmit` clean.
- Re-run the endpoint audit sweep (the N=10 p50/p95 harness) against the changed endpoints; attach before/after numbers.
- All DDL/role changes (if any emerge in A4 fallback) require explicit owner approval before applying to prod, per project rule. The primary fix path (A1, A2, A3) needs **no DDL**.

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| `Pool`/WebSocket driver incompatible with current Workers runtime | A4 fallback to http-honoured timeout or approved role-level timeout; spike this first in the plan |
| Pre-filter anchor reduces fuzzy recall for genuinely misspelled long street names | Keep Tier-1/Tier-2 unchanged; anchor applies only to the Tier-3 escalation; regression-test known fuzzy cases |
| Behaviour change (fast 404) surprises existing API consumers | Document in API/SDK changelog; low-confidence candidates still surfaced |
| `<->` operator returns geometry-distance ordering mismatch vs `ST_Distance` metres | Ordering is monotonic with true distance for points; SELECT still returns exact `ST_Distance` metres; regression-test ordering |

## Rollout order

1. **A1** (highest value, zero DDL, one-expression change) → test → ship.
2. **A4** spike + module (unblocks A2's hard budget).
3. **A2** (pre-filter + budget + fallback) → test → ship.
4. **A3** (parallelize `projects.list`) → test → ship.
5. **A5** logged for the data team; **Track B** run as the separate release checklist.
