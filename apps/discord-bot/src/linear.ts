import { z } from "zod";

/** Linear GraphQL endpoint used by the ticket service. */
const linearEndpoint = "https://api.linear.app/graphql";

/** Stable Pocket Trash resources the dedicated bot member must access. */
export const linearTicketTargets = {
  actorEmail: "linear-discord-bot@pocket-trash.app",
  actorName: "Pocket Trash Discord Bot",
  bugProjectId: "30824959-8325-46b9-bbce-35384f2729b0",
  featureProjectId: "e3e317c2-785e-4ee2-ac4d-e1d77009e2e7",
  organizationUrlKey: "pocket-trash",
  teamId: "dc9ab7b9-9d16-4ba4-a0a5-ea3d912acd18",
  teamKey: "ENG",
} as const;

/** GraphQL response required to validate the bot member and ticket targets. */
const accessResponseSchema = z.object({
  data: z
    .object({
      bugProject: z.object({ id: z.string() }).nullable(),
      featureProject: z.object({ id: z.string() }).nullable(),
      team: z.object({ id: z.string(), key: z.string() }).nullable(),
      viewer: z.object({
        email: z.email(),
        name: z.string(),
        organization: z.object({ urlKey: z.string() }),
      }),
    })
    .optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

/** Dependencies used by the API-key authentication boundary. */
type LinearApiKeyAuthenticationOptions = {
  /** Personal API key owned by the dedicated Linear bot member. */
  apiKey: string;
  /** HTTP implementation replaced by tests. */
  fetch?: typeof fetch;
};

/** Authentication operations exposed to the Discord bot runtime. */
export type LinearAuthentication = {
  /**
   * Confirms the credential actor and its required Pocket Trash resources.
   *
   * @returns A promise that resolves after every access check passes.
   * @rejects When Linear rejects the credential or required access is missing.
   */
  validateAccess(): Promise<void>;
};

/**
 * Creates the isolated Linear API-key authentication boundary.
 *
 * @param options - Credential and optional HTTP implementation.
 * @returns Startup access validation for the dedicated bot member.
 */
export function createLinearApiKeyAuthentication(
  options: LinearApiKeyAuthenticationOptions,
): LinearAuthentication {
  const fetchLinear = options.fetch ?? fetch;

  return {
    /**
     * Confirms the credential actor and its required Pocket Trash resources.
     *
     * @returns A promise that resolves after every access check passes.
     * @rejects When Linear rejects the credential or required access is missing.
     */
    async validateAccess() {
      const response = await fetchLinear(linearEndpoint, {
        body: JSON.stringify({
          query: `
            query DiscordBotAccess(
              $teamId: String!
              $featureProjectId: String!
              $bugProjectId: String!
            ) {
              viewer {
                name
                email
                organization { urlKey }
              }
              team(id: $teamId) { id key }
              featureProject: project(id: $featureProjectId) { id }
              bugProject: project(id: $bugProjectId) { id }
            }
          `,
          variables: {
            bugProjectId: linearTicketTargets.bugProjectId,
            featureProjectId: linearTicketTargets.featureProjectId,
            teamId: linearTicketTargets.teamId,
          },
        }),
        headers: {
          authorization: options.apiKey,
          "content-type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(
          `Linear credential validation failed (${response.status}).`,
        );
      }

      const result = accessResponseSchema.safeParse(await response.json());
      if (!result.success || result.data.errors?.length || !result.data.data) {
        throw new Error(
          "Linear credential validation returned an invalid response.",
        );
      }

      const { bugProject, featureProject, team, viewer } = result.data.data;
      if (
        viewer.name !== linearTicketTargets.actorName ||
        viewer.email !== linearTicketTargets.actorEmail ||
        viewer.organization.urlKey !== linearTicketTargets.organizationUrlKey
      ) {
        throw new Error(
          "Linear credential belongs to the wrong bot member or workspace.",
        );
      }
      if (
        team?.id !== linearTicketTargets.teamId ||
        team.key !== linearTicketTargets.teamKey ||
        featureProject?.id !== linearTicketTargets.featureProjectId ||
        bugProject?.id !== linearTicketTargets.bugProjectId
      ) {
        throw new Error(
          "Linear bot member cannot access the required team or projects.",
        );
      }
    },
  };
}
