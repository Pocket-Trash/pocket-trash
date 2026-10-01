CREATE TABLE "user_ban" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"reason" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_ban_status_valid" CHECK ("user_ban"."status" in ('pending_ban', 'banned', 'pending_unban', 'unbanned')),
	CONSTRAINT "user_ban_reason_nonblank" CHECK (length(btrim("user_ban"."reason")) > 0)
);
--> statement-breakpoint
ALTER TABLE "user_ban" ADD CONSTRAINT "user_ban_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;