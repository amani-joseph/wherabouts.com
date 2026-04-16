DROP INDEX "api_usage_daily_key_date_endpoint";--> statement-breakpoint
ALTER TABLE "api_usage_daily" ADD COLUMN "request_source" text DEFAULT 'production' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_api_usage_daily_user_date_source" ON "api_usage_daily" USING btree ("user_id","usage_date","request_source");--> statement-breakpoint
CREATE UNIQUE INDEX "api_usage_daily_key_date_endpoint" ON "api_usage_daily" USING btree ("api_key_id","usage_date","endpoint","request_source");