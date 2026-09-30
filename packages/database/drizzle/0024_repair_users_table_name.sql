DO $$
BEGIN
	IF to_regclass('public.users') IS NULL
		AND to_regclass('public."user"') IS NOT NULL THEN
		ALTER TABLE "user" RENAME TO "users";
	END IF;
END $$;
