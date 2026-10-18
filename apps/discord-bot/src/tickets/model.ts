import { escapeMarkdown } from "discord.js";
import { z } from "zod";

/** Discord IDs are decimal snowflakes, not user-controlled URLs. */
export const ticketSnowflake = z.string().regex(/^[1-9]\d{16,19}$/u);
/** Allowed staff-selected ticket intent; zero means no priority. */
export const ticketRequestSchema = z.object({
  threadId: ticketSnowflake,
  kind: z.enum(["bug", "feature"]),
  priority: z.number().int().min(0).max(4),
  staffNote: z.string().max(4000),
});
/** Durable metadata deliberately excludes expiring Discord download URLs. */
export const ticketFileSchema = z.object({
  id: ticketSnowflake,
  messageId: ticketSnowflake,
  name: z.string().min(1).max(255),
  contentType: z.string().max(100),
  size: z.number().int().nonnegative(),
  status: z.enum(["pending", "uploaded", "omitted"]),
  assetUrl: z.url().optional(),
  assetHistory: z.array(z.url()).max(10).optional(),
  reason: z.string().max(200).optional(),
});
/** Canonical point-in-time human transcript; no bot messages or signed URLs. */
export const ticketSnapshotSchema = z.object({
  threadId: ticketSnowflake,
  threadUrl: z
    .url()
    .refine((value) =>
      /^https:\/\/discord\.com\/channels\/\d+\/\d+$/u.test(value),
    ),
  messages: z
    .array(
      z.object({
        id: ticketSnowflake,
        userId: ticketSnowflake,
        username: z.string().max(200),
        timestamp: z.iso.datetime(),
        content: z.string().max(4000),
        files: z.array(ticketFileSchema),
      }),
    )
    .max(10_000),
});
/** Structured English content produced by the selected ZDR-only model. */
export const ticketSummarySchema = z
  .object({
    title: z.string().min(1).max(200),
    summary: z.string().min(1).max(12000),
    reproductionSteps: z.array(z.string().max(2000)).max(50),
    expectedBehavior: z.string().max(4000),
    actualBehavior: z.string().max(4000),
    environment: z.array(z.string().max(1000)).max(30),
    userImpact: z.string().max(4000),
    openQuestions: z.array(z.string().max(1000)).max(30),
  })
  .strict();
/** Restricted in-progress operation, or compact finalized mapping. */
export const ticketOperationSchema = z.object({
  version: z.literal(1),
  threadId: ticketSnowflake,
  issueId: z.uuid(),
  kind: z.enum(["bug", "feature"]),
  priority: z.number().int().min(0).max(4),
  phase: z.enum(["processing", "persisted", "finalized"]),
  issueUrl: z.url().optional(),
  commentIds: z.array(z.uuid()),
  snapshot: ticketSnapshotSchema.optional(),
  staffNote: z.string().max(4000).optional(),
  summary: ticketSummarySchema.optional(),
  files: z.array(ticketFileSchema).optional(),
  comments: z
    .array(z.object({ id: z.uuid(), body: z.string().max(20_000) }))
    .optional(),
});
/** Valid staff intent passed only after the runtime role guard. */
export type TicketRequest = z.infer<typeof ticketRequestSchema>;
/** URL-free canonical transcript used to rebuild retried comments. */
export type TicketSnapshot = z.infer<typeof ticketSnapshotSchema>;
/** Persisted upload outcome and original attachment identity. */
export type TicketFile = z.infer<typeof ticketFileSchema>;
/** Model output validated before any Linear issue write. */
export type TicketSummary = z.infer<typeof ticketSummarySchema>;
/** Durable operation state with stable issue/comment identities. */
export type TicketOperation = z.infer<typeof ticketOperationSchema>;

/**
 * Converts canonical transcript and final upload manifest into numbered comments.
 * @param snapshot - Frozen human messages in chronological order.
 * @param files - Final uploaded or omitted file outcomes.
 * @returns Deterministic chunks of at most 20,000 characters, including headings.
 */
export function renderTranscript(
  snapshot: TicketSnapshot,
  files: TicketFile[],
): string[] {
  const text = snapshot.messages
    .map((message) => {
      const attachments = files
        .filter((file) => file.messageId === message.id)
        .map((file) =>
          file.status === "uploaded"
            ? `${escapeMarkdown(file.name)}: ${file.assetUrl}`
            : `${escapeMarkdown(file.name)} (${file.contentType}, ${file.size} bytes): omitted — ${file.reason ?? "unavailable"}`,
        );
      return `${escapeMarkdown(message.username)} (Discord ID ${message.userId}) · ${message.timestamp}\n${escapeMarkdown(message.content)}\n${attachments.join("\n")}`;
    })
    .join("\n\n---\n\n");
  const chunks: string[] = [];
  for (let offset = 0; offset < text.length; ) {
    let end = Math.min(offset + 19_900, text.length);
    if (end < text.length && /[\uD800-\uDBFF]/u.test(text[end - 1] ?? ""))
      end--;
    chunks.push(text.slice(offset, end));
    offset = end;
  }
  return chunks.map(
    (body, index) => `Transcript ${index + 1}/${chunks.length}\n\n${body}`,
  );
}

/**
 * Formats the English ticket description without mixing transcript comments into it.
 * @param operation - Frozen request, summary and canonical source link.
 * @returns Linear Markdown for the main issue description.
 */
export function renderTicketDescription(operation: TicketOperation): string {
  const summary = ticketSummarySchema.parse(operation.summary);
  const sections = [
    ["Summary", escapeMarkdown(summary.summary)],
    [
      "Reproduction steps",
      summary.reproductionSteps
        .map((step, index) => `${index + 1}. ${escapeMarkdown(step)}`)
        .join("\n"),
    ],
    ["Expected behavior", escapeMarkdown(summary.expectedBehavior)],
    ["Actual behavior", escapeMarkdown(summary.actualBehavior)],
    [
      "Environment",
      summary.environment.map((item) => escapeMarkdown(item)).join("\n"),
    ],
    ["User impact", escapeMarkdown(summary.userImpact)],
    [
      "Open questions",
      summary.openQuestions
        .map((question) => `- ${escapeMarkdown(question)}`)
        .join("\n"),
    ],
    ["Discord thread", operation.snapshot?.threadUrl ?? ""],
    ["Staff note", escapeMarkdown(operation.staffNote ?? "")],
  ];
  return sections
    .filter(([, body]) => body)
    .map(([title, body]) => `## ${title}\n\n${body}`)
    .join("\n\n");
}
