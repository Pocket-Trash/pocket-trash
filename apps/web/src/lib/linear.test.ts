import { describe, expect, it, vi } from "vitest";
import {
  createLinearIssue,
  getLinearPlanningOptions,
  LINEAR_ENGINEERING_TEAM_ID,
  LINEAR_FEATURE_REQUESTS_PROJECT_ID,
  LinearApiError,
} from "./linear";

describe("Linear feedback planning", () => {
  it("validates the workspace and creates an issue with fixed defaults", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          project: { id: LINEAR_FEATURE_REQUESTS_PROJECT_ID },
          projectStatuses: {
            nodes: [{ id: "planned", name: "Planned" }],
          },
          team: {
            id: LINEAR_ENGINEERING_TEAM_ID,
            labels: { nodes: [{ id: "feature", name: "Feature" }] },
            states: { nodes: [{ id: "todo", name: "Todo" }] },
          },
          viewer: { id: "viewer", name: "Ada" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          issueCreate: {
            issue: { id: "11111111-1111-4111-8111-111111111111" },
            success: true,
          },
        }),
      );

    const options = await getLinearPlanningOptions("secret", request);
    await createLinearIssue(
      "secret",
      {
        description: "Description",
        id: "11111111-1111-4111-8111-111111111111",
        labelIds: ["feature"],
        stateId: options.issueStateId,
        title: "Title",
      },
      request,
    );

    expect(options.viewer).toEqual({ id: "viewer", name: "Ada" });
    const body = JSON.parse(String(request.mock.calls[1]?.[1]?.body));
    expect(body.variables.input).toMatchObject({
      priority: 0,
      projectId: LINEAR_FEATURE_REQUESTS_PROJECT_ID,
      teamId: LINEAR_ENGINEERING_TEAM_ID,
    });
    expect(request.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer secret",
    });
  });

  it("rejects access to a different workspace", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        project: { id: "other-project" },
        projectStatuses: { nodes: [{ id: "planned", name: "Planned" }] },
        team: {
          id: "other-team",
          labels: { nodes: [] },
          states: { nodes: [{ id: "todo", name: "Todo" }] },
        },
        viewer: { id: "viewer", name: "Ada" },
      }),
    );

    await expect(
      getLinearPlanningOptions("secret", request),
    ).rejects.toBeInstanceOf(LinearApiError);
  });
});

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json" },
  });
}
