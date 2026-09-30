ALTER TABLE "erasure_request" ADD CONSTRAINT "erasure_request_verification_provenance_valid" CHECK ("erasure_request"."verified_at" is not null and (
        (
          "erasure_request"."initiator" = 'self'
          and "erasure_request"."verification_method" = 'clerk_reverification'
          and "erasure_request"."verification_reference" is null
          and (
            ("erasure_request"."status" = 'completed' and "erasure_request"."target_clerk_id" is null and "erasure_request"."verified_by_clerk_id" is null)
            or ("erasure_request"."status" <> 'completed' and "erasure_request"."target_clerk_id" is not null and "erasure_request"."verified_by_clerk_id" is not null and "erasure_request"."verified_by_clerk_id" = "erasure_request"."target_clerk_id")
          )
        )
        or (
          "erasure_request"."initiator" = 'admin'
          and "erasure_request"."verified_by_clerk_id" is not null
          and (
            ("erasure_request"."verification_method" in ('authenticated_request', 'verified_email') and "erasure_request"."verification_reference" is not null)
            or ("erasure_request"."verification_method" = 'clerk_webhook' and "erasure_request"."verification_reference" = 'clerk_webhook' and "erasure_request"."verified_by_clerk_id" = 'clerk_webhook')
          )
          and (
            ("erasure_request"."status" = 'completed' and "erasure_request"."target_clerk_id" is null)
            or ("erasure_request"."status" <> 'completed' and "erasure_request"."target_clerk_id" is not null)
          )
        )
      ));
