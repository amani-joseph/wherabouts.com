# API Endpoint Audit (Re-test) — wherabouts.com

**Date:** 2026-06-14
**Target:** Production — `https://api.wherabouts.com`
**Auth:** Project-scoped Bearer API key (owner-supplied).
**Methodology:** Idempotent `GET`s sampled **N=10 warm → p50 / p95**, with the first (cold) call reported separately. Mutations are **single-shot** (not repeatable). Scope this run: **full coverage incl. mutations, artifacts left in place** (per owner instruction). Forward-geocode timeout: **quick confirm** only.
**Test params:** Sydney CBD `lat=-33.8688, lng=151.2093`; `country=AU` (data is G-NAF Australia).
**Session surface:** `/rpc/*` and `/api/auth/*` benchmarked via session cookie — see [Session-protected surface](#session-protected-surface-rpc--apiauth).

> Prior audit: `api-endpoint-audit-2026-06-13.md`. Headline change this run: **`addresses/nearby` now degrades catastrophically with radius / on cold regions** — a more serious problem than the prior cold-start note.

---

## Response-time table — GET endpoints (N=10)

| # | Endpoint | Cold (ms) | p50 (ms) | p95 (ms) | Status | Verdict |
|---|----------|-----------|----------|----------|--------|---------|
| 1 | `addresses/autocomplete` | 585 | 564 | **1785** | 200 | ⚠️ Slow + high tail for typeahead |
| 2 | `addresses/geocode` (good query) | 181 | 183 | 188 | 200 | ✅ Fast & stable *for resolvable queries* |
| 2b | `addresses/geocode` (POI / multi-token) | — | — | — | **TIMEOUT >30s** | 🔴 **P0 — still hanging** |
| 3 | `addresses/nearby` | **TIMEOUT >20s** | see §nearby | see §nearby | 200/TIMEOUT | 🔴 **P0 — radius/region blowup** |
| 4 | `addresses/reverse` | 3055 | 135 | 579 | 200 | ⚠️ High cold + p95 tail |
| 5 | `addresses/{id}` | 112 | 120 | 396 | 200 | ✅ OK |
| 6 | `regions` | 129 | 110 | 123 | 200 (empty) | ⚠️ Returns `{}` — data coverage |
| 7 | `routing/directions` | 188 | 113 | 326 | 200 | ✅ Fast (much better than 2026-06-13) |
| 8 | `zones` (list) | 119 | 106 | 143 | 200 | ✅ Fast |
| 9 | `zones/{id}` | 109 | 109 | 194 | 200 | ✅ Fast |
| 10 | `zones/contains` (hit) | 105 | 111 | 580 | 200 | ✅ Fast (tail spike) |
| 11 | `zones/{id}/addresses` | 2128 | 145 | 153 | 200 | ✅ Warm-fast; ⚠️ cold spike |
| 12 | `devices/{deviceId}/zones` | 110 | 116 | 504 | 200 | ✅ Fast |
| 13 | `geocode/batch/{jobId}` (poll) | 418 | 110 | 547 | 200 | ✅ Fast warm (cf. 5.5s first-poll on 06-13) |
| 14 | `geocode/batch/{jobId}/results` | 184 | 140 | 396 | 200 | ✅ Fast (R2) |
| 15 | `webhooks` (list) | 258 | 108 | 114 | 200 | ✅ Fast |
| 16 | `tiles/v1/{z}/{x}/{y}.mvt` | 532 | 78 | 94 | 200 | ✅ Fast (CDN/R2) |

## Response-time table — mutations (single-shot)

| Operation | Method | Time (ms) | Status | Notes |
|-----------|--------|-----------|--------|-------|
| `zones.create` | POST `/zones` | 1695 | 200 | Includes `ST_IsValid` polygon check + insert |
| `zones.update` | PUT `/zones/{id}` | 511 | 200 | Name update |
| `zones.create` (throwaway) | POST `/zones` | 154 | 200 | Warm |
| `zones.delete` | DELETE `/zones/{id}` | 122 | 200 | `{"success":true}` |
| `devices.location` | POST `/devices/{id}/location` | 1382 | 200 | **Fired an `entry` boundary crossing** into zone 6 → enqueues webhook delivery |
| `webhooks.create` | POST `/webhooks` | 148 | 200 | HTTPS URL validated; returns one-time secret |
| `geocode/batch.submit` | POST `/geocode/batch` | 671 | 200 | Returns `status:"processing"`; completed 5/5 |

---

## 🔴 P0 #1 — `addresses/nearby` degrades super-linearly with radius

Same coordinate, varying radius, plus a different (cold) region:

| Radius | Latency | |
|--------|---------|---|
| 100 m | 116 ms | ✅ |
| 500 m | 207 ms | ✅ |
| 1000 m | 360–623 ms | ⚠️ |
| 2000 m | **9,426 ms** | 🔴 |
| 5000 m | **16,656 ms** | 🔴 |
| 1000 m @ Melbourne CBD (cold data) | **TIMEOUT >25s** | 🔴 |

The first warm `radius=1000` Sydney call in the main sweep also **timed out >20s** when the underlying address pages were cold.

**Root cause (high confidence).** The handler builds the predicate as `ST_DWithin(geom::geography, point::geography, radius)` and orders by `ST_Distance(geom::geography, point::geography)` (see `packages/api/src/routers/public-http.ts`). Casting `addresses.geom` to `geography` **per row** means the GiST index on `geom` (a `geometry` column) cannot be used for the distance recheck or the KNN ordering. The planner can bbox-prefilter for tiny radii, but as the radius grows (or the region's pages aren't cached) it falls to scanning + casting + sorting a large candidate set — cost explodes, and cold regions like Melbourne never finish inside the request budget.

**Why it looked fine on 2026-06-13:** that run only tested `radius=1000` at Sydney after warm-up (~1.3s). The radius sweep exposes the real curve.

**Recommended fixes (in order):**
1. **Index the geography expression** (or store a dedicated `geography` column):
   `CREATE INDEX CONCURRENTLY addresses_geom_geog_gist ON addresses USING gist ((geom::geography));`
   Then `ST_DWithin`/`ST_Distance` over `geom::geography` can use it.
2. **Or** keep `geometry` and use a metric/native KNN: order by `geom <-> point` (GiST KNN) and filter with `ST_DWithin(geom, point, radius_in_degrees)` — index-friendly without the geography cast.
3. **Add a `statement_timeout`** on this path so a large radius fails fast instead of hanging a Worker for 25 s.
4. **Cap `radius`** in the input schema to a sane max once the index is in place; verify with `EXPLAIN (ANALYZE)` that an `Index Scan`/`Bitmap` is used at all radii.

`addresses/reverse` uses the same `geom::geography` pattern but with a fixed 200 m radius + `LIMIT 1`, so it stays fast (135 ms warm) — but it shares the same latent index gap and showed a 3 s cold spike.

---

## 🔴 P0 #2 — forward geocode still times out (unchanged)

Re-confirmed: `q="Sydney Opera House"` and `q="1 George St, Sydney"` both **hang >30 s**, while `q="10 Bourke St"` returns in 220 ms and the structured/good path p50 is 183 ms. Root cause and fixes unchanged from the 2026-06-13 report (Tier-3 `word_similarity`/`<%` trigram scan over the full address table for queries that don't prefix-match `search_text`). See that report's "Critical" section. **Still the top correctness/availability risk.**

---

## ⚠️ Secondary concerns

- **Autocomplete p95 = 1785 ms (#1).** p50 564 ms is already too slow for typeahead; the p95 near 1.8 s means roughly 1-in-20 keystrokes stalls ~2 s. Shares the tiered-search engine with geocode — ensure common prefixes resolve in Tier 1 (`ILIKE 'q%'` on an indexed `search_text`) and never escalate to Tier 3.
- **Cold-start tails (#4, #11).** `reverse` cold 3055 ms (warm 135), `zones/{id}/addresses` cold 2128 ms (warm 145). First-touch on cold connection/data pages is expensive; warm performance is good. Mitigate with connection keep-alive / a warmer, or accept as cold-start tax.
- **`regions` returns `{}` for Sydney CBD (#6).** Fast but empty — verify region/boundary layers are loaded in production; a 200-with-empty-body hides data gaps from monitoring.
- **General p95 spikes** (`zones/contains` 580, `devices/.../zones` 504, `addresses/{id}` 396) are modest and consistent with the per-query Neon round-trip variance, not query-cost problems.

## ✅ Positives confirmed this run

- **`zones/{id}/addresses` scales well when warm:** `limit=500` returned **500 addresses in 174 ms** (`truncated:false`, 130 KB). The point-in-polygon join is properly indexed; the only issue is the cold-start spike. (This resolves the 2026-06-13 worry that the 50-row cap was masking cost.)
- **`routing/directions` improved** dramatically: p50 113 ms vs ~1.4–1.7 s on 06-13 (OSRM warm / colocated).
- **Boundary-crossing pipeline works end-to-end:** pushing a device location inside the zone returned `crossings:[{event:"entry"}]`, which enqueues webhook delivery.
- **Batch path healthy:** submit 671 ms, completes 5/5, poll warm 110 ms, results 140 ms.
- **Auth posture intact:** no-key → 401, bad-key → 401, project scoping enforced before handlers.

---

## <a name="session-protected-surface-rpc--apiauth"></a>Session-protected surface (`/rpc/*`, `/api/auth/*`)

Authenticated with a browser session cookie (the API key does not work here). oRPC wire format: `POST /rpc/<domain>/<proc>` with body `{"json": <input>}`. N=10.

| Endpoint | Cold (ms) | p50 (ms) | p95 (ms) | Status | Verdict |
|----------|-----------|----------|----------|--------|---------|
| `rpc auth.healthCheck` (public) | 114 | 54 | 59 | 200 | ✅ Fast (no DB) |
| `rpc auth.getSession` | 56 | 55 | 65 | 200 | ✅ Fast |
| `rpc auth.privateData` | 52 | 55 | 59 | 200 | ✅ Fast |
| `rpc dashboard.getStats` | 116 | 77 | **1084** | 200 | ⚠️ Multi-query tail |
| `rpc projects.list` | 88 | 89 | **3196** | 200 | ⚠️ Large p95 tail |
| `rpc projects.listApiKeyOptions` | 85 | 87 | 657 | 200 | ⚠️ Tail |
| `rpc apiKeys.list` | 82 | 87 | 93 | 200 | ✅ Fast & stable |
| `rpc zones.list` | 173 | 87 | 116 | 200 | ✅ Fast |
| `rpc webhooks.list` | 143 | 87 | 111 | 200 | ✅ Fast |
| `GET /api/auth/get-session` | 60 | 52 | 59 | 200 | ✅ Fast |
| `GET /api/auth/list-sessions` | 79 | 73 | 83 | 200 | ✅ Fast |

**Observations:**
- The RPC/dashboard surface is **generally faster than the public `/api/v1` surface** (p50 ~50–90 ms) — these are simpler, well-indexed `user_id`/`project_id`-scoped reads.
- **`dashboard.getStats` p95 1084 ms (concern).** The handler issues ~6 sequential queries against `apiUsageDaily` and `apiKeys` (active keys, total/explorer/recent request counts, endpoint breakdown, recent keys), each a separate `neon-http` round-trip. Consolidate into fewer queries (CTEs / `UNION ALL` / a single grouped aggregate) to cut the tail.
- **`projects.list` p95 3196 ms (concern).** p50 is 89 ms but the tail spikes to 3.2 s — the project list joins active API keys per user (`listActiveApiKeyRowsForUser`). Investigate whether the join or a cold plan causes the occasional 3 s stall; ensure `api_keys(user_id)` / `projects(user_id)` are indexed and the key rows aren't fetched N+1.
- **Auth rejection:** `rpc dashboard.getStats` with no cookie → **401** ✅. `GET /api/auth/get-session` with no cookie → **200 with `null`** (standard BetterAuth "no session" response, not an error).

## Timeouts observed

| Endpoint | Condition | Behavior |
|----------|-----------|----------|
| `addresses/nearby` | `radius≥2000`, or cold region (Melbourne), or cold Sydney pages | 9.4 s → 16.7 s → **>25 s hang** |
| `addresses/geocode` | POI / number-led multi-token queries | **>30 s hang** |
| `addresses/reverse` | First (cold) call | 3.0 s, recovers to 135 ms |
| `zones/{id}/addresses` | First (cold) call | 2.1 s, recovers to 145 ms |

---

## Prioritized action list

1. **🔴 P0 — Fix `addresses/nearby` (and `reverse`) spatial index.** Add a GiST index on `geom::geography` (or switch to native `<->` KNN) and a `statement_timeout`; cap `radius`. Highest impact — currently times out on common inputs.
2. **🔴 P0 — Bound forward geocode.** `statement_timeout` + verify `gin_trgm_ops` index + pre-filter Tier-3 candidate set. (Carried from 06-13; unresolved.)
3. **⚠️ P1 — Autocomplete latency/tail** to typeahead range; prevent Tier-3 escalation on common prefixes.
4. **⚠️ P2 — Cold-start tails** on `reverse` / `zones/{id}/addresses` (connection warmth).
5. **⚠️ P2 — Verify `regions` data coverage** in production.
6. **⚠️ P2 — `dashboard.getStats` (~6 sequential queries, p95 1.1s)** — consolidate into fewer round-trips.
7. **⚠️ P2 — `projects.list` p95 3.2s tail** — investigate the per-user API-key join / cold plan; verify `user_id` indexes.

---

## Artifacts left in place (per "full + leave artifacts")

| Artifact | ID | State |
|----------|----|----|
| Zone | `id=6` | `AUDIT-zone-main (updated)` — Sydney CBD polygon |
| Webhook | `id=1` | → `https://example.com/audit-temp-webhook`, events `[entry,exit]`, bound to zone 6 |
| Device | `audit-device-001` | last location Sydney CBD, currently inside zone 6 |
| Batch job | `28839079-53df-4c0d-a9d4-389fd4d355b1` | completed 5/5 (+ `abe789f2-…` from 06-13 session) |
| Throwaway zone | `id=7` | **deleted** (DELETE benchmark) |

To remove: `DELETE /api/v1/zones/6`, `DELETE /api/v1/webhooks/1`. Device state and batch jobs have no public delete endpoint (would need manual DB/R2 cleanup — itself a small gap: no device/batch retention controls).

---

## Coverage

All reachable surfaces benchmarked: public `/api/v1/*` (API key), `/tiles/*`, `/rpc/*` and `/api/auth/*` (session cookie). Mutation endpoints exercised single-shot. No remaining unbenchmarked endpoints.

### Reproduction
Production over HTTPS. API-key surface used the owner-supplied project-scoped key; session surface used the owner-supplied browser cookie. GETs/RPC reads: 1 cold + 10 warm samples, p50/p95 via nearest-rank; mutations single-shot; per-request abort 20–30 s. **Neither the API key nor the session token is recorded in this document.**
