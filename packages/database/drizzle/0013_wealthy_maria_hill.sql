CREATE TABLE "billing_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" text NOT NULL,
	"team_id" uuid,
	"user_id" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"status" text DEFAULT 'free' NOT NULL,
	"has_payment_method" boolean DEFAULT false NOT NULL,
	"free_allotment" integer DEFAULT 10000 NOT NULL,
	"current_period_start" date,
	"current_period_requests" integer DEFAULT 0 NOT NULL,
	"blocked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_meter_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_account_id" uuid NOT NULL,
	"usage_date" date NOT NULL,
	"reported_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_meter_reports" ADD CONSTRAINT "billing_meter_reports_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_billing_accounts_team" ON "billing_accounts" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_billing_accounts_user" ON "billing_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_billing_accounts_stripe_customer" ON "billing_accounts" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_billing_meter_reports_account_date" ON "billing_meter_reports" USING btree ("billing_account_id","usage_date");--> statement-breakpoint
CREATE INDEX "idx_billing_meter_reports_account" ON "billing_meter_reports" USING btree ("billing_account_id");