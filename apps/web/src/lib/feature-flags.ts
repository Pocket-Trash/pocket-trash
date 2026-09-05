import { auth } from "@clerk/tanstack-react-start/server";
import type { FeatureFlagAudience } from "@package/feature-flags";
import type {
  AdminTargetingFeatureFlag,
  FeatureFlagListItem,
  UserBetaFeatureFlag,
} from "@package/services";
import { createServerFn } from "@tanstack/react-start";
import { serverEnv } from "@/env/server";
import { localizedServerError } from "@/lib/server-errors";
import { s } from "@/lib/services";

export type ClerkUserSearchResult = {
  clerkId: string;
  email: string | null;
  imageUrl: string | null;
  name: string;
  username: string | null;
};

type SessionClaimsWithRole = {
  role?: unknown;
};

export const isFeatureFlagAdmin = createServerFn().handler(async () => {
  const { isAuthenticated, sessionClaims } = await auth();

  return isAuthenticated && getRole(sessionClaims) === "admin";
});

export const listAdminFeatureFlags = createServerFn().handler(
  async (): Promise<FeatureFlagListItem[]> => {
    await requireFeatureFlagAdmin();

    return await s.flags.listAdmin();
  },
);

export const createAdminFeatureFlag = createServerFn({ method: "POST" })
  .validator(parseCreateFeatureFlagInput)
  .handler(async ({ data }): Promise<FeatureFlagListItem> => {
    const actorClerkId = await requireFeatureFlagAdmin();

    return await s.flags.create({
      actorClerkId,
      audience: data.audience,
      defaultEnabled: data.defaultEnabled,
      description: data.description,
      name: data.name,
      slug: data.slug,
    });
  });

export const updateAdminFeatureFlag = createServerFn({ method: "POST" })
  .validator(parseUpdateFeatureFlagInput)
  .handler(async ({ data }): Promise<FeatureFlagListItem> => {
    const actorClerkId = await requireFeatureFlagAdmin();

    return await s.flags.update({
      actorClerkId,
      defaultEnabled: data.defaultEnabled,
      description: data.description,
      name: data.name,
      slug: data.slug,
    });
  });

export const archiveAdminFeatureFlag = createServerFn({ method: "POST" })
  .validator(parseSlugInput)
  .handler(async ({ data }): Promise<void> => {
    const actorClerkId = await requireFeatureFlagAdmin();

    await s.flags.archive({
      actorClerkId,
      slug: data.slug,
    });
  });

export const searchFeatureFlagUsers = createServerFn({ method: "GET" })
  .validator(parseSearchUsersInput)
  .handler(async ({ data }): Promise<ClerkUserSearchResult[]> => {
    await requireFeatureFlagAdmin();

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

    return await s.flags.listAdminTargetingForUser(data.targetClerkId);
  });

export const setAdminFeatureFlagForUser = createServerFn({ method: "POST" })
  .validator(parseSetAdminOverrideInput)
  .handler(async ({ data }) => {
    const actorClerkId = await requireFeatureFlagAdmin();

    await s.flags.setAdminOverride({
      actorClerkId,
      enabled: data.enabled,
      slug: data.slug,
      targetClerkId: data.targetClerkId,
    });
  });

export const listUserBetaFeatureFlags = createServerFn().handler(
  async (): Promise<UserBetaFeatureFlag[]> => {
    const clerkId = await requireAuthenticatedUser();

    return await s.flags.listUserBeta(clerkId);
  },
);

export const setUserBetaFeatureFlag = createServerFn({ method: "POST" })
  .validator(parseSetUserPreferenceInput)
  .handler(async ({ data }) => {
    const actorClerkId = await requireAuthenticatedUser();

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

async function requireFeatureFlagAdmin(): Promise<string> {
  const { isAuthenticated, sessionClaims, userId } = await auth();

  if (!isAuthenticated || !userId || getRole(sessionClaims) !== "admin") {
    throw localizedServerError("error.generic");
  }

  return userId;
}

function getRole(sessionClaims: unknown): string | undefined {
  const claims = sessionClaims as SessionClaimsWithRole | null | undefined;

  return typeof claims?.role === "string" ? claims.role : undefined;
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
