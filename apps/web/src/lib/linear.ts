import { z } from "zod";

export const LINEAR_FEATURE_REQUESTS_PROJECT_ID =
  "e3e317c2-785e-4ee2-ac4d-e1d77009e2e7";
export const LINEAR_ENGINEERING_TEAM_ID =
  "dc9ab7b9-9d16-4ba4-a0a5-ea3d912acd18";

const linearEndpoint = "https://api.linear.app/graphql";
const entitySchema = z.object({ id: z.string(), name: z.string() });
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
const issueMutationSchema = z.object({
  issueCreate: z.object({
    issue: z.object({ id: z.string() }).nullable(),
    success: z.boolean(),
  }),
});
const projectMutationSchema = z.object({
  projectCreate: z.object({
    project: z.object({ id: z.string() }).nullable(),
    success: z.boolean(),
  }),
});

export type LinearPlanningOptions = {
  issueStateId: string;
  labels: Array<{ id: string; name: string }>;
  projectStatusId: string;
  viewer: { id: string; name: string };
};

export class LinearApiError extends Error {}

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

export async function createLinearIssue(
  token: string,
  input: {
    assigneeId?: string;
    description: string;
    id: string;
    labelIds: string[];
    stateId: string;
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

export async function createLinearProject(
  token: string,
  input: {
    description: string;
    id: string;
    leadId?: string;
    name: string;
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
