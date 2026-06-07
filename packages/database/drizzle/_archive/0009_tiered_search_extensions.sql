CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "population_score" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "admin_level" smallint NOT NULL DEFAULT 5;
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_addresses_search_text_btree"
ON "addresses" USING btree ("search_text" text_pattern_ops);
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_addresses_population_score"
ON "addresses" ("population_score" DESC);
