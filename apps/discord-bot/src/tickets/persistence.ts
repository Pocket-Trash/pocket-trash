import { randomUUID } from "node:crypto";
import {
  renderTicketDescription,
  renderTranscript,
  type TicketFile,
  type TicketOperation,
  type TicketRequest,
  type TicketSnapshot,
  type TicketSummary,
  ticketRequestSchema,
  ticketSnapshotSchema,
  ticketSummarySchema,
} from "./model.js";
import type { TicketOperationStore } from "./store.js";

/** Linear reference recovered by stable UUID or canonical Discord source URL. */
export interface TicketIssue {
  /** Stable Linear issue UUID. */
  id: string;
  /** Canonical Linear issue URL. */
  url: string;
  /** Kind inferred from the configured bug/feature project. */
  kind: "bug" | "feature";
}
/** Ephemeral signed upload details; never persisted in Redis. */
export interface TicketUpload {
  /** Durable, authenticated Linear asset URL. */
  assetUrl: string;
  /** Short-lived storage PUT URL. */
  uploadUrl: string;
  /** Headers required by the signed PUT request. */
  headers: Record<string, string>;
}
/** Deep Linear boundary used by recoverable ticket operations. */
export interface TicketLinear {
  /**
   * Finds an existing issue by the client-generated UUID.
   * @param id - Stable issue UUID.
   * @returns The issue, or null only for a confirmed not-found result.
   */
  findIssue(id: string): Promise<TicketIssue | null>;
  /**
   * Recovers durable truth after a finalized Redis mapping expires.
   * @param url - Canonical Discord thread URL.
   * @returns One issue linked to that URL, or null.
   */
  findByThread(url: string): Promise<TicketIssue | null>;
  /**
   * Creates the stable UUID with the configured project/state/labels.
   * @param operation - Frozen intent and validated AI content.
   * @param description - English issue Markdown, excluding the transcript.
   * @returns The created issue reference.
   */
  createIssue(
    operation: TicketOperation,
    description: string,
  ): Promise<TicketIssue>;
  /**
   * Checks comment identity before retrying an ambiguous write.
   * @param id - Stable comment UUID.
   * @param issueId - Issue the comment must belong to.
   * @returns Whether that exact comment already exists on this issue.
   */
  hasComment(id: string, issueId: string): Promise<boolean>;
  /**
   * Writes one transcript chunk under its original UUID.
   * @param id - Stable client-generated comment identity.
   * @param issueId - Target issue UUID.
   * @param body - Deterministic numbered transcript chunk.
   * @returns Write completion.
   */
  createComment(id: string, issueId: string, body: string): Promise<void>;
  /**
   * Links the canonical source only after all issue content is durable.
   * @param issueId - Completed issue UUID.
   * @param url - Canonical Discord source URL, idempotent within the issue.
   * @param assets - Every allocated durable asset URL, including ambiguous attempts for erasure.
   * @returns Source-link completion.
   */
  linkThread(issueId: string, url: string, assets: string[]): Promise<void>;
  /**
   * Allocates one storage slot, without uploading or persisting credentials.
   * @param file - Validated allowed file metadata.
   * @returns A signed slot, or null for a permanent file rejection.
   */
  prepareUpload(file: TicketFile): Promise<TicketUpload | null>;
  /**
   * Uploads bytes to the exact signed slot; ambiguous errors remain retryable.
   * @param slot - Ephemeral upload destination and required headers.
   * @param bytes - Bounded allowed attachment bytes.
   * @returns Whether storage accepted the file, false for permanent rejection.
   */
  putUpload(slot: TicketUpload, bytes: Uint8Array): Promise<boolean>;
  /**
   * Verifies an ambiguous upload through authenticated Linear file storage.
   * @param url - Previously checkpointed durable asset URL.
   * @returns Whether the completed asset exists.
   */
  assetExists(url: string): Promise<boolean>;
}
/** Discord read boundary refetches signed attachment URLs for every download. */
export interface TicketReader {
  /**
   * Captures all human messages at one point in time.
   * @param threadId - Valid configured support-forum thread.
   * @returns Chronological canonical transcript without signed URLs.
   */
  snapshot(threadId: string): Promise<TicketSnapshot>;
  /**
   * Refetches the original message and attachment before downloading bounded bytes.
   * @param file - Canonical file identity and expected metadata.
   * @param threadId - Original support thread.
   * @returns Bytes, or an omission reason for deleted/rejected content.
   */
  readFile(file: TicketFile, threadId: string): Promise<Uint8Array | string>;
}
/** In-memory evidence exists only during the current processing attempt. */
export interface TicketEvidence {
  /** Original attachment metadata. */
  file: TicketFile;
  /** Bounded raw bytes; never persisted into Redis. */
  bytes: Uint8Array;
}

/**
 * Creates recoverable, one-issue-per-thread persistence, separate from Discord UI.
 * @param options - Validated guild, durable store, readers and provider boundaries.
 * @returns Creation, inspection and post-Discord-finalization compaction.
 */
export function createTicketPersistence(options: {
  /** Guild used to construct the only accepted Discord source URL. */
  guildId: string;
  /** Bot-local durable operations and renewable thread leases. */
  store: TicketOperationStore;
  /** Authorized Discord support-thread reader. */
  reader: TicketReader;
  /** Dedicated bot-member Linear API boundary. */
  linear: TicketLinear;
  /**
   * Produces validated English content using only the approved ZDR route.
   * @param snapshot - Frozen chronological transcript.
   * @param evidence - Allowed in-memory attachments.
   * @returns Structured ticket content, never an AI preview.
   */
  summarize(
    snapshot: TicketSnapshot,
    evidence: TicketEvidence[],
  ): Promise<TicketSummary>;
}) {
  /**
   * Builds a source link using only the configured guild and validated thread.
   * @param threadId - Canonical thread identity.
   * @returns The fixed Discord source URL.
   */
  const sourceUrl = (threadId: string) =>
    `https://discord.com/channels/${options.guildId}/${threadId}`;
  return {
    /**
     * Creates or resumes the same issue and deterministic transcript comments.
     * @param input - Role-authorized staff intent; the first durable intent wins.
     * @returns Fully persisted Linear content, ready for Discord finalization.
     * @rejects When AI, storage, Discord or Linear is unavailable; retries keep IDs.
     */
    async persist(input: TicketRequest): Promise<TicketOperation> {
      const request = ticketRequestSchema.parse(input);
      return options.store.transact(request.threadId, async (transaction) => {
        let operation = await transaction.load();
        if (operation && operation.phase !== "processing") return operation;
        if (!operation) {
          const existing = await options.linear.findByThread(
            sourceUrl(request.threadId),
          );
          if (existing) {
            operation = {
              version: 1,
              threadId: request.threadId,
              issueId: existing.id,
              issueUrl: existing.url,
              kind: existing.kind,
              priority: 0,
              phase: "persisted",
              commentIds: [],
            };
            await transaction.save(operation);
            return operation;
          }
          const snapshot = ticketSnapshotSchema.parse(
            await options.reader.snapshot(request.threadId),
          );
          if (
            snapshot.threadId !== request.threadId ||
            snapshot.threadUrl !== sourceUrl(request.threadId)
          )
            throw new Error("Transcript belongs to another Discord thread.");
          const files = snapshot.messages.flatMap((message) => message.files);
          if (new Set(files.map((file) => file.id)).size !== files.length)
            throw new Error("Duplicate attachment identity.");
          operation = {
            version: 1,
            threadId: request.threadId,
            issueId: randomUUID(),
            kind: request.kind,
            priority: request.kind === "bug" ? request.priority : 0,
            phase: "processing",
            commentIds: [],
            staffNote: request.staffNote,
            snapshot,
            files,
          };
          await transaction.save(operation);
        }
        const snapshot = ticketSnapshotSchema.parse(operation.snapshot);
        const files = operation.files ?? [];
        const evidence: TicketEvidence[] = [];
        let selectedBytes = 0;
        for (const file of files) {
          if (file.status === "omitted") continue;
          if (
            file.size > 10_000_000 ||
            selectedBytes + file.size > 25_000_000
          ) {
            file.status = "omitted";
            file.reason =
              "Attachment exceeds the 10 MB file or 25 MB ticket limit.";
            continue;
          }
          selectedBytes += file.size;
          if (!operation.summary || file.status === "pending") {
            const result = await options.reader.readFile(
              file,
              request.threadId,
            );
            if (typeof result === "string") {
              file.status = "omitted";
              file.reason = result;
            } else if (
              result.byteLength !== file.size ||
              result.byteLength > 10_000_000
            ) {
              file.status = "omitted";
              file.reason =
                "Attachment size changed or exceeded the allowed limit.";
            } else evidence.push({ file, bytes: result });
          }
        }
        operation.files = files;
        await transaction.save(operation);
        if (!operation.summary) {
          operation.summary = ticketSummarySchema.parse(
            await options.summarize(
              {
                ...snapshot,
                messages: snapshot.messages.map((message) => ({
                  ...message,
                  files: files.filter((file) => file.messageId === message.id),
                })),
              },
              evidence,
            ),
          );
          await transaction.save(operation);
        }
        let issue = await options.linear.findIssue(operation.issueId);
        if (!issue) {
          try {
            issue = await options.linear.createIssue(
              operation,
              renderTicketDescription(operation),
            );
          } catch (error) {
            issue = await options.linear.findIssue(operation.issueId);
            if (!issue) throw error;
          }
        }
        if (issue.id !== operation.issueId || issue.kind !== operation.kind)
          throw new Error("Linear issue identity or project mismatch.");
        operation.issueUrl = issue.url;
        await transaction.save(operation);
        for (const file of files) {
          if (file.status !== "pending") continue;
          if (
            file.assetUrl &&
            (await options.linear.assetExists(file.assetUrl))
          ) {
            file.status = "uploaded";
          } else {
            const data = evidence.find((item) => item.file.id === file.id);
            if (!data)
              throw new Error(
                "Allowed attachment evidence is unavailable; retry with fresh Discord URLs.",
              );
            if ((file.assetHistory?.length ?? 0) >= 10)
              throw new Error(
                "Attachment upload attempts require operator review.",
              );
            const slot = await options.linear.prepareUpload(file);
            if (slot) {
              file.assetUrl = slot.assetUrl;
              file.assetHistory = [
                ...new Set([...(file.assetHistory ?? []), slot.assetUrl]),
              ];
              await transaction.save(operation);
              if (await options.linear.putUpload(slot, data.bytes))
                file.status = "uploaded";
              else {
                file.status = "omitted";
                file.reason = "Linear rejected the allowed file upload.";
              }
            } else {
              file.status = "omitted";
              file.reason = "Linear rejected the allowed file metadata.";
            }
          }
          await transaction.save(operation);
        }
        const bodies = renderTranscript(snapshot, files);
        if (!operation.comments) {
          operation.comments = bodies.map((body) => ({
            id: randomUUID(),
            body,
          }));
          operation.commentIds = operation.comments.map(
            (comment) => comment.id,
          );
          await transaction.save(operation);
        }
        if (
          operation.comments.some(
            (comment, index) => comment.body !== bodies[index],
          ) ||
          operation.comments.length !== bodies.length
        )
          throw new Error(
            "Canonical transcript changed after comment identities were allocated.",
          );
        for (const comment of operation.comments) {
          if (await options.linear.hasComment(comment.id, operation.issueId))
            continue;
          try {
            await options.linear.createComment(
              comment.id,
              operation.issueId,
              comment.body,
            );
          } catch (error) {
            if (
              !(await options.linear.hasComment(comment.id, operation.issueId))
            )
              throw error;
          }
        }
        await options.linear.linkThread(
          operation.issueId,
          snapshot.threadUrl,
          files.flatMap(
            (file) =>
              file.assetHistory ?? (file.assetUrl ? [file.assetUrl] : []),
          ),
        );
        operation.phase = "persisted";
        await transaction.save(operation);
        return operation;
      });
    },
    /**
     * Looks up a mapping for active-thread presentation repair without creating an issue.
     * @param threadId - Configured support thread identity.
     * @returns Stored operation or a completed Linear source-link mapping.
     */
    async lookup(threadId: string): Promise<TicketOperation | undefined> {
      return options.store.transact(threadId, async (transaction) => {
        const operation = await transaction.load();
        if (operation) return operation;
        const issue = await options.linear.findByThread(sourceUrl(threadId));
        return issue
          ? {
              version: 1,
              threadId,
              issueId: issue.id,
              issueUrl: issue.url,
              kind: issue.kind,
              priority: 0,
              phase: "persisted",
              commentIds: [],
            }
          : undefined;
      });
    },
    /**
     * Removes private snapshots only after Discord finalization succeeds.
     * @param threadId - Fully persisted and visibly finalized support thread.
     * @returns Compaction completion; finalized mapping expires after 90 days.
     */
    async finalize(threadId: string): Promise<void> {
      await options.store.transact(threadId, async (transaction) => {
        const operation = await transaction.load();
        if (!operation || operation.phase === "processing")
          throw new Error("Ticket is not ready for Discord finalization.");
        if (operation.phase === "finalized") return;
        await transaction.save({
          version: 1,
          threadId,
          issueId: operation.issueId,
          issueUrl: operation.issueUrl,
          kind: operation.kind,
          priority: 0,
          commentIds: operation.commentIds,
          phase: "finalized",
        });
      });
    },
  };
}
