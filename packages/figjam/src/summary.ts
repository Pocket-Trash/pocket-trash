import type {
  FigjamSnapshot,
  FigjamSummaryNode,
  FigmaComment,
} from "./types.js";

/** Maximum number of notable nodes rendered in a Markdown summary. */
const maxSummaryNodes = 120;

/**
 * Builds a readable Markdown overview and node index from a Figma snapshot.
 *
 * @param snapshot - Captured Figma file and comment data.
 * @returns Markdown summary and every notable node found in the document.
 */
export function summarizeSnapshot(snapshot: FigjamSnapshot): {
  /** Markdown overview capped to the configured number of displayed nodes. */
  markdown: string;
  /** Every notable node found in the document tree. */
  nodes: FigjamSummaryNode[];
} {
  const file = asRecord(snapshot.file) ?? {};
  const name = stringValue(file.name) ?? "Untitled Figma/FigJam file";
  const lastModified = stringValue(file.lastModified);
  const document = file.document;
  const nodes = collectSummaryNodes(document);
  const comments = snapshot.comments ?? [];
  const lines = [
    `# ${name}`,
    "",
    `- File key: ${snapshot.fileKey}`,
    `- Fetched at: ${snapshot.fetchedAt}`,
  ];

  if (lastModified) {
    lines.push(`- Last modified: ${lastModified}`);
  }

  lines.push("", "## Notable Nodes");

  for (const node of nodes.slice(0, maxSummaryNodes)) {
    const text = node.characters ? ` - ${singleLine(node.characters)}` : "";
    lines.push(`- ${node.type} ${node.id}: ${node.name ?? "Untitled"}${text}`);
  }

  if (nodes.length > maxSummaryNodes) {
    lines.push(`- ${nodes.length - maxSummaryNodes} additional nodes omitted.`);
  }

  lines.push("", "## Recent Comments");

  for (const comment of comments.slice(0, 25)) {
    lines.push(formatComment(comment));
  }

  if (comments.length === 0) {
    lines.push("- No comments returned.");
  }

  return {
    markdown: `${lines.join("\n")}\n`,
    nodes,
  };
}

/**
 * Traverses a Figma document breadth-first and collects notable nodes.
 *
 * @param input - Unknown document root from the Figma API.
 * @returns Notable nodes in document traversal order.
 */
function collectSummaryNodes(input: unknown): FigjamSummaryNode[] {
  const nodes: FigjamSummaryNode[] = [];
  const queue = [input];

  while (queue.length > 0) {
    const current = asRecord(queue.shift());
    if (!current) {
      continue;
    }

    const id = stringValue(current.id);
    const type = stringValue(current.type);

    if (id && type) {
      const characters =
        stringValue(current.characters) ??
        stringValue(asRecord(current.text)?.characters);

      if (shouldIncludeNode(type, current, characters)) {
        nodes.push({
          characters,
          id,
          name: stringValue(current.name),
          type,
        });
      }
    }

    const children = current.children;
    if (Array.isArray(children)) {
      queue.push(...children);
    }
  }

  return nodes;
}

/**
 * Determines whether a Figma node carries useful summary information.
 *
 * @param type - Figma node type.
 * @param node - Raw Figma node fields.
 * @param characters - Text found on the node, when present.
 * @returns Whether the node should appear in summary output.
 */
function shouldIncludeNode(
  type: string,
  node: Record<string, unknown>,
  characters: string | undefined,
): boolean {
  if (characters) {
    return true;
  }

  if (type.includes("STICKY") || type.includes("SECTION")) {
    return true;
  }

  const name = stringValue(node.name);
  return Boolean(name && name !== "Page 1" && name !== "Untitled");
}

/**
 * Formats one Figma comment as a single Markdown list item.
 *
 * @param comment - Comment fields returned by Figma.
 * @returns Markdown list item with author, optional timestamp, and normalized text.
 */
function formatComment(comment: FigmaComment): string {
  const author = comment.user?.handle ?? "Unknown";
  const createdAt = comment.created_at ? ` (${comment.created_at})` : "";
  const message = singleLine(comment.message ?? "");
  return `- ${author}${createdAt}: ${message}`;
}

/**
 * Narrows a value to a non-array object record.
 *
 * @param input - Value to inspect.
 * @returns The object record, or `undefined` for non-object values and arrays.
 */
function asRecord(input: unknown): Record<string, unknown> | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }

  return input as Record<string, unknown>;
}

/**
 * Reads a non-blank string from an unknown value.
 *
 * @param input - Value to inspect.
 * @returns The original string, or `undefined` when it is blank or not a string.
 */
function stringValue(input: unknown): string | undefined {
  return typeof input === "string" && input.trim() ? input : undefined;
}

/**
 * Collapses whitespace so text fits on one summary line.
 *
 * @param input - Text to normalize.
 * @returns Trimmed text with each whitespace run replaced by one space.
 */
function singleLine(input: string): string {
  return input.replaceAll(/\s+/g, " ").trim();
}
