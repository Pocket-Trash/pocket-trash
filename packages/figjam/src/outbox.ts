import { readdir, readFile, writeFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { basename, join } from "node:path";
import type { FigjamPayload } from "./types.js";
import { validatePayload } from "./validation.js";

/**
 * Lists valid JSON payloads from an outbox in file-name order.
 * Missing directories and malformed payload files are skipped.
 *
 * @param outboxDir - Directory containing bridge payload files.
 * @returns Valid payloads with their source names and paths.
 */
export async function listPayloads(outboxDir: string): Promise<
  {
    /** Base name of the payload file. */
    fileName: string;
    /** Full path to the payload file. */
    filePath: string;
    /** Validated bridge payload read from the file. */
    payload: FigjamPayload;
  }[]
> {
  const fileNames = await readdir(outboxDir).catch(() => []);
  const payloads = await Promise.all(
    fileNames
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => readPayloadFile(outboxDir, fileName)),
  );

  return payloads
    .filter((payload) => payload !== undefined)
    .sort((left, right) => left.fileName.localeCompare(right.fileName));
}

/**
 * Starts a localhost HTTP bridge for listing, reading, and acknowledging payloads.
 *
 * @param options - Outbox directory, local port, and status reporter.
 * @returns A handle that gracefully stops the bridge server.
 */
export function serveOutbox(options: {
  /** Directory exposed through the bridge. */
  outboxDir: string;
  /** Localhost TCP port used by the bridge. */
  port: number;
  /**
   * Reports the address once the bridge starts listening.
   *
   * @param message - Bridge status message.
   */
  print: (message: string) => void;
}): {
  /**
   * Stops the bridge server after active connections close.
   *
   * @returns A promise that resolves after the server closes.
   */
  close: () => Promise<void>;
} {
  const server = createServer(async (request, response) => {
    try {
      setCorsHeaders(response);

      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }

      const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

      if (request.method === "GET" && url.pathname === "/payloads") {
        const payloads = await listPayloads(options.outboxDir);
        writeJson(response, 200, {
          payloads: payloads.map(({ fileName, payload }) => ({
            fileKey: payload.fileKey,
            fileName,
            operationCount: payload.operations.length,
            payloadId: payload.payloadId,
            source: payload.source,
          })),
        });
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/payloads/")) {
        const fileName = basename(decodeURIComponent(url.pathname.slice(10)));
        if (!fileName) {
          writeJson(response, 404, { error: "Payload not found." });
          return;
        }

        const filePath = join(options.outboxDir, fileName);
        const payload = validatePayload(
          JSON.parse(await readFile(filePath, "utf8")) as unknown,
        );
        writeJson(response, 200, payload);
        return;
      }

      if (request.method === "POST" && url.pathname === "/ack") {
        const body = await readRequestJson(request);
        const acknowledgement =
          body && typeof body === "object" && !Array.isArray(body)
            ? body
            : { value: body };
        await writeFile(
          join(options.outboxDir, "acknowledgements.jsonl"),
          `${JSON.stringify({
            ...acknowledgement,
            acknowledgedAt: new Date().toISOString(),
          })}\n`,
          { flag: "a" },
        );
        writeJson(response, 200, { ok: true });
        return;
      }

      writeJson(response, 404, { error: "Not found." });
    } catch (error) {
      writeJson(response, 500, {
        error: error instanceof Error ? error.message : "Unknown error.",
      });
    }
  });

  server.listen(options.port, "localhost", () => {
    options.print(
      `FigJam outbox bridge listening on http://localhost:${options.port}`,
    );
  });

  return {
    /**
     * Stops the bridge server after active connections close.
     *
     * @returns A promise that resolves after the server closes.
     * @rejects When the HTTP server reports a close error.
     */
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }),
  };
}

/**
 * Reads and validates one payload file without failing its surrounding listing.
 *
 * @param outboxDir - Directory containing bridge payload files.
 * @param fileName - Payload file name within the outbox.
 * @returns File metadata and payload, or `undefined` when reading or validation fails.
 */
async function readPayloadFile(
  outboxDir: string,
  fileName: string,
): Promise<
  | {
      /** Base name of the payload file. */
      fileName: string;
      /** Full path to the payload file. */
      filePath: string;
      /** Validated bridge payload read from the file. */
      payload: FigjamPayload;
    }
  | undefined
> {
  try {
    const filePath = join(outboxDir, fileName);
    const contents = await readFile(filePath, "utf8");
    return {
      fileName,
      filePath,
      payload: validatePayload(JSON.parse(contents) as unknown),
    };
  } catch {
    return undefined;
  }
}

/**
 * Reads an HTTP request body and parses it as JSON.
 *
 * @param request - Incoming bridge request stream.
 * @returns Parsed JSON, or an empty object for an empty body.
 * @rejects When reading the stream fails or the body is invalid JSON.
 */
async function readRequestJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf8");
  return text ? (JSON.parse(text) as unknown) : {};
}

/**
 * Adds permissive local bridge CORS headers to an HTTP response.
 *
 * @param response - Outgoing bridge response.
 */
function setCorsHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

/**
 * Sends an indented JSON response with the requested status.
 *
 * @param response - Outgoing bridge response.
 * @param statusCode - HTTP response status.
 * @param body - Value serialized as JSON.
 */
function writeJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body, null, 2));
}
