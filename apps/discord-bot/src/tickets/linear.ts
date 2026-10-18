import { z } from "zod";
import { linearTicketTargets } from "../linear.js";
import { readBounded } from "./http.js";
import type { TicketIssue, TicketLinear } from "./persistence.js";

/** API issue identity and routing fields required before trusting a mapping. */
const issueSchema = z.object({
  id: z.uuid(),
  url: z.url(),
  project: z.object({ id: z.uuid() }).nullable(),
  team: z.object({ id: z.uuid() }),
});
/** Shared selection for every issue lookup and mutation response. */
const issueFields = "id url project { id } team { id }";

/**
 * Validates a Linear issue belongs to this bot's configured workspace/team/projects.
 * @param value - Untrusted GraphQL issue.
 * @returns Scoped issue reference or null for a confirmed absent issue.
 * @throws When the issue belongs to another team/project or has an unsafe URL.
 */
function issueReference(value: unknown): TicketIssue | null {
  if (value === null) return null;
  const issue = issueSchema.parse(value);
  if (
    issue.team.id !== linearTicketTargets.teamId ||
    !issue.url.startsWith("https://linear.app/pocket-trash/issue/")
  )
    throw new Error("Linear issue scope mismatch.");
  const kind =
    issue.project?.id === linearTicketTargets.bugProjectId
      ? "bug"
      : issue.project?.id === linearTicketTargets.featureProjectId
        ? "feature"
        : null;
  if (!kind) throw new Error("Linear issue project mismatch.");
  return { id: issue.id, url: issue.url, kind };
}

/**
 * Creates the dedicated bot-member Linear transport without automatic write retries.
 * @param options - Credential and injectable HTTP transport.
 * @returns Recoverable issue/comment/file operations; authentication is checked by startup.
 * @rejects When returned operations cannot validate scoped Linear data or transport fails.
 */
export function createTicketLinear(options: {
  /** Dedicated bot-member API key, never included in payloads or errors. */
  apiKey: string;
  /** HTTP boundary replaced by tests. */
  fetch?: typeof fetch;
}): TicketLinear {
  const request = options.fetch ?? fetch;
  /**
   * Executes one bounded GraphQL operation with redacted errors and no automatic retry.
   * @param query - Fixed application operation.
   * @param variables - Validated runtime values.
   * @param fileRejection - Whether a permanent file-policy rejection becomes an omission.
   * @returns Untrusted GraphQL data for the operation-specific schema.
   * @rejects When Linear is unavailable or returns GraphQL/transport errors.
   */
  async function graphql(
    query: string,
    variables: Record<string, unknown>,
    fileRejection = false,
  ): Promise<Record<string, unknown>> {
    const response = await request("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        authorization: options.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(20_000),
      redirect: "error",
    });
    if (fileRejection && [400, 413, 415, 422].includes(response.status))
      return { fileUpload: { success: false } };
    if (!response.ok)
      throw new Error(`Linear request failed (${response.status}).`);
    const result = z
      .object({
        data: z.record(z.string(), z.unknown()).nullable().optional(),
        errors: z
          .array(
            z
              .object({
                extensions: z
                  .object({ code: z.string().optional() })
                  .passthrough()
                  .optional(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .parse(
        JSON.parse(
          Buffer.from(await readBounded(response, 2_000_000)).toString("utf8"),
        ),
      );
    if (result.errors?.length) {
      if (
        fileRejection &&
        result.errors.every(
          (error) => error.extensions?.code === "BAD_USER_INPUT",
        )
      )
        return { fileUpload: { success: false } };
      throw new Error("Linear returned a GraphQL error.");
    }
    if (!result.data) throw new Error("Linear response is missing data.");
    return result.data;
  }
  return {
    /**
     * Finds the reserved issue identity before any creation retry.
     * @param id - Client-generated issue UUID.
     * @returns Scoped issue, or null only when absent.
     * @rejects When the lookup fails or returns an unexpected issue identity.
     */
    async findIssue(id) {
      const data = await graphql(
        `query($id: ID!) { issues(first: 2, filter: { id: { eq: $id } }) { nodes { ${issueFields} } } }`,
        { id },
      );
      const result = z
        .object({ nodes: z.array(issueSchema).max(1) })
        .parse(data.issues);
      const issue = issueReference(result.nodes[0] ?? null);
      if (issue && issue.id !== id)
        throw new Error("Linear issue identity mismatch.");
      return issue;
    },
    /**
     * Recovers exactly one completed ticket through its canonical source attachment.
     * @param url - Canonical Discord thread link.
     * @returns Scoped issue, or null; duplicates are rejected rather than guessed.
     * @rejects When lookup fails or multiple/foreign issues are returned.
     */
    async findByThread(url) {
      const data = await graphql(
        `query($url: String!) { attachmentsForURL(url: $url) { nodes { issue { ${issueFields} } } } }`,
        { url },
      );
      const result = z
        .object({ nodes: z.array(z.object({ issue: issueSchema })) })
        .parse(data.attachmentsForURL);
      const unique = new Map(
        result.nodes.map(({ issue }) => [issue.id, issue]),
      );
      if (unique.size > 1)
        throw new Error("Multiple Linear tickets link this Discord thread.");
      return issueReference([...unique.values()][0] ?? null);
    },
    /**
     * Creates the reserved issue under the exact project/state/label policy.
     * @param operation - Frozen staff intent and summary.
     * @param description - Canonical main ticket content.
     * @returns Scoped created issue.
     * @rejects When targets are missing or the write is rejected or ambiguous.
     */
    async createIssue(operation, description) {
      const data = await graphql(
        "query($id: String!) { team(id: $id) { states { nodes { id name type } } } }",
        { id: linearTicketTargets.teamId },
      );
      const team = z
        .object({
          states: z.object({
            nodes: z.array(
              z.object({ id: z.uuid(), name: z.string(), type: z.string() }),
            ),
          }),
        })
        .parse(data.team);
      const states = team.states.nodes.filter(
        (state) =>
          state.name === (operation.kind === "bug" ? "Todo" : "Triage") &&
          state.type === (operation.kind === "bug" ? "unstarted" : "triage"),
      );
      if (states.length !== 1 || !states[0] || !operation.summary)
        throw new Error("Linear ticket state or summary is unavailable.");
      const result = await graphql(
        `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { ${issueFields} } } }`,
        {
          input: {
            id: operation.issueId,
            teamId: linearTicketTargets.teamId,
            projectId:
              operation.kind === "bug"
                ? linearTicketTargets.bugProjectId
                : linearTicketTargets.featureProjectId,
            stateId: states[0].id,
            title: operation.summary.title,
            description,
            priority: operation.kind === "bug" ? operation.priority : 0,
            labelIds:
              operation.kind === "bug"
                ? [
                    "3f455699-3d1b-4dfb-8e3a-7b9eb3949f05",
                    "eeff2955-1593-47b1-8bcd-f24555ad86c7",
                  ]
                : [],
          },
        },
      );
      const created = z
        .object({ success: z.literal(true), issue: issueSchema })
        .parse(result.issueCreate);
      const issue = issueReference(created.issue);
      if (
        !issue ||
        issue.id !== operation.issueId ||
        issue.kind !== operation.kind
      )
        throw new Error("Created Linear issue mismatch.");
      return issue;
    },
    /**
     * Checks stable comment identity and ownership before retrying.
     * @param id - Reserved comment UUID.
     * @param issueId - Expected owning issue UUID.
     * @returns Whether the comment already exists on this issue.
     * @rejects When lookup fails or comment ownership does not match.
     */
    async hasComment(id, issueId) {
      const data = await graphql(
        "query($id: ID!) { comments(first: 2, filter: { id: { eq: $id } }) { nodes { id issue { id } } } }",
        { id },
      );
      const result = z
        .object({
          nodes: z
            .array(
              z.object({ id: z.uuid(), issue: z.object({ id: z.uuid() }) }),
            )
            .max(1),
        })
        .parse(data.comments);
      const comment = result.nodes[0];
      if (!comment) return false;
      if (comment.id !== id || comment.issue.id !== issueId)
        throw new Error("Linear comment ownership mismatch.");
      return true;
    },
    /**
     * Writes one reserved transcript chunk without changing its UUID.
     * @param id - Stable comment identity.
     * @param issueId - Owning issue.
     * @param body - Canonical numbered transcript.
     * @returns Write completion.
     * @rejects When the write is rejected, ambiguous, or returns the wrong identity.
     */
    async createComment(id, issueId, body) {
      const data = await graphql(
        "mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success comment { id } } }",
        { input: { id, issueId, body } },
      );
      const result = z
        .object({
          success: z.literal(true),
          comment: z.object({ id: z.uuid() }),
        })
        .parse(data.commentCreate);
      if (result.comment.id !== id)
        throw new Error("Linear comment identity mismatch.");
    },
    /**
     * Adds the idempotent source link after all content has been persisted.
     * @param issueId - Completed issue.
     * @param url - Canonical Discord thread link.
     * @param assets - Durable asset attempt manifest retained for subject erasure.
     * @returns Link completion.
     */
    async linkThread(issueId, url, assets) {
      const data = await graphql(
        "mutation($input: AttachmentCreateInput!) { attachmentCreate(input: $input) { success } }",
        {
          input: {
            issueId,
            url,
            title: "Discord",
            metadata: Object.fromEntries(
              assets.map((asset, index) => [`ticketAsset${index}`, asset]),
            ),
          },
        },
      );
      z.object({ success: z.literal(true) }).parse(data.attachmentCreate);
    },
    /**
     * Requests a signed upload slot; permanent file-policy rejections become omissions.
     * @param file - Allowed file metadata.
     * @returns Ephemeral upload slot or null for a rejected slot.
     * @rejects When Linear fails or returns an unsafe storage destination.
     */
    async prepareUpload(file) {
      const data = await graphql(
        "mutation($type: String!, $name: String!, $size: Int!) { fileUpload(contentType: $type, filename: $name, size: $size) { success uploadFile { assetUrl uploadUrl headers { key value } } } }",
        { type: file.contentType, name: file.name, size: file.size },
        true,
      );
      const result = z
        .object({
          success: z.boolean(),
          uploadFile: z
            .object({
              assetUrl: z.url(),
              uploadUrl: z.url(),
              headers: z.array(
                z.object({ key: z.string(), value: z.string() }),
              ),
            })
            .nullish(),
        })
        .parse(data.fileUpload);
      if (!result.success || !result.uploadFile) return null;
      const slot = result.uploadFile;
      if (
        new URL(slot.assetUrl).origin !== "https://uploads.linear.app" ||
        !["storage.googleapis.com", "uploads.linear.app"].includes(
          new URL(slot.uploadUrl).hostname,
        ) ||
        new URL(slot.uploadUrl).protocol !== "https:"
      )
        throw new Error("Unexpected Linear storage origin.");
      return {
        assetUrl: slot.assetUrl,
        uploadUrl: slot.uploadUrl,
        headers: Object.fromEntries(
          slot.headers.map(({ key, value }) => [key, value]),
        ),
      };
    },
    /**
     * Uploads to the exact signed slot with every returned header preserved.
     * @param slot - Signed storage allocation.
     * @param bytes - Bounded content.
     * @returns True on success; false for a permanent file rejection.
     * @rejects When the upload is ambiguous or storage rejects authentication.
     */
    async putUpload(slot, bytes) {
      const response = await request(slot.uploadUrl, {
        method: "PUT",
        headers: slot.headers,
        body: Buffer.from(bytes),
        signal: AbortSignal.timeout(30_000),
        redirect: "error",
      });
      if ([400, 413, 415, 422].includes(response.status)) return false;
      if (!response.ok)
        throw new Error(`Linear upload failed (${response.status}).`);
      return true;
    },
    /**
     * Verifies an ambiguous uploaded asset through authenticated private storage.
     * @param url - Durable Linear asset URL, never a signed upload URL.
     * @returns Whether storage confirms the asset exists.
     * @rejects When the URL is unsafe or storage is unavailable or unauthorized.
     */
    async assetExists(url) {
      if (new URL(url).origin !== "https://uploads.linear.app")
        throw new Error("Unexpected Linear asset origin.");
      const response = await request(url, {
        method: "GET",
        headers: { authorization: options.apiKey, range: "bytes=0-0" },
        signal: AbortSignal.timeout(10_000),
        redirect: "error",
      });
      await response.body?.cancel();
      if (response.status === 404) return false;
      if (!response.ok)
        throw new Error(
          `Linear asset verification failed (${response.status}).`,
        );
      return true;
    },
  };
}
