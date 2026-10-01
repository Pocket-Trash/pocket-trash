/** Feature-flag audience scopes supported across application and persistence layers. */
export const featureFlagAudiences = ["global", "admin", "user"] as const;

/** Audience scope that may own a feature-flag value. */
export type FeatureFlagAudience = (typeof featureFlagAudiences)[number];

/** Sources permitted for audience-specific feature-flag overrides. */
export const featureFlagOverrideSources = ["admin", "user"] as const;

/** Audience scope from which a feature-flag override originates. */
export type FeatureFlagOverrideSource =
  (typeof featureFlagOverrideSources)[number];

/** Actor context used to resolve an audience-specific feature-flag value. */
export type FeatureFlagContext = {
  /** Clerk user ID used for user-scoped evaluation. */
  clerkId?: string;
};

/**
 * Resolves whether a feature flag is enabled for an optional actor context.
 *
 * @param slug - Valid lower-kebab-case feature-flag slug.
 * @param context - Optional actor context for audience-specific evaluation.
 * @returns Whether the feature flag is enabled.
 */
export type FeatureFlagResolver = (
  slug: string,
  context?: FeatureFlagContext,
) => Promise<boolean>;

/**
 * Checks a bound feature flag for an optional actor context.
 *
 * @param context - Optional actor context for audience-specific evaluation.
 * @returns Whether the bound feature flag is enabled.
 */
export type FeatureFlagChecker = (
  context?: FeatureFlagContext,
) => Promise<boolean>;

/** Pattern accepted for stable lower-kebab-case feature-flag slugs. */
const featureFlagSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Checks whether a value is a valid lower-kebab-case feature-flag slug.
 *
 * @param value - Candidate feature-flag slug.
 * @returns Whether the candidate uses the required slug format.
 */
export function isFeatureFlagSlug(value: string): boolean {
  return featureFlagSlugPattern.test(value);
}

/**
 * Asserts that a feature-flag slug uses the required lower-kebab-case format.
 *
 * @param value - Candidate feature-flag slug.
 * @throws When the candidate is not a non-empty lower-kebab-case slug.
 */
export function assertFeatureFlagSlug(value: string): void {
  if (!isFeatureFlagSlug(value)) {
    throw new Error(
      "Feature flag slug must use lowercase letters, numbers, and hyphens.",
    );
  }
}

/**
 * Defines a feature flag from a validated lower-kebab-case slug.
 *
 * @param slug - Candidate feature-flag slug.
 * @returns The unchanged validated slug.
 * @throws When the slug is not a non-empty lower-kebab-case value.
 */
export function defineFlag(slug: string): string {
  assertFeatureFlagSlug(slug);

  return slug;
}

/**
 * Creates a slug-binding factory backed by a feature-flag resolver.
 *
 * @param resolver - Resolver invoked by each bound feature-flag checker.
 * @returns A factory that validates a slug and returns its checker.
 */
export function createFlagChecker(
  resolver: FeatureFlagResolver,
): (slug: string) => FeatureFlagChecker {
  return (slug: string) => {
    const definedSlug = defineFlag(slug);

    return async (context?: FeatureFlagContext) => {
      return await resolver(definedSlug, context);
    };
  };
}
