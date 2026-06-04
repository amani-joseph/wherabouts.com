CREATE TABLE "batch_geocode_jobs" (
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
ALTER TABLE "batch_geocode_jobs" ADD CONSTRAINT "batch_geocode_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_geocode_jobs" ADD CONSTRAINT "batch_geocode_jobs_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_zone_state" ADD CONSTRAINT "device_zone_state_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zones" ADD CONSTRAINT "zones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_batch_jobs_project_id" ON "batch_geocode_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_batch_jobs_status" ON "batch_geocode_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_webhook_subs_project_id" ON "webhook_subscriptions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_subs_zone_id" ON "webhook_subscriptions" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "idx_zones_project_id" ON "zones" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_zones_geom" ON "zones" USING gist ("geom");