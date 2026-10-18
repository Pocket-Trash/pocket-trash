import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createWebhookIntake } from "./app.js";
import { createGitHubWebhookNormalizer } from "./github.js";

/** Fixed webhook secret used to sign test requests. */
const secret = "github-webhook-secret-at-least-32-characters";
/** Valid environment-specific destinations used by tests. */
const destinations = {
  channelId: "123456789012345678",
  errorsChannelId: "223456789012345678",
  secret,
};
/** Shared repository fixture. */
const repository = {
  full_name: "Pocket-Trash/pocket-trash",
  html_url: "https://github.com/Pocket-Trash/pocket-trash",
};
/** Shared actor fixture. */
const sender = { login: "royanger" };

/**
 * Creates a correctly signed GitHub webhook request.
 *
 * @param event - GitHub event header.
 * @param payload - JSON request body.
 * @param signatureSecret - Secret used for the signature.
 * @returns Signed webhook request.
 */
function githubRequest(
  event: string,
  payload: unknown,
  signatureSecret = secret,
) {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", signatureSecret)
    .update(body)
    .digest("hex");
  return new Request("https://bot.example/webhooks/github", {
    body,
    headers: {
      "content-type": "application/json",
      "x-github-delivery": "delivery-123",
      "x-github-event": event,
      "x-hub-signature-256": `sha256=${signature}`,
    },
    method: "POST",
  });
}

/**
 * Builds a supported pull-request payload.
 *
 * @param fullName - Head repository used to test fork suppression.
 * @returns Pull-request fixture payload.
 */
function pullRequestPayload(fullName = repository.full_name) {
  return {
    action: "ready_for_review",
    pull_request: {
      base: {
        label: "Pocket-Trash:main",
        repo: { full_name: repository.full_name },
      },
      created_at: "2026-10-17T20:00:00.000Z",
      head: { label: "royanger:feature", repo: { full_name: fullName } },
      html_url: `${repository.html_url}/pull/412`,
      merged: false,
      number: 412,
      title: "Configure Discord resource validation",
      updated_at: "2026-10-17T20:05:00.000Z",
    },
    repository,
    sender,
  };
}

describe("GitHub webhook intake", () => {
  it.each([
    "requested",
    "in_progress",
  ])("ignores the normal workflow_run %s lifecycle action", async (action) => {
    const enqueue = vi.fn();
    const handle = createWebhookIntake({
      enqueue,
      normalize: createGitHubWebhookNormalizer(destinations),
    });
    expect(
      await handle(githubRequest("workflow_run", { action })),
    ).toMatchObject({ status: 204 });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("authenticates and queues a normalized pull-request delivery", async () => {
    const enqueue = vi.fn().mockResolvedValue({ accepted: true });
    const handle = createWebhookIntake({
      enqueue,
      normalize: createGitHubWebhookNormalizer(destinations),
    });

    expect(
      await handle(githubRequest("pull_request", pullRequestPayload())),
    ).toMatchObject({ status: 202 });
    expect(enqueue).toHaveBeenCalledWith({
      id: "delivery-123",
      payload: expect.objectContaining({
        deliveryId: "delivery-123",
        destinationChannelId: destinations.channelId,
        kind: "github",
        notification: expect.objectContaining({
          status: "Pull request marked ready for review",
          title: "Configure Discord resource validation",
        }),
        version: 1,
      }),
    });
  });

  it("rejects invalid signatures before queue access", async () => {
    const enqueue = vi.fn();
    const handle = createWebhookIntake({
      enqueue,
      normalize: createGitHubWebhookNormalizer(destinations),
    });

    expect(
      await handle(
        githubRequest("pull_request", pullRequestPayload(), "wrong-secret"),
      ),
    ).toMatchObject({ status: 401 });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("returns 400 for a signed malformed supported payload", async () => {
    const handle = createWebhookIntake({
      enqueue: vi.fn(),
      normalize: createGitHubWebhookNormalizer(destinations),
    });

    expect(
      await handle(githubRequest("pull_request", { action: "opened" })),
    ).toMatchObject({ status: 400 });
  });

  it("suppresses fork pull requests without queueing", async () => {
    const enqueue = vi.fn();
    const handle = createWebhookIntake({
      enqueue,
      normalize: createGitHubWebhookNormalizer(destinations),
    });

    expect(
      await handle(
        githubRequest("pull_request", pullRequestPayload("fork/repo")),
      ),
    ).toMatchObject({ status: 204 });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it.each([
    "opened",
    "reopened",
    "ready_for_review",
    "converted_to_draft",
    "synchronize",
    "review_requested",
    "review_request_removed",
    "closed",
  ])("accepts the pull-request %s action", async (action) => {
    const enqueue = vi.fn().mockResolvedValue({ accepted: true });
    const handle = createWebhookIntake({
      enqueue,
      normalize: createGitHubWebhookNormalizer(destinations),
    });
    const payload = { ...pullRequestPayload(), action };

    expect(await handle(githubRequest("pull_request", payload))).toMatchObject({
      status: 202,
    });
  });

  it.each([
    "submitted",
    "dismissed",
  ])("accepts the pull-request review %s action", async (action) => {
    const enqueue = vi.fn().mockResolvedValue({ accepted: true });
    const handle = createWebhookIntake({
      enqueue,
      normalize: createGitHubWebhookNormalizer(destinations),
    });
    const pullRequest = pullRequestPayload().pull_request;
    const payload = {
      action,
      pull_request: pullRequest,
      repository,
      review: {
        body: "The queue boundary looks good.",
        html_url: `${pullRequest.html_url}#pullrequestreview-1`,
        state: "approved",
        submitted_at: "2026-10-17T20:05:00.000Z",
      },
      sender,
    };

    expect(
      await handle(githubRequest("pull_request_review", payload)),
    ).toMatchObject({ status: 202 });
  });

  it("accepts a manual workflow dispatch test", async () => {
    const enqueue = vi.fn().mockResolvedValue({ accepted: true });
    const handle = createWebhookIntake({
      enqueue,
      normalize: createGitHubWebhookNormalizer(destinations),
    });

    expect(
      await handle(
        githubRequest("workflow_dispatch", {
          ref: "main",
          repository,
          sender,
          workflow: ".github/workflows/ci.yml",
        }),
      ),
    ).toMatchObject({ status: 202 });
  });

  it("suppresses successful workflows", async () => {
    const enqueue = vi.fn();
    const handle = createWebhookIntake({
      enqueue,
      normalize: createGitHubWebhookNormalizer(destinations),
    });
    const payload = {
      action: "completed",
      repository,
      sender,
      workflow_run: {
        actor: sender,
        conclusion: "success",
        display_title: "CI",
        event: "pull_request",
        head_branch: "feature",
        head_repository: { full_name: repository.full_name },
        html_url: `${repository.html_url}/actions/runs/1`,
        name: "CI",
        run_number: 1,
        updated_at: "2026-10-17T20:05:00.000Z",
      },
    };

    expect(await handle(githubRequest("workflow_run", payload))).toMatchObject({
      status: 204,
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("routes failed selected workflows to the error channel", async () => {
    const enqueue = vi.fn().mockResolvedValue({ accepted: true });
    const handle = createWebhookIntake({
      enqueue,
      normalize: createGitHubWebhookNormalizer(destinations),
    });
    const payload = {
      action: "completed",
      repository,
      sender,
      workflow_run: {
        actor: sender,
        conclusion: "failure",
        display_title: "Migration validation",
        event: "pull_request",
        head_branch: "feature",
        head_repository: { full_name: repository.full_name },
        html_url: `${repository.html_url}/actions/runs/1`,
        name: "CI",
        run_number: 1,
        updated_at: "2026-10-17T20:05:00.000Z",
      },
    };

    expect(await handle(githubRequest("workflow_run", payload))).toMatchObject({
      status: 202,
    });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          destinationChannelId: destinations.errorsChannelId,
        }),
      }),
    );
  });
});
