ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "search_text" text;
--> statement-breakpoint
UPDATE "addresses"
SET "search_text" = trim(
	concat_ws(
		' ',
		"number_first",
		"number_last",
		"street_name",
		"street_type",
		"street_suffix",
		"building_name",
		"locality",
		"state",
		"postcode",
		"country"
	)
)
WHERE "search_text" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_addresses_search_text_trgm"
ON "addresses"
USING gin ("search_text" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_addresses_country_state_postcode"
ON "addresses"
USING btree ("country","state","postcode");
