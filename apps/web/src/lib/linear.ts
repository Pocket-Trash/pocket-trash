import { z } from "zod";

/** Feature-request project receiving feedback planned as issues. */
export const LINEAR_FEATURE_REQUESTS_PROJECT_ID =
  "e3e317c2-785e-4ee2-ac4d-e1d77009e2e7";
/** Engineering team owning feedback issues and newly planned projects. */
export const LINEAR_ENGINEERING_TEAM_ID =
  "dc9ab7b9-9d16-4ba4-a0a5-ea3d912acd18";

/** Linear GraphQL endpoint used for authenticated feedback planning. */
const linearEndpoint = "https://api.linear.app/graphql";
/** Identifier and display name returned for a Linear planning choice. */
const entitySchema = z.object({ id: z.string(), name: z.string() });
/** Workspace entities and lifecycle choices required to plan feedback. */
const planningContextSchema = z.object({
  project: z.object({ id: z.string() }),
  projectStatuses: z.object({ nodes: z.array(entitySchema) }),
  team: z.object({
    id: z.string(),
    labels: z.object({ nodes: z.array(entitySchema) }),
    states: z.object({ nodes: z.array(entitySchema) }),
  }),
  viewer: entitySchema,
});
/** Issue creation result, including the reserved identifier when successful. */
const issueMutationSchema = z.object({
  issueCreate: z.object({
    issue: z.object({ id: z.string() }).nullable(),
    success: z.boolean(),
  }),
});
/** Project creation result, including the reserved identifier when successful. */
const projectMutationSchema = z.object({
  projectCreate: z.object({
    project: z.object({ id: z.string() }).nullable(),
    success: z.boolean(),
  }),
});
/** Linear issue status query response. */
const issueStatusSchema = z.object({
  issue: z.object({
    archivedAt: z.string().nullable(),
    id: z.string(),
    state: z.object({ type: z.string() }),
    updatedAt: z.string(),
  }),
});
/** Linear project status query response. */
const projectStatusSchema = z.object({
  project: z.object({
    archivedAt: z.string().nullable(),
    id: z.string(),
    status: z.object({ type: z.string() }),
    updatedAt: z.string(),
  }),
});

/** Validated lifecycle defaults, labels, and viewer for feedback planning. */
export type LinearPlanningOptions = {
  /** Engineering Todo state identifier for new feedback issues. */
  issueStateId: string;
  /** Engineering labels sorted by display name. */
  labels: Array<{
    /** Linear label identifier. */
    id: string;
    /** Label display name. */
    name: string;
  }>;
  /** Planned status identifier for new feedback projects. */
  projectStatusId: string;
  /** OAuth viewer available as an issue assignee or project lead. */
  viewer: {
    /** Linear user identifier. */
    id: string;
    /** Viewer display name. */
    name: string;
  };
};

/** Failure to request, validate, or create a Linear feedback entity. */
export class LinearApiError extends Error {}

/**
 * Loads planning defaults and labels for the configured Engineering team.
 *
 * @param token - Linear OAuth token.
 * @param request - HTTP request implementation.
 * @returns Todo and Planned identifiers, sorted labels, and the OAuth viewer.
 * @rejects When the request fails or configured entities or required states are unavailable.
 */
export async function getLinearPlanningOptions(
  token: string,
  request: typeof fetch = fetch,
): Promise<LinearPlanningOptions> {
  const context = await linearGraphql(
    token,
    `query FeedbackPlanningContext($teamId: String!, $projectId: String!) {
      viewer { id name }
      team(id: $teamId) {
        id
        labels { nodes { id name } }
        states { nodes { id name } }
      }
      project(id: $projectId) { id }
      projectStatuses { nodes { id name } }
    }`,
    {
      projectId: LINEAR_FEATURE_REQUESTS_PROJECT_ID,
      teamId: LINEAR_ENGINEERING_TEAM_ID,
    },
    planningContextSchema,
    request,
  );
  const issueState = context.team.states.nodes.find(
    ({ name }) => name === "Todo",
  );
  const projectStatus = context.projectStatuses.nodes.find(
    ({ name }) => name === "Planned",
  );
  if (
    context.team.id !== LINEAR_ENGINEERING_TEAM_ID ||
    context.project.id !== LINEAR_FEATURE_REQUESTS_PROJECT_ID ||
    !issueState ||
    !projectStatus
  ) {
    throw new LinearApiError("Unexpected Linear workspace.");
  }
  return {
    issueStateId: issueState.id,
    labels: [...context.team.labels.nodes].sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
    projectStatusId: projectStatus.id,
    viewer: context.viewer,
  };
}

/**
 * Creates a feedback issue in Engineering and the feature-request project.
 *
 * @param token - Linear OAuth token.
 * @param input - Reserved issue identifier, content, labels, and planning choices.
 * @param request - HTTP request implementation.
 * @rejects When the request fails or Linear does not confirm the reserved identifier.
 */
export async function createLinearIssue(
  token: string,
  input: {
    /** Optional Linear user assigned to the issue. */
    assigneeId?: string;
    /** Feedback description sent to Linear. */
    description: string;
    /** Reserved UUID used to identify the created issue. */
    id: string;
    /** Engineering label identifiers applied to the issue. */
    labelIds: string[];
    /** Workflow state identifier selected for the issue. */
    stateId: string;
    /** Feedback title sent to Linear. */
    title: string;
  },
  request: typeof fetch = fetch,
) {
  const result = await linearGraphql(
    token,
    `mutation CreateFeedbackIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) { success issue { id } }
    }`,
    {
      input: {
        ...input,
        priority: 0,
        projectId: LINEAR_FEATURE_REQUESTS_PROJECT_ID,
        teamId: LINEAR_ENGINEERING_TEAM_ID,
      },
    },
    issueMutationSchema,
    request,
  );
  if (
    !result.issueCreate.success ||
    result.issueCreate.issue?.id !== input.id
  ) {
    throw new LinearApiError("Linear issue creation failed.");
  }
}

/**
 * Creates a feedback project owned by the Engineering team.
 *
 * @param token - Linear OAuth token.
 * @param input - Reserved project identifier, content, and planning choices.
 * @param request - HTTP request implementation.
 * @rejects When the request fails or Linear does not confirm the reserved identifier.
 */
export async function createLinearProject(
  token: string,
  input: {
    /** Feedback description sent to Linear. */
    description: string;
    /** Reserved UUID used to identify the created project. */
    id: string;
    /** Optional Linear user leading the project. */
    leadId?: string;
    /** Feedback title used as the project name. */
    name: string;
    /** Lifecycle status identifier selected for the project. */
    statusId: string;
  },
  request: typeof fetch = fetch,
) {
  const result = await linearGraphql(
    token,
    `mutation CreateFeedbackProject($input: ProjectCreateInput!) {
      projectCreate(input: $input) { success project { id } }
    }`,
    {
      input: {
        ...input,
        teamIds: [LINEAR_ENGINEERING_TEAM_ID],
      },
    },
    projectMutationSchema,
    request,
  );
  if (
    !result.projectCreate.success ||
    result.projectCreate.project?.id !== input.id
  ) {
    throw new LinearApiError("Linear project creation failed.");
  }
}

/**
 * Checks whether a reserved UUID already exists in Linear.
 *
 * @param token - Linear OAuth token.
 * @param id - Reserved Linear entity identifier.
 * @param request - HTTP request implementation.
 * @returns Whether the issue or project exists.
 */
export async function linearEntityExists(
  token: string,
  id: string,
  request: typeof fetch = fetch,
) {
  try {
    await linearGraphql(
      token,
      `query ExistingFeedbackIssue($id: String!) { issue(id: $id) { id } }`,
      { id },
      z.object({ issue: z.object({ id: z.string() }) }),
      request,
    );
    return true;
  } catch {
    // Linear errors when an ID is not found, so try the other entity type.
  }
  try {
    await linearGraphql(
      token,
      `query ExistingFeedbackProject($id: String!) { project(id: $id) { id } }`,
      { id },
      z.object({ project: z.object({ id: z.string() }) }),
      request,
    );
    return true;
  } catch {
    // Neither entity exists under the reserved UUID.
  }
  return false;
}

/**
 * Loads the current Linear lifecycle state for linked feedback.
 *
 * @param token - Linear OAuth token.
 * @param id - Linked Linear entity identifier.
 * @param request - HTTP request implementation.
 * @returns A feedback lifecycle synchronization input.
 * @rejects When neither a matching issue nor project can be loaded.
 */
export async function getLinearFeedbackStatus(
  token: string,
  id: string,
  request: typeof fetch = fetch,
) {
  try {
    const { issue } = await linearGraphql(
      token,
      `query FeedbackIssueStatus($id: String!) {
        issue(id: $id) { id updatedAt archivedAt state { type } }
      }`,
      { id },
      issueStatusSchema,
      request,
    );
    return linearSyncInput(issue, "issue", issue.state.type);
  } catch {
    const { project } = await linearGraphql(
      token,
      `query FeedbackProjectStatus($id: String!) {
        project(id: $id) { id updatedAt archivedAt status { type } }
      }`,
      { id },
      projectStatusSchema,
      request,
    );
    return linearSyncInput(project, "project", project.status.type);
  }
}

/**
 * Maps a Linear entity response to a feedback synchronization input.
 *
 * @param entity - Linear entity state.
 * @param entityType - Linear entity kind.
 * @param stateType - Linear lifecycle state type.
 * @returns The feedback synchronization input.
 */
function linearSyncInput(
  entity: {
    /** Linear archival timestamp. */
    archivedAt: string | null;
    /** Linear entity identifier. */
    id: string;
    /** Linear update timestamp. */
    updatedAt: string;
  },
  entityType: "issue" | "project",
  stateType: string,
) {
  return {
    action: "sync" as const,
    archived: Boolean(entity.archivedAt),
    entityType,
    entityUuid: entity.id,
    occurredAt: new Date(entity.updatedAt),
    stateType,
  };
}

/**
 * Executes a Linear GraphQL operation and validates its response data.
 *
 * @template T - Data contract accepted by the response schema.
 * @param token - Linear OAuth token.
 * @param query - GraphQL query or mutation text.
 * @param variables - Variables supplied to the operation.
 * @param schema - Validator for the response data envelope.
 * @param request - HTTP request implementation.
 * @returns Validated operation data.
 * @rejects When transport, JSON parsing, GraphQL errors, or schema validation fails.
 */
async function linearGraphql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
  schema: z.ZodType<T>,
  request: typeof fetch,
) {
  let response: Response;
  try {
    response = await request(linearEndpoint, {
      body: JSON.stringify({ query, variables }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch {
    throw new LinearApiError("Linear request failed.");
  }
  if (!response.ok) throw new LinearApiError("Linear request failed.");

  const envelope = z
    .object({
      data: z.unknown().optional(),
      errors: z.array(z.unknown()).optional(),
    })
    .safeParse(await response.json());
  if (
    !envelope.success ||
    envelope.data.errors?.length ||
    envelope.data.data === undefined
  ) {
    throw new LinearApiError("Linear returned an error.");
  }
  const parsed = schema.safeParse(envelope.data.data);
  if (!parsed.success) throw new LinearApiError("Invalid Linear response.");
  return parsed.data;
}
