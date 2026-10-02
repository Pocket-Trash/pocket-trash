import { reverificationError } from "@clerk/shared/authorization-errors";
import { auth as clerkAuth } from "@clerk/tanstack-react-start/server";
import { type Actor, hasPermission } from "@package/services/authorization";
import { createServerFn } from "@tanstack/react-start";
import { getActor, requireActor, requirePermission } from "@/lib/authorization";
import { localizedServerError } from "@/lib/server-errors";

/** Public progress state for an account-erasure request. */
export type ErasureStatusView = {
  /** Stable erasure request identifier. */
  requestId: string;
  /** Client-facing progress state. */
  status: "processing" | "completed" | "needs_support";
};

/** Administrator view of an account-erasure request. */
export type AdminErasureStatusView = ErasureStatusView & {
  /** Failure code for a request needing support, or `null`. */
  errorCode: string | null;
  /** Clerk user ID being erased, or `null` when unavailable. */
  targetClerkId: string | null;
};

/** Clerk account matched for an administrator erasure request. */
export type ErasureTarget = {
  /** Matched Clerk user ID. */
  clerkId: string;
  /** Normalized target email address. */
  email: string;
  /** Display name, falling back to the email address. */
  name: string;
};

/** Creates a strictly reverified self-service erasure request.
 *
 * @returns A public request status or Clerk's strict-reverification response.
 * @rejects When authentication, hashing, actor resolution, or persistence fails.
 */
export const requestSelfErasure = createServerFn({ method: "POST" })
  .validator(parseSelfErasureInput)
  .handler(async () => {
    const state = await clerkAuth();
    const clerkId = requireSignedInUser(state);
    if (!state.has({ reverification: "strict" })) {
      return reverificationError("strict");
    }

    const { s } = await import("@/lib/services");
    return statusView(
      await s.db.erasure.create({
        actor: await requireActor(),
        initiator: "self",
        subjectHmac: await subjectHmac(clerkId),
        targetClerkId: clerkId,
        verificationMethod: "clerk_reverification",
        verifiedAt: new Date(),
      }),
    );
  });

/** Returns the current user's erasure receipt, `null`, or `signed_out`.
 *
 * @returns The public request status, `null` when none exists, or `signed_out`.
 * @rejects When authentication, hashing, or receipt lookup fails.
 */
export const getSelfErasureStatus = createServerFn().handler(async () => {
  const clerkId = selfErasureClerkId(await clerkAuth());
  if (!clerkId) return "signed_out" as const;
  const { s } = await import("@/lib/services");
  const request = await s.db.erasure.getReceiptBySubject(
    await subjectHmac(clerkId),
  );
  return request ? statusView(request) : null;
});

/** Selects the Clerk ID only from an authenticated auth state.
 *
 * @param state - Authentication state from Clerk.
 * @returns The Clerk user ID, or `null` when signed out or missing an ID.
 */
export function selfErasureClerkId(state: {
  /** Whether Clerk authenticated the request. */
  isAuthenticated: boolean;
  /** Clerk user ID supplied by the auth state. */
  userId: string | null;
}): string | null {
  return state.isAuthenticated ? state.userId : null;
}

/** Reports whether the current actor may administer account erasure.
 *
 * @returns Whether the actor has account-erasure permission.
 * @rejects When authentication or actor resolution fails.
 */
export const canEraseAccounts = createServerFn().handler(async () => {
  return hasPermission(await getActor(), "accounts.erase");
});

/** Finds the Clerk account matching a normalized email for an administrator.
 *
 * @returns The matching Clerk account, or `null` when none matches.
 * @rejects When validation, authorization, configuration, or Clerk lookup fails.
 */
export const findErasureTarget = createServerFn({ method: "GET" })
  .validator(parseEmailInput)
  .handler(async ({ data }) => {
    await requireAdmin();
    return await findClerkUserByEmail(data.email);
  });

/** Creates an administrator-verified account-erasure request.
 *
 * @returns The administrator-visible request status.
 * @rejects When validation, authorization, target verification, or persistence fails.
 */
export const requestAdminErasure = createServerFn({ method: "POST" })
  .validator(parseAdminErasureInput)
  .handler(async ({ data }): Promise<AdminErasureStatusView> => {
    const actor = await requireAdmin();
    const target = await findClerkUserByEmail(data.email);
    if (target?.clerkId !== data.targetClerkId) {
      throw localizedServerError("error.generic");
    }

    const { s } = await import("@/lib/services");
    const request = await s.db.erasure.create({
      actor,
      initiator: "admin",
      subjectHmac: await subjectHmac(target.clerkId),
      targetClerkId: target.clerkId,
      verificationMethod: data.verificationMethod,
      verificationReference: data.verificationReference,
      verifiedAt: new Date(),
    });
    return {
      ...statusView(request),
      errorCode: request.errorCode,
      targetClerkId: target.clerkId,
    };
  });

/** Returns an administrator-visible erasure request, or `null` when absent.
 *
 * @returns The administrator-visible request status, or `null` when absent.
 * @rejects When validation, authorization, or persistence fails.
 */
export const getAdminErasureStatus = createServerFn({ method: "GET" })
  .validator(parseRequestInput)
  .handler(async ({ data }): Promise<AdminErasureStatusView | null> => {
    await requireAdmin();
    const { s } = await import("@/lib/services");
    const request = await s.db.erasure.getForAdmin(data.requestId);
    return request
      ? {
          ...statusView(request),
          errorCode: request.errorCode,
          targetClerkId: request.targetClerkId,
        }
      : null;
  });

/** Retries an erasure request that needs administrator attention.
 *
 * @returns The updated administrator-visible request status.
 * @rejects When validation, authorization, retry, or status lookup fails.
 */
export const retryAdminErasure = createServerFn({ method: "POST" })
  .validator(parseRequestInput)
  .handler(async ({ data }): Promise<AdminErasureStatusView> => {
    const actor = await requireAdmin();
    const { s } = await import("@/lib/services");
    const request = await s.db.erasure.retry({
      actor,
      requestId: data.requestId,
    });
    const adminRequest = await s.db.erasure.getForAdmin(request.id);
    return {
      ...statusView(request),
      errorCode: request.errorCode,
      targetClerkId: adminRequest?.targetClerkId ?? null,
    };
  });

/** Validates explicit confirmation for a self-service erasure request.
 *
 * @param input - Untrusted request payload.
 * @returns The confirmed erasure input.
 * @throws When confirmation is not exactly `true`.
 */
export function parseSelfErasureInput(input: unknown) {
  if (
    typeof input !== "object" ||
    input === null ||
    !("confirmed" in input) ||
    input.confirmed !== true
  ) {
    throw localizedServerError("error.generic");
  }
  return { confirmed: true as const };
}

/** Normalizes and validates administrator erasure evidence.
 *
 * @param input - Untrusted request payload.
 * @returns Bounded target and verification fields.
 * @throws When any required field or verification method is invalid.
 */
export function parseAdminErasureInput(input: unknown) {
  const value = record(input);
  const verificationMethod = value.verificationMethod;
  if (
    verificationMethod !== "authenticated_request" &&
    verificationMethod !== "verified_email"
  ) {
    throw localizedServerError("error.generic");
  }
  return {
    email: email(value.email),
    targetClerkId: requiredString(value.targetClerkId, 120),
    verificationMethod: verificationMethod as
      | "authenticated_request"
      | "verified_email",
    verificationReference: reference(value.verificationReference),
  };
}

/** Parses a target-email request payload.
 *
 * @param input - Untrusted request payload.
 * @returns The normalized target email.
 * @throws When the payload or email is invalid.
 */
function parseEmailInput(input: unknown) {
  return { email: email(record(input).email) };
}

/** Parses a bounded erasure-request identifier.
 *
 * @param input - Untrusted request payload.
 * @returns The normalized request identifier.
 * @throws When the payload or identifier is invalid.
 */
function parseRequestInput(input: unknown) {
  return { requestId: requiredString(record(input).requestId, 120) };
}

/** Requires a non-null object request payload.
 *
 * @param input - Untrusted request payload.
 * @returns The payload as a string-keyed record.
 * @throws When the payload is not an object.
 */
function record(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null) {
    throw localizedServerError("error.generic");
  }
  return input as Record<string, unknown>;
}

/** Normalizes a required string within a maximum length.
 *
 * @param input - Untrusted field value.
 * @param maximum - Maximum accepted character count.
 * @returns The trimmed non-empty value.
 * @throws When the value is missing, non-string, empty, or too long.
 */
function requiredString(input: unknown, maximum: number): string {
  if (typeof input !== "string") throw localizedServerError("error.generic");
  const value = input.trim();
  if (!value || value.length > maximum) {
    throw localizedServerError("error.generic");
  }
  return value;
}

/** Normalizes a bounded email address to lowercase.
 *
 * @param input - Untrusted email value.
 * @returns The normalized email address.
 * @throws When the value is not a valid bounded email address.
 */
function email(input: unknown): string {
  const value = requiredString(input, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) {
    throw localizedServerError("error.generic");
  }
  return value;
}

/** Validates an opaque administrator verification reference.
 *
 * @param input - Untrusted reference value.
 * @returns The bounded reference.
 * @throws When the reference is missing, not a string, too long, or contains unsupported characters.
 */
function reference(input: unknown): string {
  const value = requiredString(input, 120);
  if (!/^[A-Za-z0-9:_-]+$/u.test(value)) {
    throw localizedServerError("error.generic");
  }
  return value;
}

/** Requires an authenticated Clerk user ID.
 *
 * @param state - Authentication state from Clerk.
 * @returns The authenticated Clerk user ID.
 * @throws When the request is signed out or lacks a user ID.
 */
function requireSignedInUser(state: {
  /** Whether Clerk authenticated the request. */
  isAuthenticated: boolean;
  /** Clerk user ID supplied by the auth state. */
  userId: string | null;
}): string {
  if (!state.isAuthenticated || !state.userId) {
    throw localizedServerError("error.generic");
  }
  return state.userId;
}

/**
 * Requires an actor authorized to erase accounts.
 *
 * @returns The normalized administrator actor.
 * @rejects When authentication fails or the current actor lacks account-erasure permission.
 */
async function requireAdmin(): Promise<Actor> {
  return await requirePermission("accounts.erase");
}

/** Finds the first Clerk user whose address matches an email case-insensitively.
 *
 * @param targetEmail - Normalized email address to search for.
 * @returns The matched target, or `null` when no valid user matches.
 * @rejects When configuration loading, the Clerk request, or response decoding fails.
 */
async function findClerkUserByEmail(
  targetEmail: string,
): Promise<ErasureTarget | null> {
  const { serverEnv } = await import("@/env/server");
  const response = await fetch(
    `https://api.clerk.com/v1/users?${new URLSearchParams({
      email_address: targetEmail,
      limit: "2",
    })}`,
    { headers: { Authorization: `Bearer ${serverEnv.CLERK_SECRET_KEY}` } },
  );
  if (!response.ok) throw localizedServerError("error.generic");
  const payload = (await response.json()) as unknown;
  const users = Array.isArray(payload)
    ? payload
    : typeof payload === "object" &&
        payload !== null &&
        "data" in payload &&
        Array.isArray(payload.data)
      ? payload.data
      : [];
  return (
    users
      .map((user) => parseClerkTarget(user, targetEmail))
      .find((user) => user !== null) ?? null
  );
}

/** Derives the privacy-preserving subject hash for a Clerk user.
 *
 * @param clerkId - Clerk user ID to hash.
 * @returns The keyed subject digest.
 * @rejects When configuration, secret validation, or digest generation fails.
 */
async function subjectHmac(clerkId: string): Promise<string> {
  const [{ serverEnv }, { createErasureSubjectHmac }] = await Promise.all([
    import("@/env/server"),
    import("@package/services"),
  ]);
  return await createErasureSubjectHmac(clerkId, serverEnv.ERASURE_HMAC_SECRET);
}

/** Converts an untrusted Clerk user response into an erasure target.
 *
 * @param input - Untrusted Clerk user payload.
 * @param targetEmail - Normalized email that must be present on the user.
 * @returns The target account, or `null` when identity data is invalid or no address matches case-insensitively.
 */
function parseClerkTarget(
  input: unknown,
  targetEmail: string,
): ErasureTarget | null {
  if (typeof input !== "object" || input === null) return null;
  const user = input as Record<string, unknown>;
  const clerkId = typeof user.id === "string" ? user.id : null;
  const addresses = Array.isArray(user.email_addresses)
    ? user.email_addresses
    : [];
  const address = addresses.find(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      "email_address" in item &&
      typeof item.email_address === "string" &&
      item.email_address.toLowerCase() === targetEmail,
  );
  if (!clerkId || !address) return null;
  const name = [user.first_name, user.last_name]
    .filter((part): part is string => typeof part === "string" && !!part)
    .join(" ");
  return { clerkId, email: targetEmail, name: name || targetEmail };
}

/** Maps an internal erasure state to its client-facing status.
 *
 * @param request - Persisted erasure request state.
 * @returns The stable request identifier and public progress state.
 */
function statusView(request: {
  /** Persisted erasure request identifier. */
  id: string;
  /** Internal processing status. */
  status: "pending" | "running" | "completed" | "needs_attention";
}): ErasureStatusView {
  return {
    requestId: request.id,
    status:
      request.status === "completed"
        ? "completed"
        : request.status === "needs_attention"
          ? "needs_support"
          : "processing",
  };
}
