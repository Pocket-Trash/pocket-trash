create function block_erasing_account_write() returns trigger
language plpgsql
as $$
declare
  column_name text;
  subject_id text;
begin
  foreach column_name in array tg_argv loop
    subject_id := to_jsonb(new) ->> column_name;
    if subject_id is null or subject_id = '' then
      continue;
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended('account-erasure:' || subject_id, 0)
    );
    if exists (
      select 1 from erasure_request
      where target_clerk_id = subject_id
        and status in ('pending', 'running', 'needs_attention')
    ) then
      raise exception 'Account erasure is in progress.';
    end if;
  end loop;
  return new;
end;
$$;
--> statement-breakpoint
create trigger users_block_erasing_account_write
before insert or update of clerk_id on users
for each row execute function block_erasing_account_write('clerk_id');
--> statement-breakpoint
create trigger user_collection_block_erasing_account_write
before insert or update of privated_by_clerk_id on user_collection
for each row execute function block_erasing_account_write('privated_by_clerk_id');
--> statement-breakpoint
create trigger collection_item_block_erasing_account_write
before insert or update of privated_by_clerk_id on collection_item
for each row execute function block_erasing_account_write('privated_by_clerk_id');
--> statement-breakpoint
create trigger collection_image_block_erasing_account_write
before insert or update of uploaded_by_clerk_id on collection_image
for each row execute function block_erasing_account_write('uploaded_by_clerk_id');
--> statement-breakpoint
create trigger collection_item_image_block_erasing_account_write
before insert or update of uploaded_by_clerk_id, deleted_by_clerk_id on collection_item_image
for each row execute function block_erasing_account_write('uploaded_by_clerk_id', 'deleted_by_clerk_id');
--> statement-breakpoint
create trigger product_block_erasing_account_write
before insert or update of owner_clerk_id, privated_by_clerk_id on product
for each row execute function block_erasing_account_write('owner_clerk_id', 'privated_by_clerk_id');
--> statement-breakpoint
create trigger product_image_block_erasing_account_write
before insert or update of uploaded_by_clerk_id, deleted_by_clerk_id on product_image
for each row execute function block_erasing_account_write('uploaded_by_clerk_id', 'deleted_by_clerk_id');
--> statement-breakpoint
create trigger resources_block_erasing_account_write
before insert or update of uploader_clerk_id, privated_by_clerk_id, deleted_by_clerk_id on resources
for each row execute function block_erasing_account_write('uploader_clerk_id', 'privated_by_clerk_id', 'deleted_by_clerk_id');
--> statement-breakpoint
create trigger resource_categories_block_erasing_account_write
before insert or update of created_by_clerk_id on resource_categories
for each row execute function block_erasing_account_write('created_by_clerk_id');
--> statement-breakpoint
create trigger resource_downloads_block_erasing_account_write
before insert or update of user_clerk_id on resource_downloads
for each row execute function block_erasing_account_write('user_clerk_id');
--> statement-breakpoint
create trigger resource_notifications_block_erasing_account_write
before insert or update of uploader_clerk_id, read_by_clerk_id on resource_notifications
for each row execute function block_erasing_account_write('uploader_clerk_id', 'read_by_clerk_id');
--> statement-breakpoint
create trigger feedback_block_erasing_account_write
before insert or update of submitter_clerk_id on feedback
for each row execute function block_erasing_account_write('submitter_clerk_id');
--> statement-breakpoint
create trigger feedback_votes_block_erasing_account_write
before insert or update of voter_clerk_id on feedback_votes
for each row execute function block_erasing_account_write('voter_clerk_id');
--> statement-breakpoint
create trigger feedback_notifications_block_erasing_account_write
before insert or update of read_by_clerk_id on feedback_notifications
for each row execute function block_erasing_account_write('read_by_clerk_id');
--> statement-breakpoint
create trigger feature_flags_block_erasing_account_write
before insert or update of archived_by_clerk_id, created_by_clerk_id, updated_by_clerk_id on feature_flags
for each row execute function block_erasing_account_write('archived_by_clerk_id', 'created_by_clerk_id', 'updated_by_clerk_id');
--> statement-breakpoint
create trigger feature_flag_user_overrides_block_erasing_account_write
before insert or update of created_by_clerk_id, updated_by_clerk_id on feature_flag_user_overrides
for each row execute function block_erasing_account_write('created_by_clerk_id', 'updated_by_clerk_id');
--> statement-breakpoint
create trigger upload_session_block_erasing_account_write
before insert or update of uploader_clerk_id on upload_session
for each row execute function block_erasing_account_write('uploader_clerk_id');
--> statement-breakpoint
create trigger storage_object_deletion_block_erasing_account_write
before insert or update of owner_clerk_id on storage_object_deletion
for each row execute function block_erasing_account_write('owner_clerk_id');
