import { describe, expect, it } from "vitest";
import {
  assertMutationIsolation,
  verifyMutationTargets,
} from "./mutation-guard";

/** Safe isolated environment accepted by the guard. */
const isolatedEnvironment = {
  BUNNY_IMAGE_FOLDER_PREFIX: "images/preview/pr-42",
  BUNNY_RESOURCE_FOLDER_PREFIX: "resources/preview/pr-42",
  CLERK_PUBLISHABLE_KEY: "pk_test_example",
  CLERK_SECRET_KEY: "sk_test_example",
  E2E_BASE_URL: "https://pocket-trash-git-feature-example.vercel.app",
  E2E_DATABASE_BRANCH: "preview-pr-42",
  E2E_PR_NUMBER: "42",
  E2E_VERCEL_DEPLOYMENT_ID: "dpl_preview",
  DATABASE_URL:
    "postgresql://user:password@ep-isolated-pooler.us-east-2.aws.neon.tech/database",
  NEON_API_KEY: "neon_test_key",
  NEON_PROJECT_ID: "neon_project",
  VERCEL_ORG_ID: "vercel_team",
  VERCEL_TOKEN: "vercel_test_token",
};

/**
 * Returns safe Neon and Vercel API responses for the isolated environment.
 *
 * @param input - Provider API request target.
 * @returns A matching provider API response.
 */
const targetFetch: typeof fetch = async (input) => {
  const url = String(input);
  if (url.endsWith("/branches?limit=10000")) {
    return Response.json({
      branches: [{ id: "br_isolated", name: "preview-pr-42" }],
    });
  }
  if (url.endsWith("/endpoints")) {
    return Response.json({
      endpoints: [
        {
          branch_id: "br_isolated",
          host: "ep-isolated.us-east-2.aws.neon.tech",
        },
      ],
    });
  }
  if (url.includes("api.vercel.com")) {
    return Response.json({
      target: null,
      url: "pocket-trash-git-feature-example.vercel.app",
    });
  }
  return new Response(null, { status: 404 });
};

describe("mutation isolation guard", () => {
  it("accepts the current PR preview and isolated resources", () => {
    expect(assertMutationIsolation(isolatedEnvironment)).toEqual({
      imagePrefix: "images/preview/pr-42",
      prNumber: 42,
      resourcePrefix: "resources/preview/pr-42",
    });
  });

  it.each([
    ["production URL", { E2E_BASE_URL: "https://pocket-trash.app" }],
    ["shared database", { E2E_DATABASE_BRANCH: "preview" }],
    ["shared image prefix", { BUNNY_IMAGE_FOLDER_PREFIX: "images/preview" }],
    [
      "shared resource prefix",
      { BUNNY_RESOURCE_FOLDER_PREFIX: "resources/preview" },
    ],
    ["production publishable key", { CLERK_PUBLISHABLE_KEY: "pk_live_nope" }],
    ["production secret key", { CLERK_SECRET_KEY: "sk_live_nope" }],
  ])("rejects a %s", (_name, override) => {
    expect(() =>
      assertMutationIsolation({ ...isolatedEnvironment, ...override }),
    ).toThrow();
  });

  it("verifies the actual isolated Neon and Vercel targets", async () => {
    await expect(
      verifyMutationTargets(isolatedEnvironment, targetFetch),
    ).resolves.toEqual({
      imagePrefix: "images/preview/pr-42",
      prNumber: 42,
      resourcePrefix: "resources/preview/pr-42",
    });
  });

  it("rejects a shared Neon connection", async () => {
    await expect(
      verifyMutationTargets(
        {
          ...isolatedEnvironment,
          DATABASE_URL:
            "postgresql://user:password@ep-shared-pooler.us-east-2.aws.neon.tech/database",
        },
        targetFetch,
      ),
    ).rejects.toThrow("isolated Neon branch");
  });

  it("rejects a production Vercel deployment", async () => {
    /**
     * Returns a production Vercel target while preserving safe Neon responses.
     *
     * @param input - Provider API request target.
     * @param init - Provider API request options.
     * @returns A matching provider API response.
     */
    const productionFetch: typeof fetch = async (input, init) => {
      if (String(input).includes("api.vercel.com")) {
        return Response.json({
          target: "production",
          url: "pocket-trash-git-feature-example.vercel.app",
        });
      }
      return targetFetch(input, init);
    };

    await expect(
      verifyMutationTargets(isolatedEnvironment, productionFetch),
    ).rejects.toThrow("preview deployment");
  });
});
