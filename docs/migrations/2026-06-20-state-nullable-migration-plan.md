# Migration Plan — make `addresses.state` nullable (audit item 1.2)

**Status (2026-06-20):** Option A selected. Code + migration shipped in commit
`5a3254c` (schema nullable; ingest promote writes `NULLIF(state,'')`; migration
`0015_state_nullable.sql` generated). **DB application is HELD by user decision —
migration 0015 is committed but NOT applied to any database.** To apply later,
resume at §6 Step 3 (Neon branch snapshot) → Step 4 (`db:migrate`).
**Rule for this work:** every step that touches the database (including read-only
queries) stops for explicit per-step approval first. Nothing runs until you say so.

---

## 0. TL;DR and honest recommendation

`addresses.state` is `varchar(10) NOT NULL`. Countries with single-level
addressing (Iceland, Belgium, Switzerland, etc.) are stored with `state = ''`
(empty string) instead of `NULL`. Item 1.2 proposes making the column nullable
and normalizing `''` → `NULL`.

**Important context that lowers the urgency:** the formatter fix already shipped
(item 1.1) made the entire runtime robust to `state = ''` — the API, SDK, and UI
already render stateless addresses correctly today. **So 1.2 is a data-model
cleanup, not a correctness fix.** Nothing is broken for users right now.

**Data-loss risk across the whole plan: effectively zero.** Reason: the only data
change is rewriting a value that is *already* semantically empty (`''` → `NULL`,
both mean "this country has no state"). Street, locality, postcode, coordinates,
`gnafPid` — none of the costly data is read, moved, or deleted by any step here.
The real risks are **operational** (Neon compute cost, time, table bloat, brief
locks), and those are concentrated in exactly one optional step (the bulk
`UPDATE`).

**My recommendation: Option A (minimal) or Option C (defer).** See §5.

---

## 1. Current facts (from read-only code analysis — no DB queried)

### Schema (`packages/database/src/schema/addresses.ts`)
- `state: varchar({ length: 10 }).notNull()` (line 23)
- `state` participates in **three composite indexes**:
  - `idx_addresses_state` → `(country, state)`
  - `idx_addresses_locality` → `(country, state, locality)`
  - `idx_addresses_country_state_postcode` → `(country, state, postcode)`

### Who writes `state = ''`
- `scripts/intl/lib/source-registry.ts`: countries flagged `state: "none"` →
  the ingest adapters emit `'' AS state` (e.g. Iceland, Belgium, Switzerland…).
- US/Canada/Australia rows carry **real** state/province codes (`CA`, `TX`,
  `ON`, `NSW`…) — they are **not** `''` and are **out of scope** for the rewrite.

### Who reads `state` (and why none of it breaks under NULL)
- `autocomplete.ts:106` — adds `state = $X` **only when a non-empty filter is
  passed** (`if (state)`); callers never pass `''`. NULL rows are simply not
  filtered, which is correct.
- `structured-search.ts:107` — `(state = region) DESC` rerank is added **only
  when `parsed.region` is truthy**. NULL state never participates. Correct.
- Response mappers (`public-http.ts`, `geocode.ts`, …) pass `state` through as-is;
  a `null` serializes to JSON `null`, which clients already tolerate (the formatter
  drops it).

### Operational dependencies that MUST be coordinated (these are the real traps)
- **`scripts/intl/us-queue.ts:121`** — `SELECT count(*) … WHERE country='US' AND
  state='${state}'`. The US loader resumes per-state by counting on `state='XX'`.
  US rows are real codes, so the rewrite doesn't touch them — but any future
  change to ingest must keep this intact.
- **`scripts/intl/ingest.ts:96` `scopeWhere`** — builds `country='X' AND
  state='Y'`; for `state:"none"` countries the state clause is omitted (empty
  string is falsy). If we switch ingest to write `NULL`, re-loads of those
  countries still scope by country only — fine — but post-flight count checks
  must be reviewed so they don't assume `''`.

### Driver / migration constraints (from project memory, verified relevant here)
- **neon-http has no transactions** — the app's Drizzle/neon-http client throws on
  `db.transaction()`. The migration must run over a **direct pooled `psql`
  connection**, never through the app client.
- **Drizzle journal is a single consolidated baseline** — never hand-write
  out-of-journal `.sql`. The schema change must go through `drizzle-kit generate`.
- **No CI/CD; prod is deployed manually** — schema/code changes only take effect
  in prod on a deliberate deploy.

---

## 2. The two distinct operations (don't conflate them)

| Op | What it is | Touches data? | Risk |
|----|-----------|---------------|------|
| **Op-1: `ALTER COLUMN state DROP NOT NULL`** | Catalog/metadata flag change | **No** — does not read or rewrite a single row | **Very low.** Instant, no table rewrite; brief `ACCESS EXCLUSIVE` lock (ms). Reversible. |
| **Op-2: `UPDATE … SET state = NULL WHERE state = ''`** | Rewrites the empty-string rows | Yes — but only `''`→`NULL` | **Operational only.** Many rows × 3 index updates each → WAL, dead tuples, Neon compute/storage cost, autovacuum pressure. Must be **batched**. |

Op-1 is safe and useful on its own. Op-2 is the expensive, optional part.

---

## 3. Sensitive operations — explicit list

Everything below touches the database and is **gated on your approval**:

1. **[READ]** Measurement queries (counts of `state=''` per country, table size).
   Read-only, but still a DB hit → I will ask before running.
2. **[SNAPSHOT]** Create a **Neon branch** as an instant restore point (see §4).
3. **[WRITE — low risk]** Op-1: `DROP NOT NULL` (via drizzle-generated migration).
4. **[WRITE — high cost]** Op-2: batched `UPDATE ''→NULL` (only if you choose
   Option B).
5. **[MAINTENANCE]** `VACUUM (ANALYZE) addresses` after Op-2 to reclaim bloat.

I will not run **any** of these without a separate, explicit "go" from you for
that specific step.

---

## 4. Mandatory safety net BEFORE any write — Neon branch snapshot

Neon supports **instant copy-on-write branches**. Before any write step, we create
a branch (e.g. `pre-state-migration-2026-06-20`) from the current production state.
- It is an instant, cheap, full logical snapshot of the costly dataset.
- If anything looks wrong, we restore by pointing back at the branch — no
  reconstruction of the 153 GB / 299.5 M-row dataset required.
- This is **in addition to** Neon's point-in-time restore (PITR), if enabled on
  the project.

**Gate:** I will confirm the branch exists and is healthy (and that you can see it
in the Neon console) **before** proposing any write.

---

## 5. Options — pick one

### Option A — Minimal (recommended)
1. Op-1 `DROP NOT NULL` (safe, instant).
2. Change ingest adapters (`overture.ts`, `oda.ts`) to emit `NULL` instead of `''`
   for `state:"none"` countries, so **all future loads are clean**.
3. **Leave existing `''` rows as-is.** Runtime already handles both.
- **Pros:** near-zero risk, no bulk `UPDATE`, no Neon cost spike, fully reversible.
- **Cons:** the column temporarily holds a mix of `''` and `NULL` (cosmetic; both
  mean "no state").

### Option B — Full normalization
Option A **plus** Op-2 (batched `UPDATE ''→NULL`) + `VACUUM`.
- **Pros:** single clean representation (`NULL` only).
- **Cons:** the expensive/slow part; Neon compute + storage (bloat) cost; needs
  careful batching and a maintenance window-ish mindset. No data-loss risk, but
  the highest operational risk in this plan.

### Option C — Defer / do nothing
Ship only the ingest change for future loads (or nothing at all). 1.1 already
fixed the user-facing behavior.
- **Pros:** zero DB risk now.
- **Cons:** the `NOT NULL '' ` wart persists.

> My suggestion: **Option A**. It captures the model improvement going forward and
> the safe schema change, while avoiding the one genuinely costly operation on your
> hard-won data. Move to Option B later only if a clean single representation
> becomes worth the cost.

---

## 6. Step-by-step execution (each step = a STOP-and-approve gate)

Nothing proceeds to the next step without your explicit approval. Read-only steps
are marked so you can approve them with low concern.

- **Step 0 — [no DB]** You pick an Option (A / B / C). *(done in code review of this doc)*
- **Step 1 — [READ-ONLY DB]** Run measurement queries to quantify scope:
  `SELECT country, count(*) FROM addresses WHERE state='' GROUP BY country;` and a
  table/index size check. → *I ask before running; output informs batching.*
- **Step 2 — [no DB]** Make the **code** changes on a branch (schema `.notNull()`
  removed; ingest adapters emit `NULL`; `drizzle-kit generate` produces the Op-1
  migration). Tests + review. *No DB touched yet.*
- **Step 3 — [SNAPSHOT]** Create + verify the Neon branch snapshot (§4). → *approve.*
- **Step 4 — [WRITE, low risk]** Apply Op-1 (`DROP NOT NULL`) via the generated
  migration over a direct `psql`/pooled connection. Verify column is nullable. →
  *approve.*
- **Step 5 — (Option B only) [WRITE, high cost]** Run Op-2 as **batched** updates,
  scoped per country, `LIMIT`-chunked with a commit between batches, watching WAL/
  lag. → *approve, and I report progress between batches.*
- **Step 6 — (Option B only) [MAINTENANCE]** `VACUUM (ANALYZE) addresses`. →
  *approve.*
- **Step 7 — [DEPLOY]** Deploy the app + ingest code changes (manual, per the
  no-CI/CD constraint). Verify a stateless-country query end-to-end.

---

## 7. Rollback per step

- **Op-1 (`DROP NOT NULL`)** — re-add `NOT NULL`. (Re-adding triggers a validating
  scan; only do it if no `NULL` rows exist yet. Trivial right after Step 4.)
- **Op-2 (`UPDATE`)** — `''` and `NULL` are interchangeable here, so a "rollback"
  is cosmetic; if truly needed, the Neon branch from Step 3 is the authoritative
  restore point.
- **Catastrophic / anything unexpected** — restore from the Neon branch (Step 3).
  The costly dataset is never at risk because no step deletes or rewrites the
  address payload.

---

## 8. What I need from you now

1. **Which option** — A (recommended), B, or C?
2. Confirmation that I should **prepare the Step 2 code changes** (no DB) so they're
   ready for review.
3. Acknowledgement that, when we reach Steps 1/3/4/5/6, I will **pause for your
   explicit per-step approval** before any query or write — including the read-only
   measurement in Step 1.

I will not query or modify the database until you approve the specific step.
