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
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_subscription_id_webhook_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."webhook_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_webhook_attempts_subscription_id" ON "webhook_delivery_attempts" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_attempts_created_at" ON "webhook_delivery_attempts" USING btree ("created_at");
