import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchFigjamSnapshot,
  getFigmaConfigFromEnv,
  postFigmaComment,
} from "./figma-api.js";
import { serveOutbox } from "./outbox.js";
import { summarizeSnapshot } from "./summary.js";
import type { FigjamSnapshot } from "./types.js";
import { payloadSchemaVersion } from "./types.js";
import { assertAllowedFileKey, validatePayload } from "./validation.js";

/** Default directory for payloads awaiting FigJam plugin processing. */
const defaultOutboxDir = ".figjam/outbox";
/** Default directory for downloaded snapshots and generated summaries. */
const defaultCacheDir = ".figjam/cache";
/** Default localhost port for the outbox bridge. */
const defaultBridgePort = 4873;

/** Command names recognized by the FigJam CLI. */
type CliCommand =
  | "comment"
  | "help"
  | "read"
  | "serve-outbox"
  | "summarize"
  | "validate-payload"
  | "write-payload";

/**
 * Dispatches one FigJam CLI command.
 *
 * @param argv - Command name followed by its arguments.
 * @returns Process exit code for a successfully dispatched command.
 * @rejects When the selected command cannot complete.
 */
async function main(argv: readonly string[]): Promise<number> {
  const [rawCommand, ...args] = argv;
  const command = normalizeCommand(rawCommand);

  switch (command) {
    case "comment":
      await comment(args);
      return 0;
    case "read":
      await read(args);
      return 0;
    case "serve-outbox":
      await serve(args);
      return 0;
    case "summarize":
      await summarize(args);
      return 0;
    case "validate-payload":
      await validate(args);
      return 0;
    case "write-payload":
      await writePayload(args);
      return 0;
    case "help":
      printHelp();
      return 0;
  }
}

/**
 * Downloads an allowed Figma file and writes its cache artifacts.
 *
 * @param args - Optional Figma file key, defaulting to the configured file.
 * @returns A promise that resolves after all snapshot artifacts are written.
 * @rejects When configuration, Figma access, or file output fails.
 */
async function read(args: readonly string[]): Promise<void> {
  const config = getFigmaConfigFromEnv();
  const fileKey = args[0] ?? config.defaultFileKey;
  assertAllowedFileKey(fileKey, config.allowedFileKeys);

  const snapshot = await fetchFigjamSnapshot(config, fileKey);
  const { markdown, nodes } = summarizeSnapshot(snapshot);
  const cacheDir = join(defaultCacheDir, fileKey);

  await mkdir(cacheDir, { recursive: true });
  await writeJson(join(cacheDir, "snapshot.json"), snapshot);
  await writeFile(join(cacheDir, "summary.md"), markdown);
  await writeJson(join(cacheDir, "nodes.json"), nodes);

  console.log(`Wrote FigJam snapshot cache to ${cacheDir}.`);
}

/**
 * Regenerates summary artifacts from a cached FigJam snapshot.
 *
 * @param args - Optional snapshot path, defaulting to the configured file's cache.
 * @returns A promise that resolves after summary artifacts are written.
 * @rejects When configuration, snapshot parsing, or file output fails.
 */
async function summarize(args: readonly string[]): Promise<void> {
  const config = getFigmaConfigFromEnv();
  const snapshotPath =
    args[0] ?? join(defaultCacheDir, config.defaultFileKey, "snapshot.json");
  const snapshot = JSON.parse(
    await readFile(snapshotPath, "utf8"),
  ) as FigjamSnapshot;
  const { markdown, nodes } = summarizeSnapshot(snapshot);
  const outputDir = join(defaultCacheDir, snapshot.fileKey);

  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, "summary.md"), markdown);
  await writeJson(join(outputDir, "nodes.json"), nodes);

  console.log(`Wrote FigJam summary to ${outputDir}.`);
}

/**
 * Validates a payload file against the configured Figma file allowlist.
 *
 * @param args - Payload file path.
 * @returns A promise that resolves after validation succeeds.
 * @rejects When the argument, file, JSON, configuration, or payload is invalid.
 */
async function validate(args: readonly string[]): Promise<void> {
  const config = getFigmaConfigFromEnv();
  const path = requiredArg(args[0], "validate-payload requires a file path.");
  const payload = validatePayload(JSON.parse(await readFile(path, "utf8")), {
    allowedFileKeys: config.allowedFileKeys,
  });

  console.log(
    `Payload ${payload.payloadId} is valid for ${payload.fileKey} with ${payload.operations.length} operations.`,
  );
}

/**
 * Normalizes, validates, and writes a payload into the plugin outbox.
 *
 * @param args - Input JSON file path.
 * @returns A promise that resolves after the payload is written.
 * @rejects When the argument, file, JSON, configuration, or payload is invalid.
 */
async function writePayload(args: readonly string[]): Promise<void> {
  const config = getFigmaConfigFromEnv();
  const inputPath = requiredArg(args[0], "write-payload requires a file path.");
  const payload = validatePayload(
    normalizePayloadInput(JSON.parse(await readFile(inputPath, "utf8"))),
    { allowedFileKeys: config.allowedFileKeys },
  );
  const outboxPath = join(defaultOutboxDir, `${payload.payloadId}.json`);

  await mkdir(defaultOutboxDir, { recursive: true });
  await writeJson(outboxPath, payload);

  console.log(`Wrote FigJam payload to ${outboxPath}.`);
}

/**
 * Starts the local FigJam outbox bridge on a requested port.
 *
 * @param args - Optional localhost port, defaulting to `4873`.
 * @returns A promise that resolves after server startup is initiated.
 * @rejects When the port is not an integer from 1 through 65535.
 */
async function serve(args: readonly string[]): Promise<void> {
  const port = Number(args[0] ?? defaultBridgePort);

  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error("serve-outbox port must be an integer from 1 to 65535.");
  }

  serveOutbox({
    outboxDir: defaultOutboxDir,
    port,
    /**
     * Writes a bridge status message to standard output.
     *
     * @param message - Status message to print.
     * @returns Nothing after printing the message.
     */
    print: (message) => console.log(message),
  });
}

/**
 * Posts a message to an allowed Figma or FigJam file.
 *
 * @param args - Optional file key, defaulting to the configured file, and required `--message` value.
 * @returns A promise that resolves after Figma accepts the comment.
 * @rejects When the message, configuration, file key, or API request is invalid.
 */
async function comment(args: readonly string[]): Promise<void> {
  const config = getFigmaConfigFromEnv();
  const messageIndex = args.indexOf("--message");
  const message = messageIndex >= 0 ? args[messageIndex + 1] : undefined;

  if (!message) {
    throw new Error("comment requires --message <text>.");
  }

  const fileKey = args.find((arg) => !arg.startsWith("--") && arg !== message);
  await postFigmaComment(config, { fileKey, message });
  console.log(
    `Posted FigJam/Figma comment to ${fileKey ?? config.defaultFileKey}.`,
  );
}

/**
 * Wraps an operations-only object in a versioned payload envelope.
 * Existing payloads and non-object values pass through unchanged.
 *
 * @param input - Parsed payload or operations-only input.
 * @returns The original value or a generated payload candidate.
 */
function normalizePayloadInput(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const object = input as Record<string, unknown>;
  if (object.schemaVersion) {
    return object;
  }

  return {
    fileKey: process.env.FIGMA_FIGJAM_FILE_KEY ?? "",
    operations: object.operations,
    payloadId: `payload-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`,
    schemaVersion: payloadSchemaVersion,
    source: {
      agent: object.agent ?? "codex",
      branch: process.env.GIT_BRANCH,
      commit: process.env.GIT_COMMIT,
      createdAt: new Date().toISOString(),
      task: object.task,
    },
  };
}

/**
 * Maps a raw command name to a supported command or the help fallback.
 *
 * @param command - Raw first CLI argument.
 * @returns A supported command name.
 */
function normalizeCommand(command: string | undefined): CliCommand {
  if (
    command === "comment" ||
    command === "read" ||
    command === "serve-outbox" ||
    command === "summarize" ||
    command === "validate-payload" ||
    command === "write-payload"
  ) {
    return command;
  }

  return "help";
}

/**
 * Requires a positional CLI argument.
 *
 * @param value - Candidate argument value.
 * @param message - Error message used when the argument is absent.
 * @returns The present argument value.
 * @throws When the argument is absent or empty.
 */
function requiredArg(value: string | undefined, message: string): string {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

/**
 * Writes an indented JSON value with a trailing newline.
 *
 * @param path - Destination file path.
 * @param value - JSON-serializable value.
 * @returns A promise that resolves after the file is written.
 * @rejects When serialization or file output fails.
 */
async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** Prints FigJam CLI commands and the local Infisical invocation example. */
function printHelp(): void {
  console.log(
    [
      "Usage:",
      "  pnpm figjam read [fileKey]",
      "  pnpm figjam summarize [snapshotPath]",
      "  pnpm figjam validate-payload <payload.json>",
      "  pnpm figjam write-payload <payload-or-operations.json>",
      "  pnpm figjam serve-outbox [port]",
      "  pnpm figjam comment [fileKey] --message <text>",
      "",
      "Run through Infisical for local secrets:",
      "  infisical run --env=dev --path=/local/figma -- pnpm figjam read",
    ].join("\n"),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
