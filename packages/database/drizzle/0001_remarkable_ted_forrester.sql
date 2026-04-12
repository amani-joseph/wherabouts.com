CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "api_usage_daily" ADD COLUMN "project_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_projects_user_slug" ON "projects" USING btree ("clerk_user_id","slug");--> statement-breakpoint
CREATE INDEX "idx_projects_clerk_user_id" ON "projects" USING btree ("clerk_user_id");--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_daily" ADD CONSTRAINT "api_usage_daily_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_api_keys_project_id" ON "api_keys" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_api_usage_daily_project_id" ON "api_usage_daily" USING btree ("project_id");