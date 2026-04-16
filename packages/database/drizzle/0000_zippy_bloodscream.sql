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
	"geom" geometry(Point, 4326)
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"secret_hash" text NOT NULL,
	"secret_salt" text NOT NULL,
	"secret_display_suffix" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "api_usage_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"usage_date" date NOT NULL,
	"endpoint" text NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_usage_daily" ADD CONSTRAINT "api_usage_daily_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_addresses_country" ON "addresses" USING btree ("country");--> statement-breakpoint
CREATE INDEX "idx_addresses_state" ON "addresses" USING btree ("country","state");--> statement-breakpoint
CREATE INDEX "idx_addresses_postcode" ON "addresses" USING btree ("postcode");--> statement-breakpoint
CREATE INDEX "idx_addresses_locality" ON "addresses" USING btree ("country","state","locality");--> statement-breakpoint
CREATE INDEX "idx_addresses_street" ON "addresses" USING btree ("locality","street_name");--> statement-breakpoint
CREATE INDEX "idx_addresses_gnaf_pid" ON "addresses" USING btree ("gnaf_pid");--> statement-breakpoint
CREATE INDEX "idx_api_keys_user_id" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_usage_daily_key_date_endpoint" ON "api_usage_daily" USING btree ("api_key_id","usage_date","endpoint");--> statement-breakpoint
CREATE INDEX "idx_api_usage_daily_user_id" ON "api_usage_daily" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_api_usage_daily_api_key_id" ON "api_usage_daily" USING btree ("api_key_id");