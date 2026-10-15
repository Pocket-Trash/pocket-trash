import type { LogContext, LogEvent } from "./index.js";

/** Structured event fields that Axiom must index as maps. */
export const axiomMapFields = [
  "attributes",
  "context",
  "error",
  "rawPayload",
] as const;

/** Axiom dataset-management credentials. */
export type AxiomMapFieldConfig = {
  /** Axiom dataset to inspect or configure. */
  dataset: string;
  /** Token with permission to manage the dataset map fields. */
  token: string;
};

/** Minimal response consumed by Axiom dataset-management requests. */
export type AxiomManagementResponse = {
  /**
   * Parses a successful response body as JSON.
   *
   * @returns Parsed response body.
   */
  json: () => Promise<unknown>;
  /** Whether the response status represents success. */
  ok: boolean;
  /** Numeric HTTP status. */
  status: number;
};

/**
 * Minimal fetch contract used by Axiom dataset-management requests.
 *
 * @param input - Request URL.
 * @param init - Optional request body, headers, and method.
 * @returns The Axiom management response.
 */
export type AxiomManagementFetch = (
  input: string,
  init?: {
    /** Serialized request body. */
    body?: string;
    /** Request headers. */
    headers?: Record<string, string>;
    /** HTTP request method. */
    method?: string;
  },
) => Promise<AxiomManagementResponse>;

/**
 * Copies only the bounded top-level contract accepted by Axiom.
 *
 * @param event - Redacted structured event to ingest.
 * @returns Axiom event without console options or undeclared top-level fields.
 */
export function serializeAxiomEvent(event: LogEvent): LogContext {
  return {
    app: event.app,
    ...(event.deploymentId === undefined
      ? {}
      : { deploymentId: event.deploymentId }),
    ...(event.deploymentTarget === undefined
      ? {}
      : { deploymentTarget: event.deploymentTarget }),
    environment: event.environment,
    level: event.level,
    message: event.message,
    timestamp: event.timestamp,
    ...(event.attributes === undefined ? {} : { attributes: event.attributes }),
    ...(event.context === undefined ? {} : { context: event.context }),
    ...(event.error === undefined ? {} : { error: event.error }),
    ...(event.rawPayload === undefined ? {} : { rawPayload: event.rawPayload }),
  };
}

/**
 * Verifies that every required Axiom map field exists without changing it.
 *
 * @param config - Dataset and management credential.
 * @param fetcher - HTTP implementation used for Axiom requests.
 * @returns The configured map-field names.
 * @rejects When Axiom rejects the request or a required map field is missing.
 */
export async function checkAxiomMapFields(
  config: AxiomMapFieldConfig,
  fetcher: AxiomManagementFetch,
): Promise<readonly string[]> {
  const fields = await listAxiomMapFields(config, fetcher);
  assertRequiredMapFields(config.dataset, fields);
  return fields;
}

/**
 * Creates missing Axiom map fields and verifies the resulting configuration.
 *
 * @param config - Dataset and management credential.
 * @param fetcher - HTTP implementation used for Axiom requests.
 * @returns The verified configured map-field names.
 * @rejects When Axiom rejects a request or verification remains incomplete.
 */
export async function ensureAxiomMapFields(
  config: AxiomMapFieldConfig,
  fetcher: AxiomManagementFetch,
): Promise<readonly string[]> {
  const existingFields = await listAxiomMapFields(config, fetcher);
  const existingFieldSet = new Set(existingFields);

  for (const field of axiomMapFields) {
    if (!existingFieldSet.has(field)) {
      await createAxiomMapField(config, fetcher, field);
    }
  }

  return checkAxiomMapFields(config, fetcher);
}

/**
 * Lists map fields configured for an Axiom dataset.
 *
 * @param config - Dataset and management credential.
 * @param fetcher - HTTP implementation used for the request.
 * @returns Configured map-field names.
 * @rejects When Axiom rejects the request or returns an unexpected body.
 */
async function listAxiomMapFields(
  config: AxiomMapFieldConfig,
  fetcher: AxiomManagementFetch,
): Promise<readonly string[]> {
  const response = await fetcher(mapFieldsUrl(config.dataset), {
    headers: authorizationHeaders(config.token),
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`Axiom map field lookup failed with ${response.status}.`);
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
 * @param config - Dataset and management credential.
 * @param fetcher - HTTP implementation used for the request.
 * @param field - Map-field name to create.
 * @returns Completion after Axiom accepts the field.
 * @rejects When Axiom rejects the request.
 */
async function createAxiomMapField(
  config: AxiomMapFieldConfig,
  fetcher: AxiomManagementFetch,
  field: string,
): Promise<void> {
  const response = await fetcher(mapFieldsUrl(config.dataset), {
    body: JSON.stringify({ name: field }),
    headers: {
      ...authorizationHeaders(config.token),
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(
      `Axiom map field creation failed for ${field} with ${response.status}.`,
    );
  }
}

/**
 * Requires every package-owned map field.
 *
 * @param dataset - Dataset used in the error message.
 * @param fields - Configured field names.
 * @throws When one or more required fields are absent.
 */
function assertRequiredMapFields(
  dataset: string,
  fields: readonly string[],
): void {
  const fieldSet = new Set(fields);
  const missingFields = axiomMapFields.filter((field) => !fieldSet.has(field));

  if (missingFields.length > 0) {
    throw new Error(
      `Missing required Axiom map fields for ${dataset}: ${missingFields.join(", ")}.`,
    );
  }
}

/**
 * Builds the fixed Axiom management endpoint for a dataset.
 *
 * @param dataset - Dataset identifier.
 * @returns Encoded Axiom map-fields URL.
 */
function mapFieldsUrl(dataset: string): string {
  return `https://api.axiom.co/v2/datasets/${encodeURIComponent(dataset)}/mapfields`;
}

/**
 * Builds bearer authentication headers for Axiom management requests.
 *
 * @param token - Dataset-management token.
 * @returns Authorization headers.
 */
function authorizationHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
