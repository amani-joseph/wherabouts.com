---
status: investigating
trigger: "Neon Postgres DDL fails with 'could not extend file because project size limit (10240 MB) has been exceeded' even though project is on Scale plan"
created: 2026-04-18T00:00:00Z
updated: 2026-04-18T00:00:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED — the `addresses` table contains 16.8M rows of GNAF geographic data consuming 11 GB, which exceeds the Free-tier 10 GB project cap. The Scale plan upgrade was either not applied to project ep-muddy-cake-a72eh7us or has not taken effect.
test: N/A — root cause confirmed by direct measurement
expecting: N/A
next_action: Present diagnosis and options to user

## Symptoms

expected: CREATE TABLE DDL succeeds on a Scale plan Neon project (supports up to 16 TB/branch)
actual: "could not extend file because project size limit (10240 MB) has been exceeded" on trivial DDL
errors: "could not extend file because project size limit (10240 MB) has been exceeded"
reproduction: Run any DDL (CREATE TABLE) against DATABASE_URL in ep-muddy-cake-a72eh7us
started: During Plan 08-02 migration run

## Eliminated

- hypothesis: Scale upgrade applied to wrong project but DB is otherwise empty
  evidence: DB is 11 GB — clearly real data exists; project limit of 10240 MB matches Free tier exactly
  timestamp: 2026-04-18

- hypothesis: Session/user table bloat or dead tuples are the storage cause
  evidence: addresses = 11 GB alone; all other tables combined < 500 kB; dead tuples on addresses = 0
  timestamp: 2026-04-18

## Evidence

- timestamp: 2026-04-18
  checked: pg_database_size(current_database())
  found: 11 GB total database size
  implication: Already over the 10240 MB Free-tier cap — any write will fail

- timestamp: 2026-04-18
  checked: pg_total_relation_size per public table
  found: addresses = 11 GB (11,742,322,688 bytes); all other tables < 200 kB each
  implication: addresses table is the sole storage consumer

- timestamp: 2026-04-18
  checked: addresses row count and schema
  found: 16,841,097 rows; columns are geographic (gnaf_pid, geom, longitude, latitude, search_text, etc.); no created_at — this is GNAF reference data, not user-generated
  implication: This is a static Australian address dataset (GNAF), not application data. It can safely be moved out of the application DB.

- timestamp: 2026-04-18
  checked: pg_stat_user_tables dead tuples
  found: addresses has 0 dead tuples (n_dead_tup=0); VACUUM FULL would reclaim nothing
  implication: VACUUM FULL will not help — storage is live data, not bloat

- timestamp: 2026-04-18
  checked: project size limit in error message
  found: "10240 MB" cap matches Neon Free plan exactly (10 GB). Scale plan cap is 500 GB project / 16 TB branch.
  implication: Strong evidence the Scale upgrade did NOT take effect on project ep-muddy-cake-a72eh7us

## Resolution

root_cause: The `addresses` table holds 16.8M rows of GNAF Australian address reference data occupying 11 GB — exceeding the 10240 MB Free-tier project cap enforced by Neon. The Scale plan upgrade does not appear to have been applied to this project (ep-muddy-cake-a72eh7us); the 10240 MB error message is the exact Free-tier ceiling. No amount of VACUUM or schema tuning can help — the data simply takes 11 GB.
fix:
verification:
files_changed: []
