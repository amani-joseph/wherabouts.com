CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_addresses_geom" ON "addresses" USING gist ("geom");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_usage_daily_user_date" ON "api_usage_daily" USING btree ("user_id","usage_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_usage_daily_user_date_endpoint" ON "api_usage_daily" USING btree ("user_id","usage_date","endpoint");
