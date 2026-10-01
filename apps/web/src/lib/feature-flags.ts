import type { FeatureFlagAudience } from "@package/feature-flags";
import type {
  Actor,
  AdminTargetingFeatureFlag,
  FeatureFlagListItem,
  UserBetaFeatureFlag,
} from "@package/services";
import { hasPermission } from "@package/services/authorization";
import { createServerFn } from "@tanstack/react-start";
import { activeAuth as auth } from "@/lib/auth";
import { getActor, requirePermission } from "@/lib/authorization";
import { localizedServerError } from "@/lib/server-errors";

/** Clerk user fields exposed by the feature-flag administrator search. */
export type ClerkUserSearchResult = {
  /** Clerk user ID. */
  clerkId: string;
  /** Primary email address, or `null` when unavailable. */
  email: string | null;
  /** Profile image URL, or `null` when unavailable. */
  imageUrl: string | null;
  /** Best available display name. */
  name: string;
  /** Clerk username, or `null` when unavailable. */
  username: string | null;
};

/** Reports whether the current actor may manage feature flags.
 *
 * @returns Whether the actor has feature-flag management permission.
 * @rejects When authentication or actor resolution fails.
 */
export const canManageFeatureFlags = createServerFn().handler(async () => {
  return hasPermission(await getActor(), "feature_flags.manage");
});

/** Lists all feature flags for an authorized administrator.
 *
 * @returns Administrator-visible feature flags.
 * @rejects When authorization, service loading, or flag lookup fails.
 */
export const listAdminFeatureFlags = createServerFn().handler(
  async (): Promise<FeatureFlagListItem[]> => {
    await requireFeatureFlagAdmin();

    const { s } = await import("@/lib/services");
    return await s.flags.listAdmin();
  },
);

/** Creates an administrator-managed feature flag.
 *
 * @returns The created feature flag.
 * @rejects When validation, authorization, or persistence fails.
 */
export const createAdminFeatureFlag = createServerFn({ method: "POST" })
  .validator(parseCreateFeatureFlagInput)
  .handler(async ({ data }): Promise<FeatureFlagListItem> => {
    const actor = await requireFeatureFlagAdmin();

    const { s } = await import("@/lib/services");
    return await s.flags.create({
      actor,
      audience: data.audience,
      defaultEnabled: data.defaultEnabled,
      description: data.description,
      name: data.name,
      slug: data.slug,
    });
  });

/** Updates an administrator-managed feature flag.
 *
 * @returns The updated feature flag.
 * @rejects When validation, authorization, or persistence fails.
 */
export const updateAdminFeatureFlag = createServerFn({ method: "POST" })
  .validator(parseUpdateFeatureFlagInput)
  .handler(async ({ data }): Promise<FeatureFlagListItem> => {
    const actor = await requireFeatureFlagAdmin();

    const { s } = await import("@/lib/services");
    return await s.flags.update({
      actor,
      defaultEnabled: data.defaultEnabled,
      description: data.description,
      name: data.name,
      slug: data.slug,
    });
  });

/** Archives an administrator-managed feature flag.
 *
 * @rejects When validation, authorization, or persistence fails.
 */
export const archiveAdminFeatureFlag = createServerFn({ method: "POST" })
  .validator(parseSlugInput)
  .handler(async ({ data }): Promise<void> => {
    const actor = await requireFeatureFlagAdmin();

    const { s } = await import("@/lib/services");
    await s.flags.archive({
      actor,
      slug: data.slug,
    });
  });

/** Searches Clerk users for feature-flag targeting administration.
 *
 * @returns Valid Clerk user summaries from the first ten matches.
 * @rejects When validation, authorization, configuration, or Clerk lookup fails.
 */
export const searchFeatureFlagUsers = createServerFn({ method: "GET" })
  .validator(parseSearchUsersInput)
  .handler(async ({ data }): Promise<ClerkUserSearchResult[]> => {
    await requireFeatureFlagAdmin();

    const { serverEnv } = await import("@/env/server");
    const response = await fetch(
      `https://api.clerk.com/v1/users?${new URLSearchParams({
        limit: "10",
        query: data.query,
      })}`,
      {
        headers: {
          Authorization: `Bearer ${serverEnv.CLERK_SECRET_KEY}`,
        },
      },
    );

    if (!response.ok) {
      throw localizedServerError("error.generic");
    }

    const users = (await response.json()) as unknown;

    return parseClerkUsers(users);
  });

/** Lists administrator-controlled flag targeting for a Clerk user.
 *
 * @returns Feature flags and overrides for the target Clerk user.
 * @rejects When validation, authorization, or flag lookup fails.
 */
export const listAdminTargetingForUser = createServerFn({ method: "GET" })
  .validator(parseTargetUserInput)
  .handler(async ({ data }): Promise<AdminTargetingFeatureFlag[]> => {
    await requireFeatureFlagAdmin();

    const { s } = await import("@/lib/services");
    return await s.flags.listAdminTargetingForUser(data.targetClerkId);
  });

/** Sets an administrator-owned feature-flag override for a user.
 * Missing, archived, or non-admin flags are left unchanged.
 *
 * @rejects When validation, authorization, or persistence fails.
 */
export const setAdminFeatureFlagForUser = createServerFn({ method: "POST" })
  .validator(parseSetAdminOverrideInput)
  .handler(async ({ data }) => {
    const actor = await requireFeatureFlagAdmin();

    const { s } = await import("@/lib/services");
    await s.flags.setAdminOverride({
      actor,
      enabled: data.enabled,
      slug: data.slug,
      targetClerkId: data.targetClerkId,
    });
  });

/** Lists beta flags available to the current authenticated user.
 *
 * @returns Beta flags and the user's current preferences.
 * @rejects When authentication, service loading, or flag lookup fails.
 */
export const listUserBetaFeatureFlags = createServerFn().handler(
  async (): Promise<UserBetaFeatureFlag[]> => {
    const clerkId = await requireAuthenticatedUser();

    const { s } = await import("@/lib/services");
    return await s.flags.listUserBeta(clerkId);
  },
);

/** Sets the current user's preference for an available beta flag.
 * Missing, archived, or non-user flags are left unchanged.
 *
 * @rejects When validation, authentication, or persistence fails.
 */
export const setUserBetaFeatureFlag = createServerFn({ method: "POST" })
  .validator(parseSetUserPreferenceInput)
  .handler(async ({ data }) => {
    const actorClerkId = await requireAuthenticatedUser();

    const { s } = await import("@/lib/services");
    await s.flags.setUserPreference({
      actorClerkId,
      enabled: data.enabled,
      slug: data.slug,
    });
  });

/** Requires the current Clerk user identity.
 *
 * @returns The authenticated Clerk user ID.
 * @rejects When authentication fails, the request is anonymous, or a user ID is absent.
 */
async function requireAuthenticatedUser(): Promise<string> {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    throw localizedServerError("error.generic");
  }

  return userId;
}

/**
 * Requires a feature-flag administrator.
 *
 * @returns Normalized authorized actor.
 * @rejects When authentication fails or the requester lacks feature-flag management permission.
 */
async function requireFeatureFlagAdmin(): Promise<Actor> {
  return await requirePermission("feature_flags.manage");
}

/** Normalizes a feature-flag creation payload.
 *
 * @param input - Untrusted request payload.
 * @returns Validated creation fields.
 * @throws When the payload or any supplied field is invalid.
 */
function parseCreateFeatureFlagInput(input: unknown) {
  const value = parseRecord(input);

  return {
    audience: parseAudience(value.audience),
    defaultEnabled: parseOptionalBoolean(value.defaultEnabled),
    description: parseOptionalString(value.description),
    name: parseRequiredString(value.name),
    slug: parseRequiredString(value.slug),
  };
}

/** Normalizes a feature-flag update payload.
 *
 * @param input - Untrusted request payload.
 * @returns Validated update fields.
 * @throws When the payload or any supplied field is invalid.
 */
function parseUpdateFeatureFlagInput(input: unknown) {
  const value = parseRecord(input);

  return {
    defaultEnabled: parseOptionalBoolean(value.defaultEnabled),
    description: parseOptionalString(value.description),
    name: parseOptionalRequiredString(value.name),
    slug: parseRequiredString(value.slug),
  };
}

/** Parses a required feature-flag slug.
 *
 * @param input - Untrusted request payload.
 * @returns The normalized slug field.
 * @throws When the payload or slug is invalid.
 */
function parseSlugInput(input: unknown) {
  const value = parseRecord(input);

  return {
    slug: parseRequiredString(value.slug),
  };
}

/** Parses a required Clerk user search query.
 *
 * @param input - Untrusted request payload.
 * @returns The normalized query field.
 * @throws When the payload or query is invalid.
 */
function parseSearchUsersInput(input: unknown) {
  const value = parseRecord(input);

  return {
    query: parseRequiredString(value.query),
  };
}

/** Parses a required target Clerk user ID.
 *
 * @param input - Untrusted request payload.
 * @returns The normalized target user field.
 * @throws When the payload or target user ID is invalid.
 */
function parseTargetUserInput(input: unknown) {
  const value = parseRecord(input);

  return {
    targetClerkId: parseRequiredString(value.targetClerkId),
  };
}

/** Parses an administrator feature-flag override.
 *
 * @param input - Untrusted request payload.
 * @returns Validated target, slug, and enabled state.
 * @throws When the payload or any supplied field is invalid.
 */
function parseSetAdminOverrideInput(input: unknown) {
  const value = parseRecord(input);

  return {
    enabled: parseRequiredBoolean(value.enabled),
    slug: parseRequiredString(value.slug),
    targetClerkId: parseRequiredString(value.targetClerkId),
  };
}

/** Parses a user beta-feature preference.
 *
 * @param input - Untrusted request payload.
 * @returns Validated slug and enabled state.
 * @throws When the payload or either supplied field is invalid.
 */
function parseSetUserPreferenceInput(input: unknown) {
  const value = parseRecord(input);

  return {
    enabled: parseRequiredBoolean(value.enabled),
    slug: parseRequiredString(value.slug),
  };
}

/** Requires a non-null object request payload.
 *
 * @param input - Untrusted request payload.
 * @returns The payload as a string-keyed record.
 * @throws When the payload is not an object.
 */
function parseRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null) {
    throw localizedServerError("error.generic");
  }

  return input as Record<string, unknown>;
}

/** Validates a feature-flag audience.
 *
 * @param input - Untrusted audience value.
 * @returns The supported audience.
 * @throws When the audience is unsupported.
 */
function parseAudience(input: unknown): FeatureFlagAudience {
  if (input === "global" || input === "admin" || input === "user") {
    return input;
  }

  throw localizedServerError("error.generic");
}

/** Normalizes a required non-empty string.
 *
 * @param input - Untrusted field value.
 * @returns The trimmed string.
 * @throws When the value is not a non-empty string.
 */
function parseRequiredString(input: unknown): string {
  if (typeof input !== "string" || !input.trim()) {
    throw localizedServerError("error.generic");
  }

  return input.trim();
}

/** Normalizes an optional nullable string while preserving sentinels.
 *
 * @param input - Untrusted field value.
 * @returns A trimmed string, `null`, or `undefined`.
 * @throws When a present non-null value is not a non-empty string.
 */
function parseOptionalString(input: unknown): string | null | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (input === null) {
    return null;
  }

  return parseRequiredString(input);
}

/** Normalizes an optional string when present.
 *
 * @param input - Untrusted field value.
 * @returns A trimmed non-empty string, or `undefined`.
 * @throws When a present value is not a non-empty string.
 */
function parseOptionalRequiredString(input: unknown): string | undefined {
  return input === undefined ? undefined : parseRequiredString(input);
}

/** Requires a boolean field value.
 *
 * @param input - Untrusted field value.
 * @returns The boolean value.
 * @throws When the value is not boolean.
 */
function parseRequiredBoolean(input: unknown): boolean {
  if (typeof input !== "boolean") {
    throw localizedServerError("error.generic");
  }

  return input;
}

/** Validates an optional boolean field.
 *
 * @param input - Untrusted field value.
 * @returns The boolean value, or `undefined` when omitted.
 * @throws When a present value is not boolean.
 */
function parseOptionalBoolean(input: unknown): boolean | undefined {
  return input === undefined ? undefined : parseRequiredBoolean(input);
}

/** Converts a Clerk list response into searchable user summaries.
 *
 * @param input - Untrusted Clerk response payload.
 * @returns User summaries, excluding entries without a Clerk user ID.
 */
function parseClerkUsers(input: unknown): ClerkUserSearchResult[] {
  const data = Array.isArray(input)
    ? input
    : typeof input === "object" &&
        input !== null &&
        "data" in input &&
        Array.isArray(input.data)
      ? input.data
      : [];

  return data.map(parseClerkUser).filter((user) => user !== null);
}

/** Converts one Clerk user payload into a search result.
 *
 * @param input - Untrusted Clerk user payload.
 * @returns A user summary, or `null` when no Clerk ID is present.
 */
function parseClerkUser(input: unknown): ClerkUserSearchResult | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const record = input as Record<string, unknown>;
  const clerkId = typeof record.id === "string" ? record.id : null;

  if (!clerkId) {
    return null;
  }

  const email = getPrimaryEmail(record);
  const username = typeof record.username === "string" ? record.username : null;
  const firstName =
    typeof record.first_name === "string" ? record.first_name : "";
  const lastName = typeof record.last_name === "string" ? record.last_name : "";
  const fullName = `${firstName} ${lastName}`.trim();

  return {
    clerkId,
    email,
    imageUrl: typeof record.image_url === "string" ? record.image_url : null,
    name: fullName || username || email || clerkId,
    username,
  };
}

/** Selects a Clerk user's primary email with a first-address fallback.
 *
 * @param record - Parsed Clerk user record.
 * @returns The selected email address, or `null` when unavailable.
 */
function getPrimaryEmail(record: Record<string, unknown>): string | null {
  const primaryId =
    typeof record.primary_email_address_id === "string"
      ? record.primary_email_address_id
      : null;
  const emails = Array.isArray(record.email_addresses)
    ? record.email_addresses
    : [];
  const primary = emails.find(
    (email) =>
      typeof email === "object" &&
      email !== null &&
      "id" in email &&
      email.id === primaryId,
  );
  const fallback = primary ?? emails[0];

  return typeof fallback === "object" &&
    fallback !== null &&
    "email_address" in fallback &&
    typeof fallback.email_address === "string"
    ? fallback.email_address
    : null;
}
