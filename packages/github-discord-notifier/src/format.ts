/** A field displayed in a Discord embed. */
export type DiscordEmbedField = {
  /** The field label. */
  name: string;
  /** The field content. */
  value: string;
  /** Whether Discord may render the field beside other inline fields. */
  inline?: boolean;
};

/** The Discord embed used for a GitHub notification. */
export type DiscordEmbed = {
  /** The embed title. */
  title: string;
  /** The embed summary. */
  description: string;
  /** The GitHub page opened from the embed title. */
  url: string;
  /** The decimal Discord embed color. */
  color: number;
  /** The structured event details. */
  fields: DiscordEmbedField[];
  /** The embed footer. */
  footer: {
    /** The repository shown in the footer. */
    text: string;
  };
  /** The ISO 8601 time when the notification was built. */
  timestamp: string;
};

/** The webhook payload sent to Discord. */
export type DiscordPayload = {
  /** The mention policy for the webhook message. */
  allowed_mentions: {
    /** The mention categories Discord may parse. */
    parse: [];
  };
  /** The single event embed. */
  embeds: [DiscordEmbed];
  /** The action row containing the GitHub link. */
  components: [
    {
      /** Discord's action-row component type. */
      type: 1;
      /** The link button in the action row. */
      components: [
        {
          /** Discord's button component type. */
          type: 2;
          /** Discord's link-button style. */
          style: 5;
          /** The text displayed on the button. */
          label: string;
          /** The GitHub page opened by the button. */
          url: string;
        },
      ];
    },
  ];
};

/** A formatted GitHub notification ready for delivery. */
export type Notification = {
  /** The Discord webhook request body. */
  payload: DiscordPayload;
};

/** GitHub Actions metadata used to format event notifications. */
export type FormatContext = {
  /** The GitHub webhook event name. */
  eventName: string;
  /** The repository in `owner/name` form. */
  repository: string;
  /** The current GitHub Actions run identifier, when available. */
  runId?: string;
  /** The base URL of the GitHub server. */
  serverUrl: string;
  /** The triggering commit SHA, when available. */
  sha?: string;
};

/** A named color available to notification formatters. */
type ColorName = "amber" | "blue" | "gray" | "green" | "red";

/** Discord embed colors keyed by semantic color name. */
const colors = {
  amber: 0xf59e0b,
  blue: 0x2563eb,
  gray: 0x6b7280,
  green: 0x16a34a,
  red: 0xdc2626,
} as const satisfies Record<ColorName, number>;

/** Discord's maximum embed-title length. */
const maxTitleLength = 256;
/** Discord's maximum embed-description length. */
const maxDescriptionLength = 4096;
/** Discord's maximum embed-field value length. */
const maxFieldValueLength = 1024;

/**
 * Formats a supported GitHub event as a Discord notification.
 *
 * @param context - Metadata for the triggering workflow run.
 * @param event - The untrusted GitHub event payload.
 * @returns The notification, or `undefined` for unsupported, ignored, or incomplete events.
 */
export function formatGitHubNotification(
  context: FormatContext,
  event: unknown,
): Notification | undefined {
  switch (context.eventName) {
    case "pull_request":
      return formatPullRequest(context, asObject(event));
    case "pull_request_review":
      return formatPullRequestReview(context, asObject(event));
    case "push":
      return formatPush(context, asObject(event));
    case "workflow_run":
      return formatWorkflowRun(context, asObject(event));
    case "workflow_dispatch":
      return buildNotification({
        color: "blue",
        context,
        description: "Manual Discord notification test from GitHub Actions.",
        fields: [
          field("Repository", context.repository, true),
          field("Workflow run", workflowRunUrl(context), true),
        ],
        group: "Checks",
        title: "Manual notification test",
        url: workflowRunUrl(context),
      });
    default:
      return undefined;
  }
}

/**
 * Formats a pull-request event.
 *
 * @param context - Metadata for the triggering workflow run.
 * @param event - The GitHub pull-request event payload.
 * @returns The formatted notification, or `undefined` when required data is absent.
 */
function formatPullRequest(
  context: FormatContext,
  event: Record<string, unknown>,
): Notification | undefined {
  const action = stringValue(event.action);
  const pullRequest = asObject(event.pull_request);
  const actor = login(event.sender);
  const url = stringValue(pullRequest.html_url);
  const title = stringValue(pullRequest.title) || "Untitled pull request";
  const number = numberValue(pullRequest.number);
  const merged = booleanValue(pullRequest.merged);
  const base = refName(pullRequest.base);
  const head = refName(pullRequest.head);
  const requestedReviewer = login(event.requested_reviewer);
  const requestedTeam = stringValue(asObject(event.requested_team).name);

  if (!action || !url || !number) {
    return undefined;
  }

  if (action === "closed" && merged) {
    return buildNotification({
      color: "green",
      context,
      description: `${actor} merged pull request #${number}.`,
      fields: prFields({
        action,
        actor,
        base,
        head,
        pullRequest,
        requestedReviewer,
        requestedTeam,
      }),
      group: "Merge",
      title: `#${number} ${title}`,
      url,
    });
  }

  const color = pullRequestColor(action);
  const actionText = pullRequestActionText(action);
  const notificationTitle =
    action === "synchronize" ? `#${number} ${title}` : `#${number} ${title}`;

  return buildNotification({
    color,
    context,
    description: `${actor} ${actionText} pull request #${number}.`,
    fields: prFields({
      action,
      actor,
      base,
      head,
      pullRequest,
      requestedReviewer,
      requestedTeam,
    }),
    group: action === "closed" ? "Merge" : "Pull Request",
    title: notificationTitle,
    url,
  });
}

/**
 * Formats a pull-request review event.
 *
 * @param context - Metadata for the triggering workflow run.
 * @param event - The GitHub pull-request review event payload.
 * @returns The formatted notification, or `undefined` when required data is absent.
 */
function formatPullRequestReview(
  context: FormatContext,
  event: Record<string, unknown>,
): Notification | undefined {
  const action = stringValue(event.action);
  const pullRequest = asObject(event.pull_request);
  const review = asObject(event.review);
  const actor = login(event.sender);
  const url = stringValue(review.html_url) || stringValue(pullRequest.html_url);
  const title = stringValue(pullRequest.title) || "Untitled pull request";
  const number = numberValue(pullRequest.number);
  const state = stringValue(review.state).toLowerCase();

  if (!action || !url || !number) {
    return undefined;
  }

  const color = reviewColor(action, state);
  const stateText = reviewStateText(action, state);

  return buildNotification({
    color,
    context,
    description: `${actor} ${stateText} on pull request #${number}.`,
    fields: [
      field("Actor", actor, true),
      field("State", state || action, true),
      field("Pull request", `#${number}`, true),
      field("URL", url),
    ],
    group: "Review",
    title: `#${number} ${title}`,
    url,
  });
}

/**
 * Formats a push to the `main` branch.
 *
 * @param context - Metadata for the triggering workflow run.
 * @param event - The GitHub push event payload.
 * @returns The formatted notification, or `undefined` for pushes outside `main`.
 */
function formatPush(
  context: FormatContext,
  event: Record<string, unknown>,
): Notification | undefined {
  const ref = stringValue(event.ref);
  if (ref !== "refs/heads/main") {
    return undefined;
  }

  const commits = arrayValue(event.commits);
  const compareUrl = stringValue(event.compare);
  const headCommit = asObject(event.head_commit);
  const url =
    compareUrl || stringValue(headCommit.url) || repositoryUrl(context);
  const actor = login(event.sender);
  const commitCount = commits.length;

  return buildNotification({
    color: "blue",
    context,
    description: `${actor} pushed ${commitCount} ${pluralize(
      "commit",
      commitCount,
    )} to main.`,
    fields: [
      field("Actor", actor, true),
      field("Branch", "main", true),
      field("Commits", String(commitCount), true),
      field("URL", url),
    ],
    group: "Main",
    title: "New commit on main",
    url,
  });
}

/**
 * Formats a completed workflow run with a notifiable conclusion.
 *
 * @param context - Metadata for the triggering workflow run.
 * @param event - The GitHub workflow-run event payload.
 * @returns The formatted notification, or `undefined` when no alert is needed.
 */
function formatWorkflowRun(
  context: FormatContext,
  event: Record<string, unknown>,
): Notification | undefined {
  const workflowRun = asObject(event.workflow_run);
  const conclusion = stringValue(workflowRun.conclusion);
  const status = stringValue(workflowRun.status);
  const url = stringValue(workflowRun.html_url);
  const workflowName =
    stringValue(workflowRun.name) || stringValue(asObject(event.workflow).name);
  const actor = login(workflowRun.actor) || login(event.sender);

  if (!url || !workflowName || status !== "completed") {
    return undefined;
  }

  if (!isNotifiableWorkflowConclusion(conclusion)) {
    return undefined;
  }

  return buildNotification({
    color: workflowConclusionColor(conclusion),
    context,
    description: `${workflowName} completed with conclusion: ${conclusion}.`,
    fields: [
      field("Workflow", workflowName, true),
      field("Conclusion", conclusion, true),
      field("Actor", actor, true),
      field("URL", url),
    ],
    group: "Checks",
    title: `${workflowName} ${conclusion}`,
    url,
  });
}

/**
 * Builds the canonical Discord notification payload.
 *
 * @param input - Content and presentation settings for the notification.
 * @returns A notification with Discord-safe lengths and mentions disabled.
 */
function buildNotification(input: {
  /** The semantic embed color. */
  color: ColorName;
  /** Metadata for the triggering workflow run. */
  context: FormatContext;
  /** The event summary. */
  description: string;
  /** The event details. */
  fields: DiscordEmbedField[];
  /** The category prefixed to the embed title. */
  group: string;
  /** The event-specific embed title. */
  title: string;
  /** The GitHub page opened from the notification. */
  url: string;
}): Notification {
  const title = truncate(`[${input.group}] ${input.title}`, maxTitleLength);
  const description = truncate(input.description, maxDescriptionLength);
  const url = input.url;

  return {
    payload: {
      allowed_mentions: {
        parse: [],
      },
      embeds: [
        {
          title,
          description,
          url,
          color: colors[input.color],
          fields: input.fields.map((item) => ({
            ...item,
            value: truncate(item.value, maxFieldValueLength),
          })),
          footer: {
            text: input.context.repository,
          },
          timestamp: new Date().toISOString(),
        },
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: "Open in GitHub",
              url,
            },
          ],
        },
      ],
    },
  };
}

/**
 * Builds the common fields for a pull-request notification.
 *
 * @param input - Pull-request event values used by the embed.
 * @returns The fields whose optional values are present.
 */
function prFields(input: {
  /** The pull-request action. */
  action: string;
  /** The GitHub login that triggered the event. */
  actor: string;
  /** The pull request's base branch. */
  base: string;
  /** The pull request's head branch. */
  head: string;
  /** The pull-request payload object. */
  pullRequest: Record<string, unknown>;
  /** The requested reviewer's login, when present. */
  requestedReviewer: string;
  /** The requested team's name, when present. */
  requestedTeam: string;
}): DiscordEmbedField[] {
  const url = stringValue(input.pullRequest.html_url);
  const fields = [
    field("Actor", input.actor, true),
    field("Action", input.action, true),
    field("Base", input.base, true),
    field("Head", input.head, true),
  ];

  if (input.requestedReviewer) {
    fields.push(field("Reviewer", input.requestedReviewer, true));
  }

  if (input.requestedTeam) {
    fields.push(field("Team", input.requestedTeam, true));
  }

  if (url) {
    fields.push(field("URL", url));
  }

  return fields;
}

/**
 * Creates a Discord embed field.
 *
 * @param name - The field label.
 * @param value - The field content, or an empty value to display `Unknown`.
 * @param inline - Whether Discord may render the field inline.
 * @returns The embed field.
 */
function field(
  name: string,
  value: string,
  inline?: boolean,
): DiscordEmbedField {
  return {
    name,
    value: value || "Unknown",
    ...(inline === undefined ? {} : { inline }),
  };
}

/**
 * Maps a pull-request action to an embed color.
 *
 * @param action - The GitHub pull-request action.
 * @returns The semantic embed color.
 */
function pullRequestColor(action: string): ColorName {
  switch (action) {
    case "closed":
      return "gray";
    case "converted_to_draft":
    case "review_request_removed":
      return "amber";
    default:
      return "blue";
  }
}

/**
 * Converts a pull-request action into notification prose.
 *
 * @param action - The GitHub pull-request action.
 * @returns The human-readable action text.
 */
function pullRequestActionText(action: string): string {
  switch (action) {
    case "opened":
      return "opened";
    case "reopened":
      return "reopened";
    case "ready_for_review":
      return "marked ready for review";
    case "converted_to_draft":
      return "converted to draft";
    case "synchronize":
      return "pushed new commits to";
    case "review_requested":
      return "requested review on";
    case "review_request_removed":
      return "removed a review request from";
    case "closed":
      return "closed without merging";
    default:
      return action.replaceAll("_", " ");
  }
}

/**
 * Maps a review action and state to an embed color.
 *
 * @param action - The GitHub review action.
 * @param state - The GitHub review state.
 * @returns The semantic embed color.
 */
function reviewColor(action: string, state: string): ColorName {
  if (action === "dismissed") {
    return "amber";
  }

  switch (state) {
    case "approved":
      return "green";
    case "changes_requested":
      return "red";
    case "commented":
      return "amber";
    default:
      return "blue";
  }
}

/**
 * Converts a review action and state into notification prose.
 *
 * @param action - The GitHub review action.
 * @param state - The GitHub review state.
 * @returns The human-readable review text.
 */
function reviewStateText(action: string, state: string): string {
  if (action === "dismissed") {
    return "dismissed a review";
  }

  switch (state) {
    case "approved":
      return "approved changes";
    case "changes_requested":
      return "requested changes";
    case "commented":
      return "left a review comment";
    default:
      return action.replaceAll("_", " ");
  }
}

/**
 * Maps a workflow conclusion to an embed color.
 *
 * @param conclusion - The GitHub workflow conclusion.
 * @returns The semantic embed color.
 */
function workflowConclusionColor(conclusion: string): ColorName {
  switch (conclusion) {
    case "failure":
    case "timed_out":
    case "action_required":
      return "red";
    case "cancelled":
    case "skipped":
      return "gray";
    default:
      return "amber";
  }
}

/**
 * Tests whether a workflow conclusion should produce an alert.
 *
 * @param conclusion - The GitHub workflow conclusion.
 * @returns Whether the conclusion is notifiable.
 */
function isNotifiableWorkflowConclusion(conclusion: string): boolean {
  return [
    "action_required",
    "cancelled",
    "failure",
    "skipped",
    "timed_out",
  ].includes(conclusion);
}

/**
 * Builds the repository URL for the configured GitHub server.
 *
 * @param context - Metadata for the triggering workflow run.
 * @returns The repository URL.
 */
function repositoryUrl(context: FormatContext): string {
  return `${context.serverUrl}/${context.repository}`;
}

/**
 * Builds the current workflow-run URL when its identifier is available.
 *
 * @param context - Metadata for the triggering workflow run.
 * @returns The workflow-run URL, or the repository URL as a fallback.
 */
function workflowRunUrl(context: FormatContext): string {
  if (!context.runId) {
    return repositoryUrl(context);
  }

  return `${repositoryUrl(context)}/actions/runs/${context.runId}`;
}

/**
 * Reads a Git ref name from an untrusted payload value.
 *
 * @param refObject - The candidate object containing a `ref` property.
 * @returns The ref name, or an empty string when absent.
 */
function refName(refObject: unknown): string {
  return stringValue(asObject(refObject).ref);
}

/**
 * Reads a GitHub login from an untrusted payload value.
 *
 * @param value - The candidate object containing a `login` property.
 * @returns The login, or an empty string when absent.
 */
function login(value: unknown): string {
  return stringValue(asObject(value).login);
}

/**
 * Pluralizes a noun using a simple trailing `s`.
 *
 * @param noun - The singular noun.
 * @param count - The associated quantity.
 * @returns The singular noun for one, otherwise the plural form.
 */
function pluralize(noun: string, count: number): string {
  return count === 1 ? noun : `${noun}s`;
}

/**
 * Truncates a string to a maximum length using an ellipsis.
 *
 * @param value - The source string.
 * @param maxLength - The maximum returned length.
 * @returns The original or truncated string.
 */
function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

/**
 * Narrows an untrusted value to a non-array object.
 *
 * @param value - The value to inspect.
 * @returns The object, or an empty object for other values.
 */
function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

/**
 * Narrows an untrusted value to an array.
 *
 * @param value - The value to inspect.
 * @returns The array, or an empty array for other values.
 */
function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Narrows an untrusted value to a string.
 *
 * @param value - The value to inspect.
 * @returns The string, or an empty string for other values.
 */
function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Narrows an untrusted value to a number.
 *
 * @param value - The value to inspect.
 * @returns The number, or `undefined` for other values.
 */
function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/**
 * Narrows an untrusted value to a boolean.
 *
 * @param value - The value to inspect.
 * @returns The boolean, or `false` for other values.
 */
function booleanValue(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}
