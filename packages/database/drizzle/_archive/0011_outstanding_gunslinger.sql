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
CREATE INDEX "idx_regions_geom" ON "regions" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "idx_regions_layer" ON "regions" USING btree ("layer");
