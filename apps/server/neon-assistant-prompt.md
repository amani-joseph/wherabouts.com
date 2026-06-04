# Prompt for Neon Assistant

Copy everything in the code block below into the Neon Assistant for the project
containing database `neondb` (endpoint `ep-muddy-cake-a72eh7us`, region `ap-southeast-2`).

---

```
I'm on the Scale plan but writes to this project are being rejected with:
"could not extend file because project size limit (10240 MB) has been exceeded".
The database already holds ~11 GB (a 16.8M-row `addresses` table), so the project's
storage limit is currently set BELOW actual usage.

First: raise this project's storage limit well above current usage (e.g. to 50 GB or
the plan maximum) so writes are allowed again. Confirm the new limit.

Then: apply the following migration. It only CREATES new tables/indexes/constraints —
it does not touch or rewrite any existing table, so it needs only a few MB. PostGIS is
already enabled (the existing `addresses` table uses a geometry column). Run it as one
transaction and report success or the exact error per statement.

-- ============ MIGRATION: geocoding/geofencing tables ============

CREATE TABLE IF NOT EXISTS "batch_geocode_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "api_key_id" uuid NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "input_count" integer NOT NULL,
  "processed_count" integer DEFAULT 0 NOT NULL,
  "results_r2_key" text,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "device_zone_state" (
  "project_id" uuid NOT NULL,
  "device_id" varchar(255) NOT NULL,
  "zone_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "device_zone_state_project_id_device_id_pk" PRIMARY KEY("project_id","device_id")
);

CREATE TABLE IF NOT EXISTS "webhook_subscriptions" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "webhook_subscriptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
  "project_id" uuid NOT NULL,
  "zone_id" integer,
  "url" text NOT NULL,
  "events" text[] DEFAULT ARRAY['entry','exit']::text[] NOT NULL,
  "secret_enc" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "failing" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "zones" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
  "project_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "geom" geometry(Polygon, 4326) NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "batch_geocode_jobs" ADD CONSTRAINT "batch_geocode_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "batch_geocode_jobs" ADD CONSTRAINT "batch_geocode_jobs_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "device_zone_state" ADD CONSTRAINT "device_zone_state_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "zones" ADD CONSTRAINT "zones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "idx_batch_jobs_project_id" ON "batch_geocode_jobs" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "idx_batch_jobs_status" ON "batch_geocode_jobs" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_webhook_subs_project_id" ON "webhook_subscriptions" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "idx_webhook_subs_zone_id" ON "webhook_subscriptions" USING btree ("zone_id");
CREATE INDEX IF NOT EXISTS "idx_zones_project_id" ON "zones" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "idx_zones_geom" ON "zones" USING gist ("geom");

-- Record this migration in Drizzle's tracking table so the app's migrator
-- does not try to re-apply it later.
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '6c8899cf3b56496bb84e819c6ff3accf6e62d9df69af63d1a83c6ddf16f83d97', 1780537255818
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations
  WHERE hash = '6c8899cf3b56496bb84e819c6ff3accf6e62d9df69af63d1a83c6ddf16f83d97'
);

-- ============ VERIFY ============
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('zones','device_zone_state','webhook_subscriptions','batch_geocode_jobs')
ORDER BY table_name;
-- Expect 4 rows: batch_geocode_jobs, device_zone_state, webhook_subscriptions, zones
```

---

## Notes

- **Does NOT touch `addresses`.** The original migration also widened
  `addresses.latitude/longitude` from `real` → `double precision`; that rewrites the
  whole 16.8M-row table (~11 GB temp space, table lock) and was deliberately dropped.
  It is a precision nicety, not required by any feature. Run it separately later in a
  maintenance window if ever wanted.
- **Idempotent.** `IF NOT EXISTS` on tables/indexes and the guarded tracking insert make
  it safe to re-run. (The `ADD CONSTRAINT` lines are not idempotent — if a partial prior
  run left some constraints, the assistant may report "already exists" on those; that's
  fine, they can be skipped.)
- **After it succeeds**, tell me and I'll run the rest of `apps/server/DEPLOY.md`:
  create the 2 queues + R2 bucket, set `KEY_ENC_KEY`, then `wrangler deploy`.
