import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { type WebhookDelivery, WebhookIntakeError } from "./app.js";
import type { DeliveryJob, QueuedNotification } from "./queue.js";

/** GitHub webhook headers required before a delivery can be accepted. */
const githubHeadersSchema = z.object({
  delivery: z.string().min(1).max(200),
  event: z.string().min(1).max(100),
});

/** Strict GitHub SHA-256 signature header. */
const githubSignatureSchema = z.string().regex(/^sha256=[a-f0-9]{64}$/u);

/** Repository identity shared by supported GitHub webhook events. */
const repositorySchema = z.object({
  full_name: z.string().min(1),
  html_url: z.url(),
});

/** GitHub actor identity shared by supported webhook events. */
const actorSchema = z.object({ login: z.string().min(1) });

/** Pull-request reference metadata used for routing and display. */
const pullRequestRefSchema = z.object({
  label: z.string().min(1),
  repo: z.object({ full_name: z.string().min(1) }),
});

/** Supported pull-request webhook payload. */
const pullRequestPayloadSchema = z.object({
  action: z.enum([
    "opened",
    "reopened",
    "ready_for_review",
    "converted_to_draft",
    "synchronize",
    "review_requested",
    "review_request_removed",
    "closed",
  ]),
  pull_request: z.object({
    base: pullRequestRefSchema,
    created_at: z.iso.datetime(),
    head: pullRequestRefSchema,
    html_url: z.url(),
    merged: z.boolean(),
    number: z.number().int().positive(),
    title: z.string().min(1),
    updated_at: z.iso.datetime(),
  }),
  repository: repositorySchema,
  requested_reviewer: actorSchema.optional(),
  requested_team: z.object({ name: z.string().min(1) }).optional(),
  sender: actorSchema,
});

/** Supported pull-request review webhook payload. */
const reviewPayloadSchema = z.object({
  action: z.enum(["submitted", "dismissed"]),
  pull_request: z.object({
    base: pullRequestRefSchema,
    head: pullRequestRefSchema,
    html_url: z.url(),
    number: z.number().int().positive(),
    title: z.string().min(1),
  }),
  repository: repositorySchema,
  review: z.object({
    body: z.string().optional().nullable(),
    html_url: z.url(),
    state: z.string().min(1),
    submitted_at: z.iso.datetime().optional().nullable(),
  }),
  sender: actorSchema,
});

/** Supported workflow-run webhook payload. */
const workflowRunPayloadSchema = z.object({
  action: z.literal("completed"),
  repository: repositorySchema,
  sender: actorSchema,
  workflow_run: z.object({
    actor: actorSchema,
    conclusion: z.enum([
      "action_required",
      "cancelled",
      "failure",
      "skipped",
      "timed_out",
      "success",
    ]),
    display_title: z.string().min(1),
    event: z.string().min(1),
    head_branch: z.string().optional().nullable(),
    head_repository: z.object({ full_name: z.string().min(1) }),
    html_url: z.url(),
    name: z.string().min(1),
    run_number: z.number().int().positive(),
    updated_at: z.iso.datetime(),
  }),
});

/** Supported manual notification test payload. */
const workflowDispatchPayloadSchema = z.object({
  ref: z.string().min(1),
  repository: repositorySchema,
  sender: actorSchema,
  workflow: z.string().min(1),
});

/** Webhook events that can produce Discord notifications. */
type GitHubEventName =
  | "pull_request"
  | "pull_request_review"
  | "workflow_dispatch"
  | "workflow_run";

/** Renderer-ready portion of one normalized GitHub delivery job. */
interface GitHubDeliveryFields {
  /** Environment-specific Discord destination. */
  destinationChannelId: string;
  /** Serializable approved-card content. */
  notification: QueuedNotification;
}

/** Dependencies needed to authenticate and route GitHub deliveries. */
export interface GitHubWebhookOptions {
  /** Destination for pull-request, review, and manual-test notifications. */
  channelId: string;
  /** Destination for failed workflow notifications. */
  errorsChannelId: string;
  /** GitHub repository webhook secret. */
  secret: string;
}

/** GitHub actions that appear in human-readable notification copy. */
const pullRequestActionLabels = {
  closed: "closed",
  converted_to_draft: "converted to draft",
  opened: "opened",
  ready_for_review: "marked ready for review",
  reopened: "reopened",
  review_request_removed: "removed a review request from",
  review_requested: "requested a review on",
  synchronize: "updated",
} as const;

/** GitHub workflow conclusions routed to the error channel. */
const failedWorkflowConclusions = new Set([
  "action_required",
  "cancelled",
  "failure",
  "skipped",
  "timed_out",
]);

/** GitHub workflow names allowed to notify Discord. */
const notifiedWorkflows = new Set(["CI", "Logger Live"]);

/**
 * Creates the authenticated GitHub webhook normalizer.
 *
 * @param options - Webhook secret and environment-specific destinations.
 * @returns A normalizer suitable for the shared webhook intake boundary.
 * @rejects When a request is unauthenticated or malformed.
 */
export function createGitHubWebhookNormalizer(options: GitHubWebhookOptions) {
  /**
   * Authenticates and normalizes one raw GitHub delivery.
   *
   * @param request - Untrusted GitHub webhook request.
   * @returns A queue delivery, or undefined for an intentionally ignored event.
   */
  return async (
    request: Request,
  ): Promise<WebhookDelivery<DeliveryJob> | undefined> => {
    const headers = githubHeadersSchema.safeParse({
      delivery: request.headers.get("x-github-delivery"),
      event: request.headers.get("x-github-event"),
    });
    if (!headers.success) {
      throw new WebhookIntakeError(400, "GitHub webhook headers are invalid.");
    }

    const body = Buffer.from(await request.arrayBuffer());
    const signature = githubSignatureSchema.safeParse(
      request.headers.get("x-hub-signature-256"),
    );
    if (!signature.success) {
      throw new WebhookIntakeError(401, "GitHub webhook signature is invalid.");
    }
    const expected = Buffer.from(
      `sha256=${createHmac("sha256", options.secret).update(body).digest("hex")}`,
    );
    const received = Buffer.from(signature.data);
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      throw new WebhookIntakeError(401, "GitHub webhook signature is invalid.");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(body.toString("utf8"));
    } catch {
      throw new WebhookIntakeError(400, "GitHub webhook body is not JSON.");
    }

    const event = headers.data.event as GitHubEventName;
    const normalized = normalizeGitHubEvent(event, payload, options);
    if (!normalized) return undefined;

    return {
      id: headers.data.delivery,
      payload: {
        deliveryId: headers.data.delivery,
        ...normalized,
        kind: "github",
        version: 1,
      },
    };
  };
}

/**
 * Converts a supported GitHub event into a renderer-ready queue payload.
 *
 * @param event - GitHub webhook event header.
 * @param payload - Parsed but untrusted request body.
 * @param options - Environment-specific destinations.
 * @returns The routed notification, or undefined when the event is ignored.
 */
function normalizeGitHubEvent(
  event: GitHubEventName,
  payload: unknown,
  options: GitHubWebhookOptions,
): GitHubDeliveryFields | undefined {
  switch (event) {
    case "pull_request":
      return normalizePullRequest(payload, options.channelId);
    case "pull_request_review":
      return normalizeReview(payload, options.channelId);
    case "workflow_run":
      return normalizeWorkflowRun(payload, options.errorsChannelId);
    case "workflow_dispatch":
      return normalizeWorkflowDispatch(payload, options.channelId);
    default:
      return undefined;
  }
}

/**
 * Normalizes one pull-request event and suppresses fork-origin activity.
 *
 * @param payload - Parsed GitHub payload.
 * @param destinationChannelId - Normal GitHub notification destination.
 * @returns A renderer-ready delivery, or undefined for a fork.
 */
function normalizePullRequest(
  payload: unknown,
  destinationChannelId: string,
): GitHubDeliveryFields | undefined {
  const event = parsePayload(pullRequestPayloadSchema, payload);
  const pullRequest = event.pull_request;
  if (pullRequest.head.repo.full_name !== event.repository.full_name)
    return undefined;

  const merged = event.action === "closed" && pullRequest.merged;
  const reviewer =
    event.requested_reviewer?.login ?? event.requested_team?.name;
  const action = merged ? "merged" : pullRequestActionLabels[event.action];
  return {
    destinationChannelId,
    notification: {
      actions: [
        { label: "Open PR", url: pullRequest.html_url },
        { label: "View checks", url: `${pullRequest.html_url}/checks` },
        { label: "Compare changes", url: `${pullRequest.html_url}/files` },
      ],
      description: `${event.sender.login} ${action} pull request #${pullRequest.number}.${reviewer ? ` Reviewer: ${reviewer}.` : ""}`,
      occurredAt: pullRequest.updated_at,
      provenance: `opened by ${event.sender.login}`,
      source: "GitHub",
      status: merged ? "Pull request merged" : `Pull request ${action}`,
      tags: [
        event.repository.full_name,
        `#${pullRequest.number}`,
        `${pullRequest.base.label} ← ${pullRequest.head.label}`,
      ],
      title: pullRequest.title,
      titleUrl: pullRequest.html_url,
      tone: merged ? "success" : event.action === "closed" ? "warning" : "info",
    },
  };
}

/**
 * Normalizes one pull-request review event and suppresses fork-origin activity.
 *
 * @param payload - Parsed GitHub payload.
 * @param destinationChannelId - Normal GitHub notification destination.
 * @returns A renderer-ready delivery, or undefined for a fork.
 */
function normalizeReview(
  payload: unknown,
  destinationChannelId: string,
): GitHubDeliveryFields | undefined {
  const event = parsePayload(reviewPayloadSchema, payload);
  const pullRequest = event.pull_request;
  if (pullRequest.head.repo.full_name !== event.repository.full_name)
    return undefined;

  const state =
    event.action === "dismissed"
      ? "dismissed"
      : event.review.state.toLowerCase();
  const tone =
    state === "approved"
      ? "success"
      : state === "changes_requested"
        ? "warning"
        : "info";
  return {
    destinationChannelId,
    notification: {
      actions: [
        { label: "Open review", url: event.review.html_url },
        { label: "Open PR", url: pullRequest.html_url },
      ],
      description: `${event.sender.login} ${state.replaceAll("_", " ")} pull request #${pullRequest.number}.`,
      diagnostics: event.review.body
        ? [truncate(event.review.body, 1_000)]
        : undefined,
      occurredAt: event.review.submitted_at ?? new Date().toISOString(),
      provenance: `reviewed by ${event.sender.login}`,
      source: "GitHub",
      status: "Pull request review",
      tags: [event.repository.full_name, `#${pullRequest.number}`, state],
      title: pullRequest.title,
      titleUrl: event.review.html_url,
      tone,
    },
  };
}

/**
 * Normalizes a failed selected workflow and suppresses successful or fork runs.
 *
 * @param payload - Parsed GitHub payload.
 * @param destinationChannelId - GitHub error notification destination.
 * @returns A renderer-ready delivery, or undefined when the run is ignored.
 */
function normalizeWorkflowRun(
  payload: unknown,
  destinationChannelId: string,
): GitHubDeliveryFields | undefined {
  const lifecycle = z.object({ action: z.string() }).safeParse(payload);
  if (
    lifecycle.success &&
    ["requested", "in_progress"].includes(lifecycle.data.action)
  )
    return undefined;
  const event = parsePayload(workflowRunPayloadSchema, payload);
  const run = event.workflow_run;
  if (
    run.head_repository.full_name !== event.repository.full_name ||
    !notifiedWorkflows.has(run.name) ||
    !failedWorkflowConclusions.has(run.conclusion)
  ) {
    return undefined;
  }

  return {
    destinationChannelId,
    notification: {
      actions: [
        { label: "Open run", url: run.html_url },
        { label: "Repository", url: event.repository.html_url },
      ],
      description: `${run.name} completed with conclusion ${run.conclusion.replaceAll("_", " ")}.`,
      occurredAt: run.updated_at,
      provenance: `triggered by ${run.actor.login}`,
      source: "GitHub Actions",
      status: "CI workflow failed",
      tags: [
        event.repository.full_name,
        run.name,
        run.head_branch ?? run.event,
      ],
      title: run.display_title,
      titleUrl: run.html_url,
      tone: "error",
    },
  };
}

/**
 * Normalizes a manual webhook delivery used to verify end-to-end routing.
 *
 * @param payload - Parsed GitHub payload.
 * @param destinationChannelId - Normal GitHub notification destination.
 * @returns A renderer-ready delivery.
 */
function normalizeWorkflowDispatch(
  payload: unknown,
  destinationChannelId: string,
): GitHubDeliveryFields {
  const event = parsePayload(workflowDispatchPayloadSchema, payload);
  return {
    destinationChannelId,
    notification: {
      actions: [{ label: "Open repository", url: event.repository.html_url }],
      description: `${event.sender.login} sent a manual Discord notification test.`,
      occurredAt: new Date().toISOString(),
      provenance: `triggered by ${event.sender.login}`,
      source: "GitHub",
      status: "Manual notification test",
      tags: [event.repository.full_name, event.ref, event.workflow],
      title: "GitHub webhook delivery succeeded",
      titleUrl: event.repository.html_url,
      tone: "info",
    },
  };
}

/**
 * Parses one event-specific payload and maps schema failures to HTTP 400.
 *
 * @param schema - Event-specific runtime schema.
 * @param payload - Parsed untrusted payload.
 * @returns The validated payload.
 * @throws {WebhookIntakeError} When the payload does not match its event schema.
 * @template T - Validated event payload type.
 */
function parsePayload<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (result.success) return result.data;
  throw new WebhookIntakeError(400, "GitHub webhook payload is invalid.");
}

/**
 * Truncates optional diagnostic copy to a Discord-safe size.
 *
 * @param value - Untrusted source copy.
 * @param maximum - Maximum returned character count.
 * @returns The original or ellipsis-truncated copy.
 */
function truncate(value: string, maximum: number): string {
  return value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;
}
