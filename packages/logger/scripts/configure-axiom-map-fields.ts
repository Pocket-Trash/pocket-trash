import process from "node:process";

/** Structured event fields that Axiom must index as maps. */
const requiredMapFields = [
  "attributes",
  "context",
  "error",
  "rawPayload",
] as const;

/** Axiom API settings used to configure dataset map fields. */
type Config = {
  /** Axiom dataset to configure. */
  dataset: string;
  /** Axiom API domain. */
  domain: string;
  /** Axiom API token. */
  token: string;
};

/** Minimal HTTP response used by the Axiom configuration script. */
type FetchResponse = {
  /**
   * Parses the response body as JSON.
   *
   * @returns Parsed response body.
   */
  json: () => Promise<unknown>;
  /** Whether the response status represents success. */
  ok: boolean;
  /** Numeric HTTP status. */
  status: number;
  /**
   * Reads the response body as text.
   *
   * @returns Response body text.
   */
  text: () => Promise<string>;
};

/**
 * Minimal fetch contract used by the Axiom configuration script.
 *
 * @param input - Request URL.
 * @param init - Optional request body, headers, and method.
 * @returns The Axiom API response.
 * @rejects When the request cannot be completed.
 */
type FetchLike = (
  input: string,
  init?: {
    /** Serialized request body. */
    body?: string;
    /** Request headers. */
    headers?: Record<string, string>;
    /** HTTP request method. */
    method?: string;
  },
) => Promise<FetchResponse>;

/**
 * Loads configuration and ensures required map fields exist.
 *
 * @returns Completion after all missing fields are created.
 * @rejects When configuration is missing or Axiom rejects a request.
 */
async function main(): Promise<void> {
  const config = readConfig();
  await configureMapFields(config, fetch);
}

/**
 * Creates required Axiom map fields that are not already configured.
 *
 * @param config - Axiom dataset credentials and API domain.
 * @param fetcher - HTTP implementation used for Axiom requests.
 * @returns Completion after the dataset contains every required field.
 * @rejects When listing or creating Axiom map fields fails.
 */
export async function configureMapFields(
  config: Config,
  fetcher: FetchLike,
): Promise<void> {
  const existingFields = await listMapFields(config, fetcher);
  const existingFieldSet = new Set(existingFields);
  const missingFields = requiredMapFields.filter(
    (field) => !existingFieldSet.has(field),
  );

  if (missingFields.length === 0) {
    console.log(
      `Axiom map fields already configured for ${config.dataset}: ${requiredMapFields.join(
        ", ",
      )}`,
    );
    return;
  }

  for (const field of missingFields) {
    await createMapField(config, fetcher, field);
    console.log(`Created Axiom map field ${config.dataset}.${field}`);
  }

  console.log(
    `Axiom map fields configured for ${config.dataset}: ${requiredMapFields.join(
      ", ",
    )}`,
  );
}

/**
 * Reads Axiom map-field configuration from environment variables.
 *
 * @param env - Environment variable source.
 * @returns Validated Axiom API configuration.
 * @throws When a required environment variable is missing.
 */
function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    dataset: requiredEnv(env, "AXIOM_DATASET"),
    domain: env.AXIOM_EDGE_DOMAIN || "api.axiom.co",
    token: requiredEnv(env, "AXIOM_TOKEN"),
  };
}

/**
 * Lists map fields configured for an Axiom dataset.
 *
 * @param config - Axiom dataset credentials and API domain.
 * @param fetcher - HTTP implementation used for the request.
 * @returns Configured map-field names.
 * @rejects When Axiom rejects the request or returns an unexpected body.
 */
async function listMapFields(
  config: Config,
  fetcher: FetchLike,
): Promise<string[]> {
  const response = await fetcher(mapFieldsUrl(config), {
    headers: authorizationHeaders(config),
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(
      `Axiom map field lookup failed with ${response.status}: ${await response.text()}`,
    );
  }

  const body = await response.json();

  if (!Array.isArray(body) || !body.every((item) => typeof item === "string")) {
    throw new Error("Axiom map field lookup returned an unexpected response.");
  }

  return body;
}

/**
 * Creates one Axiom dataset map field.
 *
 * @param config - Axiom dataset credentials and API domain.
 * @param fetcher - HTTP implementation used for the request.
 * @param field - Map-field name to create.
 * @returns Completion after Axiom accepts the field.
 * @rejects When Axiom rejects the request.
 */
async function createMapField(
  config: Config,
  fetcher: FetchLike,
  field: string,
): Promise<void> {
  const response = await fetcher(mapFieldsUrl(config), {
    body: JSON.stringify({ name: field }),
    headers: {
      ...authorizationHeaders(config),
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(
      `Axiom map field creation failed for ${field} with ${
        response.status
      }: ${await response.text()}`,
    );
  }
}

/**
 * Builds the map-fields endpoint for an Axiom dataset.
 *
 * @param config - Axiom dataset and API domain.
 * @returns Encoded Axiom map-fields URL.
 */
function mapFieldsUrl(config: Config): string {
  return `https://${config.domain}/v2/datasets/${encodeURIComponent(
    config.dataset,
  )}/mapfields`;
}

/**
 * Builds bearer authentication headers for Axiom requests.
 *
 * @param config - Axiom configuration containing the API token.
 * @returns Authorization headers.
 */
function authorizationHeaders(config: Config): Record<string, string> {
  return {
    Authorization: `Bearer ${config.token}`,
  };
}

/**
 * Reads a required non-empty environment variable.
 *
 * @param env - Environment variable source.
 * @param key - Variable name to read.
 * @returns The configured value.
 * @throws When the variable is absent or empty.
 */
function requiredEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
