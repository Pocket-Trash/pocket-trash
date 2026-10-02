ALTER TABLE "user_collection" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "user_collection" ADD CONSTRAINT "user_collection_description_length_valid" CHECK ("user_collection"."description" is null or char_length("user_collection"."description") <= 5000) NOT VALID;--> statement-breakpoint
ALTER TABLE "user_collection" ADD CONSTRAINT "user_collection_summary_length_valid" CHECK ("user_collection"."summary" is null or char_length("user_collection"."summary") <= 200);
