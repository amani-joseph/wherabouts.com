# @wherabouts.com/database

Drizzle ORM schema, queries, and migrations for the Neon Postgres database.

## Migrations — single drizzle-managed lineage

As of 2026-06-07 there is ONE migration lineage. Pre-existing migrations were
squashed into a single baseline (`drizzle/0000_amazing_thor.sql`); the originals
are archived in `drizzle/_archive/` for history.

To change the schema:

1. Edit `src/schema/*.ts`.
2. `pnpm --filter @wherabouts.com/database db:generate` — creates a journaled
   migration + snapshot.
3. For objects drizzle cannot model (PostGIS/`pg_trgm`/`fuzzystrmatch`
   extensions, opclass/partial indexes like `text_pattern_ops` or
   `gin_trgm_ops`), use `db:generate --custom --name=<desc>` and write the raw
   SQL. It still gets a journal entry, so `db:migrate` applies it.
4. `pnpm --filter @wherabouts.com/database db:migrate` applies pending migrations.

**Never** hand-create out-of-journal `.sql` files — `db:migrate` ignores them and
the database silently drifts from the schema.

Before any server deploy, confirm the production schema matches the committed
schema (the consolidation fixed a drift where the deployed server was stale and
masked missing columns/tables).
