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

export type ClerkUserSearchResult = {
  clerkId: string;
  email: string | null;
  imageUrl: string | null;
  name: string;
  username: string | null;
};

export const canManageFeatureFlags = createServerFn().handler(async () => {
  return hasPermission(await getActor(), "feature_flags.manage");
});

export const listAdminFeatureFlags = createServerFn().handler(
  async (): Promise<FeatureFlagListItem[]> => {
    await requireFeatureFlagAdmin();

    const { s } = await import("@/lib/services");
    return await s.flags.listAdmin();
  },
);

/** Creates an administrator-managed feature flag. */
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

/** Updates an administrator-managed feature flag. */
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

/** Archives an administrator-managed feature flag. */
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

export const listAdminTargetingForUser = createServerFn({ method: "GET" })
  .validator(parseTargetUserInput)
  .handler(async ({ data }): Promise<AdminTargetingFeatureFlag[]> => {
    await requireFeatureFlagAdmin();

    const { s } = await import("@/lib/services");
    return await s.flags.listAdminTargetingForUser(data.targetClerkId);
  });

/** Sets an administrator-owned feature-flag override for a user. */
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

export const listUserBetaFeatureFlags = createServerFn().handler(
  async (): Promise<UserBetaFeatureFlag[]> => {
    const clerkId = await requireAuthenticatedUser();

    const { s } = await import("@/lib/services");
    return await s.flags.listUserBeta(clerkId);
  },
);

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
 * @rejects When the requester lacks feature-flag management permission.
 */
async function requireFeatureFlagAdmin(): Promise<Actor> {
  return await requirePermission("feature_flags.manage");
}

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

function parseUpdateFeatureFlagInput(input: unknown) {
  const value = parseRecord(input);

  return {
    defaultEnabled: parseOptionalBoolean(value.defaultEnabled),
    description: parseOptionalString(value.description),
    name: parseOptionalRequiredString(value.name),
    slug: parseRequiredString(value.slug),
  };
}

function parseSlugInput(input: unknown) {
  const value = parseRecord(input);

  return {
    slug: parseRequiredString(value.slug),
  };
}

function parseSearchUsersInput(input: unknown) {
  const value = parseRecord(input);

  return {
    query: parseRequiredString(value.query),
  };
}

function parseTargetUserInput(input: unknown) {
  const value = parseRecord(input);

  return {
    targetClerkId: parseRequiredString(value.targetClerkId),
  };
}

function parseSetAdminOverrideInput(input: unknown) {
  const value = parseRecord(input);

  return {
    enabled: parseRequiredBoolean(value.enabled),
    slug: parseRequiredString(value.slug),
    targetClerkId: parseRequiredString(value.targetClerkId),
  };
}

function parseSetUserPreferenceInput(input: unknown) {
  const value = parseRecord(input);

  return {
    enabled: parseRequiredBoolean(value.enabled),
    slug: parseRequiredString(value.slug),
  };
}

function parseRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null) {
    throw localizedServerError("error.generic");
  }

  return input as Record<string, unknown>;
}

function parseAudience(input: unknown): FeatureFlagAudience {
  if (input === "global" || input === "admin" || input === "user") {
    return input;
  }

  throw localizedServerError("error.generic");
}

function parseRequiredString(input: unknown): string {
  if (typeof input !== "string" || !input.trim()) {
    throw localizedServerError("error.generic");
  }

  return input.trim();
}

function parseOptionalString(input: unknown): string | null | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (input === null) {
    return null;
  }

  return parseRequiredString(input);
}

function parseOptionalRequiredString(input: unknown): string | undefined {
  return input === undefined ? undefined : parseRequiredString(input);
}

function parseRequiredBoolean(input: unknown): boolean {
  if (typeof input !== "boolean") {
    throw localizedServerError("error.generic");
  }

  return input;
}

function parseOptionalBoolean(input: unknown): boolean | undefined {
  return input === undefined ? undefined : parseRequiredBoolean(input);
}

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
