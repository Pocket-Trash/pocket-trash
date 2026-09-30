import type { FigjamSnapshot, FigmaApiConfig, FigmaComment } from "./types.js";
import { assertAllowedFileKey, parseAllowedFileKeys } from "./validation.js";

const figmaApiBaseUrl = "https://api.figma.com/v1";

export class FigmaApiError extends Error {
  override name = "FigmaApiError";

  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

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

export async function postFigmaComment(
  config: FigmaApiConfig,
  options: { fileKey?: string; message: string },
): Promise<unknown> {
  const fileKey = options.fileKey ?? config.defaultFileKey;
  assertAllowedFileKey(fileKey, config.allowedFileKeys);

  return figmaPost(config, `/files/${encodeURIComponent(fileKey)}/comments`, {
    client_meta: { x: 0, y: 0 },
    message: options.message,
  });
}

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

function parseComments(input: unknown): FigmaComment[] {
  if (!input || typeof input !== "object") {
    return [];
  }

  const comments = (input as { comments?: unknown }).comments;
  if (!Array.isArray(comments)) {
    return [];
  }

  return comments.filter(isComment);
}

function isComment(input: unknown): input is FigmaComment {
  return Boolean(input && typeof input === "object");
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new FigmaApiError(`${name} is required.`);
  }

  return value;
}

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
