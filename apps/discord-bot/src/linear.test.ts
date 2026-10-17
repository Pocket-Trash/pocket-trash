import { describe, expect, it, vi } from "vitest";
import {
  createLinearApiKeyAuthentication,
  linearTicketTargets,
} from "./linear.js";

/** Valid access response for the dedicated Linear bot member. */
const validAccess = {
  data: {
    bugProject: { id: linearTicketTargets.bugProjectId },
    featureProject: { id: linearTicketTargets.featureProjectId },
    team: {
      id: linearTicketTargets.teamId,
      key: linearTicketTargets.teamKey,
    },
    viewer: {
      email: linearTicketTargets.actorEmail,
      name: linearTicketTargets.actorName,
      organization: { urlKey: linearTicketTargets.organizationUrlKey },
    },
  },
};

describe("Linear bot authentication", () => {
  it("validates the dedicated actor and required ticket targets", async () => {
    const fetch = vi.fn(async () => Response.json(validAccess));
    const authentication = createLinearApiKeyAuthentication({
      apiKey: "linear-api-key",
      fetch,
    });

    await expect(authentication.validateAccess()).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      "https://api.linear.app/graphql",
      expect.objectContaining({
        headers: {
          authorization: "linear-api-key",
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );
  });

  it("rejects invalid credentials and the wrong actor or resource access", async () => {
    for (const response of [
      new Response(null, { status: 401 }),
      Response.json({
        ...validAccess,
        data: {
          ...validAccess.data,
          viewer: { ...validAccess.data.viewer, name: "Roy Anger" },
        },
      }),
      Response.json({
        ...validAccess,
        data: { ...validAccess.data, bugProject: null },
      }),
    ]) {
      const authentication = createLinearApiKeyAuthentication({
        apiKey: "linear-api-key",
        fetch: vi.fn(async () => response),
      });

      await expect(authentication.validateAccess()).rejects.toThrow("Linear");
    }
  });
});
