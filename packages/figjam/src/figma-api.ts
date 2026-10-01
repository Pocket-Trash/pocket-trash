import type { FigjamSnapshot, FigmaApiConfig, FigmaComment } from "./types.js";
import { assertAllowedFileKey, parseAllowedFileKeys } from "./validation.js";

/** Base URL for local tooling requests to the Figma REST API. */
const figmaApiBaseUrl = "https://api.figma.com/v1";

/** Reports a missing local Figma configuration value or failed API request. */
export class FigmaApiError extends Error {
  /** Stable error name used by callers and diagnostics. */
  override name = "FigmaApiError";

  /**
   * Creates a Figma API error with an optional HTTP status.
   *
   * @param message - Caller-visible failure description.
   * @param status - HTTP response status when the failure came from Figma.
   */
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/**
 * Loads local-only Figma credentials, default file key, and file allowlist.
 *
 * @param env - Environment values, defaulting to the current process.
 * @returns Validated configuration for local Figma API access.
 * @throws When execution is not local or a required value is missing or disallowed.
 */
export function getFigmaConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): FigmaApiConfig {
  assertLocalOnlyEnvironment(env);

  const accessToken = requiredEnv(env, "FIGMA_ACCESS_TOKEN");
  const defaultFileKey = requiredEnv(env, "FIGMA_FIGJAM_FILE_KEY");
  const allowedFileKeys = parseAllowedFileKeys(
    env.FIGMA_FIGJAM_ALLOWED_FILE_KEYS,
  );

  if (allowedFileKeys.length === 0) {
    throw new FigmaApiError("FIGMA_FIGJAM_ALLOWED_FILE_KEYS is required.");
  }

  assertAllowedFileKey(defaultFileKey, allowedFileKeys);

  return {
    accessToken,
    allowedFileKeys,
    defaultFileKey,
  };
}

/**
 * Fetches a Figma file and its available comments as one timestamped snapshot.
 * A forbidden comments response is represented by an empty comment list.
 *
 * @param config - Validated Figma API configuration.
 * @param fileKey - Allowed file key, defaulting to the configured file.
 * @returns The raw file response, parsed comments, file key, and fetch time.
 * @rejects When the file key is disallowed or a required Figma request fails.
 */
export async function fetchFigjamSnapshot(
  config: FigmaApiConfig,
  fileKey = config.defaultFileKey,
): Promise<FigjamSnapshot> {
  assertAllowedFileKey(fileKey, config.allowedFileKeys);

  const [file, comments] = await Promise.all([
    figmaGet(config, `/files/${encodeURIComponent(fileKey)}`),
    figmaGet(config, `/files/${encodeURIComponent(fileKey)}/comments`).catch(
      (error: unknown) => {
        if (error instanceof FigmaApiError && error.status === 403) {
          return { comments: [] };
        }

        throw error;
      },
    ),
  ]);

  return {
    comments: parseComments(comments),
    fetchedAt: new Date().toISOString(),
    file,
    fileKey,
  };
}

/**
 * Posts a comment at the origin of an allowed Figma or FigJam file.
 *
 * @param config - Validated Figma API configuration.
 * @param options - Comment destination and message.
 * @returns The parsed Figma API response, or `undefined` for an empty response.
 * @rejects When the file key is disallowed or the Figma request fails.
 */
export async function postFigmaComment(
  config: FigmaApiConfig,
  options: {
    /** Allowed destination file key, defaulting to the configured file. */
    fileKey?: string;
    /** Comment text sent to Figma. */
    message: string;
  },
): Promise<unknown> {
  const fileKey = options.fileKey ?? config.defaultFileKey;
  assertAllowedFileKey(fileKey, config.allowedFileKeys);

  return figmaPost(config, `/files/${encodeURIComponent(fileKey)}/comments`, {
    client_meta: { x: 0, y: 0 },
    message: options.message,
  });
}

/**
 * Sends an authenticated GET request to a Figma API path.
 *
 * @param config - Figma API credentials and file constraints.
 * @param pathname - API pathname appended to the fixed Figma origin.
 * @returns The parsed response, or `undefined` for an empty body.
 * @rejects When the request fails or a successful body is invalid JSON.
 */
async function figmaGet(
  config: FigmaApiConfig,
  pathname: string,
): Promise<unknown> {
  const response = await fetch(`${figmaApiBaseUrl}${pathname}`, {
    headers: {
      "X-Figma-Token": config.accessToken,
    },
  });

  return parseFigmaResponse(response);
}

/**
 * Sends an authenticated JSON POST request to a Figma API path.
 *
 * @param config - Figma API credentials and file constraints.
 * @param pathname - API pathname appended to the fixed Figma origin.
 * @param body - JSON-serializable request body.
 * @returns The parsed response, or `undefined` for an empty body.
 * @rejects When the request fails or a successful body is invalid JSON.
 */
async function figmaPost(
  config: FigmaApiConfig,
  pathname: string,
  body: unknown,
): Promise<unknown> {
  const response = await fetch(`${figmaApiBaseUrl}${pathname}`, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "X-Figma-Token": config.accessToken,
    },
    method: "POST",
  });

  return parseFigmaResponse(response);
}

/**
 * Parses a Figma response and preserves failure status and retry guidance.
 *
 * @param response - Completed Figma API response.
 * @returns The parsed JSON value, or `undefined` for an empty body.
 * @rejects When Figma returns an error status or valid JSON cannot be parsed.
 */
async function parseFigmaResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!response.ok) {
    const retryAfter = response.headers.get("Retry-After");
    const suffix = retryAfter ? ` Retry after ${retryAfter} seconds.` : "";
    throw new FigmaApiError(
      `Figma API request failed with ${response.status}.${suffix}`,
      response.status,
    );
  }

  return text ? (JSON.parse(text) as unknown) : undefined;
}

/**
 * Extracts object-shaped comments from an unknown Figma response.
 *
 * @param input - Candidate comments response.
 * @returns Comment objects, or an empty array when the response has no array.
 */
function parseComments(input: unknown): FigmaComment[] {
  if (!input || typeof input !== "object") {
    return [];
  }

  const comments = (
    input as {
      /** Raw comments collection returned by Figma. */
      comments?: unknown;
    }
  ).comments;
  if (!Array.isArray(comments)) {
    return [];
  }

  return comments.filter(isComment);
}

/**
 * Checks whether a value can be consumed as a Figma comment object.
 *
 * @param input - Candidate comment value.
 * @returns Whether the value is a non-null object.
 */
function isComment(input: unknown): input is FigmaComment {
  return Boolean(input && typeof input === "object");
}

/**
 * Reads a required non-empty environment value.
 *
 * @param env - Environment mapping to inspect.
 * @param name - Required variable name.
 * @returns The configured value.
 * @throws When the variable is absent or empty.
 */
function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new FigmaApiError(`${name} is required.`);
  }

  return value;
}

/**
 * Prevents FigJam tooling from running in preview or production environments.
 *
 * @param env - Environment mapping to inspect.
 * @throws When any recognized environment marker names preview or production.
 */
function assertLocalOnlyEnvironment(env: NodeJS.ProcessEnv): void {
  const environmentValues = [
    env.INFISICAL_ENV,
    env.INFISICAL_ENV_SLUG,
    env.INFISICAL_ENVIRONMENT,
    env.NODE_ENV,
    env.VERCEL_ENV,
  ].filter(Boolean);

  if (
    environmentValues.some(
      (value) =>
        value === "preview" || value === "prod" || value === "production",
    )
  ) {
    throw new FigmaApiError(
      "FigJam tooling must only run locally with Infisical env dev.",
    );
  }
}
