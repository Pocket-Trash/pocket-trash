import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { linearTicketTargets } from "../linear.js";
import { createTicketLinear } from "./linear.js";
import type { TicketOperation } from "./model.js";

/** Stable API fixture IDs; no real issues or credentials are used. */
const id = randomUUID();
/**
 * Builds a scoped API response using only fields consumed by the adapter.
 * @param kind - Configured target project.
 * @returns Minimal GraphQL issue fields.
 */
function issue(kind: "bug" | "feature" = "bug") {
  return {
    id,
    url: "https://linear.app/pocket-trash/issue/ENG-9999",
    team: { id: linearTicketTargets.teamId },
    project: {
      id:
        kind === "bug"
          ? linearTicketTargets.bugProjectId
          : linearTicketTargets.featureProjectId,
    },
  };
}

it.each([
  "bug",
  "feature",
] as const)("writes exact %s routing, priority and label policy", async (kind) => {
  const stateId = randomUUID();
  const http = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({
        data: {
          team: {
            states: {
              nodes: [
                {
                  id: stateId,
                  name: kind === "bug" ? "Todo" : "Triage",
                  type: kind === "bug" ? "unstarted" : "triage",
                },
              ],
            },
          },
        },
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        data: { issueCreate: { success: true, issue: issue(kind) } },
      }),
    );
  const operation: TicketOperation = {
    version: 1,
    threadId: "223456789012345678",
    issueId: id,
    kind,
    priority: 2,
    phase: "processing",
    commentIds: [],
    summary: {
      title: "Ticket",
      summary: "Observed defect",
      reproductionSteps: [],
      expectedBehavior: "",
      actualBehavior: "",
      environment: [],
      userImpact: "",
      openQuestions: [],
    },
  };
  await createTicketLinear({ apiKey: "test-key", fetch: http }).createIssue(
    operation,
    "Description",
  );
  const init = http.mock.calls[1]?.[1];
  const input = JSON.parse(String(init?.body)).variables.input;
  expect(input).toMatchObject({
    id,
    teamId: linearTicketTargets.teamId,
    projectId: issue(kind).project.id,
    stateId,
    priority: kind === "bug" ? 2 : 0,
    labelIds:
      kind === "bug"
        ? [
            "3f455699-3d1b-4dfb-8e3a-7b9eb3949f05",
            "eeff2955-1593-47b1-8bcd-f24555ad86c7",
          ]
        : [],
  });
  expect(init?.headers).toEqual({
    authorization: "test-key",
    "content-type": "application/json",
  });
});

it("distinguishes a confirmed absent UUID from GraphQL or transport failure", async () => {
  const http = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ data: { issues: { nodes: [] } } }))
    .mockResolvedValueOnce(
      Response.json({ errors: [{ message: "redact me" }] }),
    )
    .mockResolvedValueOnce(Response.json({}, { status: 503 }));
  const linear = createTicketLinear({ apiKey: "test-key", fetch: http });
  expect(await linear.findIssue(id)).toBeNull();
  await expect(linear.findIssue(id)).rejects.toThrow("GraphQL error");
  await expect(linear.findIssue(id)).rejects.toThrow("503");
  expect(http).toHaveBeenCalledTimes(3);
});

it("rejects duplicate source matches, wrong projects and comment ownership mismatches", async () => {
  const http = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({
        data: {
          attachmentsForURL: {
            nodes: [
              { issue: issue() },
              { issue: { ...issue(), id: randomUUID() } },
            ],
          },
        },
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        data: {
          issues: { nodes: [{ ...issue(), project: { id: randomUUID() } }] },
        },
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        data: { comments: { nodes: [{ id, issue: { id: randomUUID() } }] } },
      }),
    );
  const linear = createTicketLinear({ apiKey: "test-key", fetch: http });
  await expect(
    linear.findByThread("https://discord.com/channels/1/2"),
  ).rejects.toThrow("Multiple");
  await expect(linear.findIssue(id)).rejects.toThrow("project mismatch");
  await expect(linear.hasComment(id, randomUUID())).rejects.toThrow(
    "ownership mismatch",
  );
});

it("preserves signed headers exactly and never sends the Linear API key to upload storage", async () => {
  const http = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 200 }))
    .mockResolvedValueOnce(new Response(null, { status: 413 }))
    .mockResolvedValueOnce(new Response(null, { status: 403 }));
  const linear = createTicketLinear({
    apiKey: "private-test-key",
    fetch: http,
  });
  const slot = {
    assetUrl: "https://uploads.linear.app/file",
    uploadUrl: "https://storage.googleapis.com/file?signature=ephemeral",
    headers: {
      "x-goog-content-length-range": "3,3",
      "content-type": "text/plain",
    },
  };
  expect(await linear.putUpload(slot, Buffer.from("abc"))).toBe(true);
  expect(http.mock.calls[0]?.[1]?.headers).toEqual(slot.headers);
  expect(await linear.putUpload(slot, Buffer.from("abc"))).toBe(false);
  await expect(linear.putUpload(slot, Buffer.from("abc"))).rejects.toThrow(
    "403",
  );
});

it("retains all asset attempt URLs in source-link metadata for erasure without duplicate visible links", async () => {
  const http = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json({ data: { attachmentCreate: { success: true } } }),
    );
  await createTicketLinear({ apiKey: "test-key", fetch: http }).linkThread(
    id,
    "https://discord.com/channels/1/2",
    ["https://uploads.linear.app/old", "https://uploads.linear.app/current"],
  );
  const input = JSON.parse(String(http.mock.calls[0]?.[1]?.body)).variables
    .input;
  expect(input.metadata).toEqual({
    ticketAsset0: "https://uploads.linear.app/old",
    ticketAsset1: "https://uploads.linear.app/current",
  });
});

it("turns permanent upload allocation rejection into omission but preserves transient failures", async () => {
  const http = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({}, { status: 413 }))
    .mockResolvedValueOnce(Response.json({}, { status: 503 }));
  const file = {
    id: "523456789012345678",
    messageId: "323456789012345678",
    name: "a.txt",
    contentType: "text/plain",
    size: 3,
    status: "pending" as const,
  };
  const linear = createTicketLinear({ apiKey: "test-key", fetch: http });
  expect(await linear.prepareUpload(file)).toBeNull();
  await expect(linear.prepareUpload(file)).rejects.toThrow("503");
});

it("checks ambiguous assets with bounded authenticated GET and rejects foreign URLs", async () => {
  const http = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response("x", { status: 206 }))
    .mockResolvedValueOnce(new Response(null, { status: 404 }));
  const linear = createTicketLinear({ apiKey: "test-key", fetch: http });
  expect(await linear.assetExists("https://uploads.linear.app/file")).toBe(
    true,
  );
  expect(http.mock.calls[0]?.[1]).toMatchObject({
    method: "GET",
    redirect: "error",
    headers: { authorization: "test-key", range: "bytes=0-0" },
  });
  expect(await linear.assetExists("https://uploads.linear.app/missing")).toBe(
    false,
  );
  await expect(linear.assetExists("https://example.com/file")).rejects.toThrow(
    "origin",
  );
});
