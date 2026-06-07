CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "addresses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"country" varchar(2) NOT NULL,
	"state" varchar(10) NOT NULL,
	"locality" text NOT NULL,
	"postcode" varchar(10) NOT NULL,
	"street_name" text NOT NULL,
	"street_type" varchar(20),
	"street_suffix" varchar(10),
	"building_name" text,
	"flat_type" varchar(10),
	"flat_number" varchar(10),
	"level_type" varchar(10),
	"level_number" varchar(10),
	"number_first" varchar(15),
	"number_last" varchar(15),
	"longitude" real NOT NULL,
	"latitude" real NOT NULL,
	"confidence" integer,
	"gnaf_pid" varchar(30),
	"search_text" text,
	"geom" geometry(Point, 4326),
	"population_score" integer DEFAULT 0 NOT NULL,
	"admin_level" integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"secret_hash" text NOT NULL,
	"secret_salt" text NOT NULL,
	"secret_display_suffix" text NOT NULL,
	"project_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"team_id" uuid,
	"secret_ciphertext" text,
	"secret_iv" text
);
--> statement-breakpoint
CREATE TABLE "api_usage_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid,
	"usage_date" date NOT NULL,
	"endpoint" text NOT NULL,
	"request_source" text DEFAULT 'production' NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch_geocode_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"api_key_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"input_count" integer NOT NULL,
	"processed_count" integer DEFAULT 0 NOT NULL,
	"results_r2_key" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "device_zone_state" (
	"project_id" uuid NOT NULL,
	"device_id" varchar(255) NOT NULL,
	"zone_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_zone_state_project_id_device_id_pk" PRIMARY KEY("project_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"team_id" uuid
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "regions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"layer" varchar(8) NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"state" text,
	"attrs" jsonb,
	"geom" geometry(MultiPolygon, 4326) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"invited_by" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webhook_delivery_attempts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "webhook_delivery_attempts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"subscription_id" integer NOT NULL,
	"event" varchar(10) NOT NULL,
	"zone_id" integer,
	"device_id" varchar(255),
	"status_code" integer,
	"ok" boolean NOT NULL,
	"attempt" integer NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_subscriptions" (
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
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"geom" geometry(Polygon, 4326) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_daily" ADD CONSTRAINT "api_usage_daily_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_daily" ADD CONSTRAINT "api_usage_daily_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_geocode_jobs" ADD CONSTRAINT "batch_geocode_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_geocode_jobs" ADD CONSTRAINT "batch_geocode_jobs_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_zone_state" ADD CONSTRAINT "device_zone_state_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_subscription_id_webhook_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."webhook_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zones" ADD CONSTRAINT "zones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_unique" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_addresses_country" ON "addresses" USING btree ("country");--> statement-breakpoint
CREATE INDEX "idx_addresses_state" ON "addresses" USING btree ("country","state");--> statement-breakpoint
CREATE INDEX "idx_addresses_postcode" ON "addresses" USING btree ("postcode");--> statement-breakpoint
CREATE INDEX "idx_addresses_locality" ON "addresses" USING btree ("country","state","locality");--> statement-breakpoint
CREATE INDEX "idx_addresses_street" ON "addresses" USING btree ("locality","street_name");--> statement-breakpoint
CREATE INDEX "idx_addresses_gnaf_pid" ON "addresses" USING btree ("gnaf_pid");--> statement-breakpoint
CREATE INDEX "idx_addresses_country_state_postcode" ON "addresses" USING btree ("country","state","postcode");--> statement-breakpoint
CREATE INDEX "idx_addresses_geom" ON "addresses" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "idx_api_keys_user_id" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_project_id" ON "api_keys" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_usage_daily_key_date_endpoint" ON "api_usage_daily" USING btree ("api_key_id","usage_date","endpoint","request_source");--> statement-breakpoint
CREATE INDEX "idx_api_usage_daily_user_id" ON "api_usage_daily" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_api_usage_daily_api_key_id" ON "api_usage_daily" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "idx_api_usage_daily_project_id" ON "api_usage_daily" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_api_usage_daily_user_date" ON "api_usage_daily" USING btree ("user_id","usage_date");--> statement-breakpoint
CREATE INDEX "idx_api_usage_daily_user_date_source" ON "api_usage_daily" USING btree ("user_id","usage_date","request_source");--> statement-breakpoint
CREATE INDEX "idx_api_usage_daily_user_date_endpoint" ON "api_usage_daily" USING btree ("user_id","usage_date","endpoint");--> statement-breakpoint
CREATE INDEX "idx_batch_jobs_project_id" ON "batch_geocode_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_batch_jobs_status" ON "batch_geocode_jobs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_projects_user_slug" ON "projects" USING btree ("user_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_projects_team_slug" ON "projects" USING btree ("team_id","slug");--> statement-breakpoint
CREATE INDEX "idx_projects_user_id" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_regions_geom" ON "regions" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "idx_regions_layer" ON "regions" USING btree ("layer");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_unique" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_team_members_team_user" ON "team_members" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_teams_slug" ON "teams" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_unique" ON "user" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_identifier_value_unique" ON "verification" USING btree ("identifier","value");--> statement-breakpoint
CREATE INDEX "idx_webhook_attempts_subscription_id" ON "webhook_delivery_attempts" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_attempts_created_at" ON "webhook_delivery_attempts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_subs_project_id" ON "webhook_subscriptions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_subs_zone_id" ON "webhook_subscriptions" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "idx_zones_project_id" ON "zones" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_zones_geom" ON "zones" USING gist ("geom");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_addresses_population_score" ON "addresses" ("population_score" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_addresses_search_text_btree" ON "addresses" USING btree ("search_text" text_pattern_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_addresses_search_text_trgm" ON "addresses" USING gin ("search_text" gin_trgm_ops);
