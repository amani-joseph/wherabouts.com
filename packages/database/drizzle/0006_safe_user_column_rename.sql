DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'projects'
			AND column_name = 'clerk_user_id'
	) AND NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'projects'
			AND column_name = 'user_id'
	) THEN
		ALTER TABLE "projects" RENAME COLUMN "clerk_user_id" TO "user_id";
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'api_keys'
			AND column_name = 'clerk_user_id'
	) AND NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'api_keys'
			AND column_name = 'user_id'
	) THEN
		ALTER TABLE "api_keys" RENAME COLUMN "clerk_user_id" TO "user_id";
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'api_usage_daily'
			AND column_name = 'clerk_user_id'
	) AND NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'api_usage_daily'
			AND column_name = 'user_id'
	) THEN
		ALTER TABLE "api_usage_daily" RENAME COLUMN "clerk_user_id" TO "user_id";
	END IF;
END $$;
