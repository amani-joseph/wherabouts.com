ALTER TABLE "api_usage_daily" ADD COLUMN "billing_account_id" uuid;--> statement-breakpoint
CREATE INDEX "idx_api_usage_daily_billing_account" ON "api_usage_daily" USING btree ("billing_account_id");