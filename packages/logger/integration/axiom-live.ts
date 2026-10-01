import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import {
  createAxiomTransport,
  createLogger,
  createProxyTransport,
  type FetchLike,
  isLogLevel,
  type Logger,
  type LogLevel,
  loggerValues,
  logLevels,
  parseClientLogEvents,
} from "../src/index.js";

/** One tabular Axiom query result keyed by field path. */
type QueryRow = Record<string, unknown>;

/** A field descriptor returned with an Axiom tabular response. */
type AxiomField = {
  /** Field path used as the query-row key. */
  name: string;
};

/** Columnar values and field descriptors for one Axiom result table. */
type AxiomTable = {
  /** Column values aligned with `fields`. */
  columns?: unknown[][];
  /** Field descriptors aligned with `columns`. */
  fields?: AxiomField[];
};

/** Tabular response returned by the Axiom query API. */
type AxiomTabularResponse = {
  /** Result tables, when the query produced tabular output. */
  tables?: AxiomTable[];
};

/** Dataset required for the live logger test. */
const requiredDataset =
  process.env.LOGGER_AXIOM_EXPECTED_DATASET ?? "development";
/** Minimum level required to exercise every severity. */
const requiredLogLevel = "trace";
/** Default live-test deadline in milliseconds. */
const defaultTimeoutMs = 90_000;
/** Default delay between Axiom queries in milliseconds. */
const defaultPollIntervalMs = 5_000;

/**
 * Emits direct and proxied events, then verifies Axiom ingestion and redaction.
 *
 * @returns Completion after every expected event is verified.
 * @rejects When configuration, delivery, querying, or assertions fail.
 */
async function main(): Promise<void> {
  const config = readConfig();
  const startedAt = new Date(Date.now() - 60_000).toISOString();
  const runId = randomUUID();
  const runPrefix = `logger-live-${runId}`;
  const secrets = createSecretValues(runPrefix);
  const expectedMessages: string[] = [];

  const axiomTransport = createAxiomTransport({
    dataset: config.dataset,
    edgeDomain: config.edgeDomain,
    token: config.token,
  });

  const directLogger = createLogger({
    app: "logger-live-direct",
    context: {
      path: "direct",
      suite: "logger-axiom-live",
      testRunId: runId,
    },
    deploymentId: runId,
    deploymentTarget: "test",
    environment: "automated-tests",
    level: config.logLevel,
    transports: [axiomTransport],
  });

  for (const level of logLevels) {
    const eventMessage = message(runPrefix, `direct.level.${level}`);
    expectedMessages.push(eventMessage);
    directLogger[level](eventMessage, {
      attributes: {
        emittedLevel: level,
        token: secrets.directAttributeToken,
      },
    });
  }

  const rawPayloadMessage = message(runPrefix, "direct.raw-payload");
  expectedMessages.push(rawPayloadMessage);
  directLogger.info(rawPayloadMessage, {
    attributes: {
      case: "raw-payload",
      password: secrets.directAttributePassword,
    },
    includeRawPayload: true,
    rawPayload: {
      nested: {
        secret: secrets.directRawSecret,
      },
      token: secrets.directRawToken,
      visible: "raw payload visible value",
    },
  });

  const childMessage = message(runPrefix, "direct.child-context");
  expectedMessages.push(childMessage);
  directLogger
    .child({
      childContext: "child-value",
      token: secrets.directChildToken,
    })
    .info(childMessage);

  const errorMessage = message(runPrefix, "direct.error");
  expectedMessages.push(errorMessage);
  directLogger.error(errorMessage, {
    error: new Error("Direct live error"),
  });

  const operationSuccess = message(runPrefix, "direct.operation.success");
  expectedMessages.push(`${operationSuccess}.succeeded`);
  await directLogger.operation(operationSuccess, async () => {
    await delay(5);
    return "ok";
  });

  const operationFailure = message(runPrefix, "direct.operation.failure");
  expectedMessages.push(`${operationFailure}.failed`);
  await assert.rejects(
    directLogger.operation(operationFailure, () => {
      throw new Error("Direct operation failure");
    }),
    /Direct operation failure/,
  );

  const filteredLogger = createLogger({
    app: "logger-live-direct",
    context: {
      path: "direct-filter",
      suite: "logger-axiom-live",
      testRunId: runId,
    },
    deploymentId: runId,
    deploymentTarget: "test",
    environment: "automated-tests",
    level: "warn",
    transports: [axiomTransport],
  });
  const filteredInfoMessage = message(runPrefix, "direct.filter.info");
  const filteredWarnMessage = message(runPrefix, "direct.filter.warn");
  expectedMessages.push(filteredWarnMessage);
  filteredLogger.info(filteredInfoMessage);
  filteredLogger.warn(filteredWarnMessage);

  const proxyServerLogger = createLogger({
    app: "web",
    context: {
      path: "proxy-server",
      suite: "logger-axiom-live",
      testRunId: runId,
    },
    deploymentId: runId,
    deploymentTarget: "web-server",
    environment: "automated-tests",
    level: config.logLevel,
    transports: [axiomTransport],
  });
  /**
   * Routes proxy transport requests through the in-process proxy handler.
   *
   * @param _input - Unused proxy URL.
   * @param init - Proxy request body and headers.
   * @returns The simulated proxy response.
   */
  const proxyFetch: FetchLike = async (_input, init) =>
    handleLogProxyRequest({
      body: init?.body,
      clientLogKey: config.logProxyClientKey,
      headers: init?.headers,
      logger: proxyServerLogger,
    });
  const proxyLogger = createLogger({
    app: "web",
    context: {
      path: "proxy-client",
      proxyContext: "client-value",
      suite: "logger-axiom-live",
      testRunId: runId,
      token: secrets.proxyContextToken,
    },
    deploymentId: runId,
    deploymentTarget: "web-client",
    environment: "automated-tests",
    level: config.logLevel,
    transports: [
      createProxyTransport({
        clientKey: config.logProxyClientKey,
        fetch: proxyFetch,
        url: "http://logger-live.test/api/v0/logs",
      }),
    ],
  });

  for (const level of logLevels) {
    const eventMessage = message(runPrefix, `proxy.level.${level}`);
    expectedMessages.push(eventMessage);
    proxyLogger[level](eventMessage, {
      attributes: {
        emittedLevel: level,
        token: secrets.proxyAttributeToken,
      },
    });
  }

  const proxyErrorMessage = message(runPrefix, "proxy.error");
  expectedMessages.push(proxyErrorMessage);
  proxyLogger.error(proxyErrorMessage, {
    error: new TypeError("Proxy client live error"),
  });

  const proxyRawPayloadMessage = message(runPrefix, "proxy.raw-payload");
  expectedMessages.push(proxyRawPayloadMessage);
  proxyLogger.info(proxyRawPayloadMessage, {
    includeRawPayload: true,
    rawPayload: {
      authorization: secrets.proxyRawAuthorization,
      visible: "proxy raw payload visible value",
    },
  });

  await directLogger.flush();
  await filteredLogger.flush();
  await proxyLogger.flush();
  await proxyServerLogger.flush();

  console.log(`logger live test run: ${runId}`);
  console.log(`waiting for ${expectedMessages.length} events in Axiom`);

  const rows = await waitForRows({
    config,
    expectedMessages,
    runPrefix,
    startedAt,
  });

  assertRows(rows, {
    expectedMessages,
    filteredInfoMessage,
    runId,
    runPrefix,
    secrets,
  });

  console.log(`received ${rows.length} matching Axiom events`);
}

/**
 * Authenticates, validates, enriches, and forwards a simulated proxy request.
 *
 * @param input - Request body, headers, client key, and server logger.
 * @returns An HTTP-like response describing acceptance or validation failure.
 * @rejects When flushing the server logger fails.
 */
async function handleLogProxyRequest({
  body,
  clientLogKey,
  headers,
  logger,
}: {
  /** Serialized proxy request body. */
  body?: string;
  /** Expected client authentication key. */
  clientLogKey: string;
  /** Proxy request headers. */
  headers?: Record<string, string>;
  /** Server logger that forwards accepted events. */
  logger: Logger;
}): Promise<{
  /** Whether the response status represents success. */
  ok: boolean;
  /** Numeric HTTP status. */
  status: number;
  /**
   * Reads the serialized response body.
   *
   * @returns JSON response text.
   */
  text: () => Promise<string>;
}> {
  if (headers?.[loggerValues.logProxy.clientKeyHeader] !== clientLogKey) {
    return jsonResponse({ error: "Invalid log client key." }, 401);
  }

  let parsedBody: unknown;

  try {
    parsedBody = JSON.parse(body ?? "");
  } catch {
    return jsonResponse({ error: "Expected a JSON request body." }, 400);
  }

  const events = parseClientLogEvents(parsedBody);

  if (!events.ok) {
    return jsonResponse({ error: events.error }, 400);
  }

  const receivedAt = new Date().toISOString();

  for (const event of events.value) {
    logger.forward(event, {
      attributes: {
        originalTimestamp: event.timestamp,
        receivedAt,
        source: loggerValues.logProxy.source,
      },
    });
  }

  await logger.flush();

  return jsonResponse({ accepted: events.value.length }, 200);
}

/**
 * Creates an HTTP-like JSON response for the simulated proxy.
 *
 * @param body - Response value to serialize.
 * @param status - Numeric HTTP status.
 * @returns A minimal response with deferred JSON serialization.
 */
function jsonResponse(
  body: unknown,
  status: number,
): {
  /** Whether the response status represents success. */
  ok: boolean;
  /** Numeric HTTP status. */
  status: number;
  /**
   * Reads the serialized response body.
   *
   * @returns JSON response text.
   */
  text: () => Promise<string>;
} {
  return {
    ok: status >= 200 && status < 300,
    status,
    /**
     * Serializes the response body.
     *
     * @returns JSON response text.
     */
    text: async () => JSON.stringify(body),
  };
}

/**
 * Reads and validates configuration for the live Axiom logger test.
 *
 * @returns Validated credentials, logging level, and polling settings.
 * @throws When required variables or live-test invariants are invalid.
 */
function readConfig(): {
  /** Axiom dataset queried by the test. */
  dataset: string;
  /** Optional Axiom API domain override. */
  edgeDomain?: string;
  /** Logger level used for live emissions. */
  logLevel: LogLevel;
  /** Client key accepted by the simulated log proxy. */
  logProxyClientKey: string;
  /** Delay between Axiom query attempts in milliseconds. */
  pollIntervalMs: number;
  /** Maximum wait for Axiom events in milliseconds. */
  timeoutMs: number;
  /** Axiom API token. */
  token: string;
} {
  const token = requiredEnv("AXIOM_TOKEN");
  const dataset = requiredEnv("AXIOM_DATASET");
  const logLevelValue = requiredEnv("LOG_LEVEL");
  const logProxyClientKey = requiredEnv("LOG_PROXY_CLIENT_KEY");
  const logLevel = parseLogLevel(logLevelValue);

  assert.equal(
    dataset,
    requiredDataset,
    `AXIOM_DATASET must be "${requiredDataset}" for the live logger test.`,
  );
  assert.equal(
    logLevel,
    requiredLogLevel,
    `LOG_LEVEL must be "${requiredLogLevel}" for the live logger test to cover every level.`,
  );

  return {
    dataset,
    edgeDomain: optionalEnv("AXIOM_EDGE_DOMAIN"),
    logLevel,
    logProxyClientKey,
    pollIntervalMs: parseOptionalPositiveInteger(
      "AXIOM_TEST_POLL_INTERVAL_MS",
      defaultPollIntervalMs,
    ),
    timeoutMs: parseOptionalPositiveInteger(
      "AXIOM_TEST_TIMEOUT_MS",
      defaultTimeoutMs,
    ),
    token,
  };
}

/**
 * Validates a configured log level.
 *
 * @param value - Candidate log-level name.
 * @returns The validated log level.
 * @throws When the value is not supported.
 */
function parseLogLevel(value: string): LogLevel {
  assert.ok(isLogLevel(value), `LOG_LEVEL must be a valid log level: ${value}`);

  return value;
}

/**
 * Reads a required non-empty environment variable.
 *
 * @param name - Environment variable name.
 * @returns The configured value.
 * @throws When the variable is absent or empty.
 */
function requiredEnv(name: string): string {
  const value = process.env[name];
  assert.ok(value, `${name} is required.`);

  return value;
}

/**
 * Reads an optional non-empty environment variable.
 *
 * @param name - Environment variable name.
 * @returns The configured value, or `undefined` when absent or empty.
 */
function optionalEnv(name: string): string | undefined {
  const value = process.env[name];

  return value ? value : undefined;
}

/**
 * Reads an optional positive base-10 integer prefix from an environment variable.
 *
 * @param name - Environment variable name.
 * @param fallback - Value used when the variable is absent or empty.
 * @returns The parsed positive integer prefix or fallback.
 * @throws When the configured value has no positive integer prefix.
 */
function parseOptionalPositiveInteger(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  assert.ok(
    Number.isInteger(parsed) && parsed > 0,
    `${name} must be a positive integer.`,
  );

  return parsed;
}

/**
 * Creates unique sentinel values used to verify redaction.
 *
 * @param runPrefix - Unique prefix for this live-test run.
 * @returns Sentinel values keyed by their test location.
 */
function createSecretValues(runPrefix: string): Record<string, string> {
  return {
    directAttributePassword: `${runPrefix}-direct-attribute-password`,
    directAttributeToken: `${runPrefix}-direct-attribute-token`,
    directChildToken: `${runPrefix}-direct-child-token`,
    directRawSecret: `${runPrefix}-direct-raw-secret`,
    directRawToken: `${runPrefix}-direct-raw-token`,
    proxyAttributeToken: `${runPrefix}-proxy-attribute-token`,
    proxyContextToken: `${runPrefix}-proxy-context-token`,
    proxyRawAuthorization: `${runPrefix}-proxy-raw-authorization`,
  };
}

/**
 * Builds a unique structured event name for the live-test run.
 *
 * @param runPrefix - Unique prefix for this live-test run.
 * @param name - Event-specific suffix.
 * @returns Namespaced event name.
 */
function message(runPrefix: string, name: string): string {
  return `${runPrefix}.${name}`;
}

/**
 * Polls Axiom until every expected event appears or the deadline expires.
 *
 * @param input - Query configuration, expected messages, and time boundary.
 * @returns All matching rows from the successful query.
 * @rejects When querying fails or expected events do not arrive before timeout.
 */
async function waitForRows(input: {
  /** Axiom query and polling settings. */
  config: {
    /** Axiom dataset to query. */
    dataset: string;
    /** Optional Axiom API domain override. */
    edgeDomain?: string;
    /** Delay between queries in milliseconds. */
    pollIntervalMs: number;
    /** Maximum polling duration in milliseconds. */
    timeoutMs: number;
    /** Axiom API token. */
    token: string;
  };
  /** Event names that must appear before polling succeeds. */
  expectedMessages: readonly string[];
  /** Unique prefix used to select this run's events. */
  runPrefix: string;
  /** Earliest event timestamp included in the query. */
  startedAt: string;
}): Promise<QueryRow[]> {
  const deadline = Date.now() + input.config.timeoutMs;
  let lastRows: QueryRow[] = [];

  while (Date.now() < deadline) {
    lastRows = await queryAxiom({
      config: input.config,
      runPrefix: input.runPrefix,
      startedAt: input.startedAt,
    });

    const messages = new Set(
      lastRows.map((row) => getField(row, "message")).filter(isString),
    );
    const missingMessages = input.expectedMessages.filter(
      (expectedMessage) => !messages.has(expectedMessage),
    );

    if (missingMessages.length === 0) {
      return lastRows;
    }

    console.log(
      `received ${messages.size}/${input.expectedMessages.length}; waiting for: ${missingMessages
        .slice(0, 5)
        .join(", ")}`,
    );
    await delay(input.config.pollIntervalMs);
  }

  const finalMessages = new Set(
    lastRows.map((row) => getField(row, "message")).filter(isString),
  );
  const missingMessages = input.expectedMessages.filter(
    (expectedMessage) => !finalMessages.has(expectedMessage),
  );

  throw new Error(
    [
      `Timed out after ${input.config.timeoutMs}ms waiting for Axiom events.`,
      `Missing ${missingMessages.length} events:`,
      ...missingMessages.map((missingMessage) => `- ${missingMessage}`),
    ].join("\n"),
  );
}

/**
 * Queries Axiom for events emitted by one live-test run.
 *
 * @param input - Dataset credentials, run prefix, and query start time.
 * @returns Matching Axiom rows.
 * @rejects When the request, response status, JSON parsing, or tabular conversion fails.
 */
async function queryAxiom(input: {
  /** Axiom dataset credentials and endpoint settings. */
  config: {
    /** Axiom dataset to query. */
    dataset: string;
    /** Optional Axiom API domain override. */
    edgeDomain?: string;
    /** Axiom API token. */
    token: string;
  };
  /** Unique prefix used to select this run's events. */
  runPrefix: string;
  /** Earliest event timestamp included in the query. */
  startedAt: string;
}): Promise<QueryRow[]> {
  const domain = input.config.edgeDomain ?? "api.axiom.co";
  const apl = [
    `[${quoteAplString(input.config.dataset)}]`,
    `| where message contains ${quoteAplString(input.runPrefix)}`,
    "| limit 100",
  ].join("\n");
  const response = await fetch(
    `https://${domain}/v1/datasets/_apl?format=tabular`,
    {
      body: JSON.stringify({
        apl,
        startTime: input.startedAt,
      }),
      headers: {
        Authorization: `Bearer ${input.config.token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Axiom query failed with ${response.status}: ${await response.text()}`,
    );
  }

  return rowsFromTabular((await response.json()) as unknown);
}

/**
 * Quotes a string for safe interpolation into an APL query.
 *
 * @param value - Literal string value.
 * @returns JSON-quoted APL string literal.
 */
function quoteAplString(value: string): string {
  return JSON.stringify(value);
}

/**
 * Converts the first Axiom tabular result from columns into row records.
 *
 * @param body - Parsed Axiom tabular response.
 * @returns Row records keyed by field name, or an empty array without a table.
 * @throws When the response is not an object or its table fields and columns are malformed.
 */
function rowsFromTabular(body: unknown): QueryRow[] {
  assertRecord(body, "Axiom query response");
  const response = body as AxiomTabularResponse;
  const table = response.tables?.[0];

  if (!table) {
    return [];
  }

  const fields = table.fields ?? [];
  const columns = table.columns ?? [];
  const fieldNames = fields.map((field) => field.name);
  const rowCount = Math.max(0, ...columns.map((column) => column.length));
  const rows: QueryRow[] = [];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row: QueryRow = {};

    for (
      let columnIndex = 0;
      columnIndex < fieldNames.length;
      columnIndex += 1
    ) {
      const fieldName = fieldNames[columnIndex];

      if (fieldName) {
        row[fieldName] = columns[columnIndex]?.[rowIndex];
      }
    }

    rows.push(row);
  }

  return rows;
}

/**
 * Verifies event delivery, filtering, metadata, outcomes, and redaction.
 *
 * @param rows - Matching rows returned by Axiom.
 * @param input - Expected event names, identifiers, and secret sentinels.
 * @throws When any live logger invariant is not satisfied.
 */
function assertRows(
  rows: readonly QueryRow[],
  input: {
    /** Event names expected in Axiom. */
    expectedMessages: readonly string[];
    /** Info event expected to be filtered out. */
    filteredInfoMessage: string;
    /** Unique deployment identifier for this run. */
    runId: string;
    /** Prefix used to build this run's event names. */
    runPrefix: string;
    /** Sentinel values that must not appear in stored rows. */
    secrets: Record<string, string>;
  },
): void {
  for (const expectedMessage of input.expectedMessages) {
    assert.ok(findRow(rows, expectedMessage), `Missing ${expectedMessage}.`);
  }

  assert.equal(
    findRow(rows, input.filteredInfoMessage),
    undefined,
    "Info event from warn-level logger should have been filtered.",
  );

  for (const level of logLevels) {
    const directRow = requireRow(
      rows,
      message(input.runPrefix, `direct.level.${level}`),
    );
    assert.equal(getField(directRow, "deploymentId"), input.runId);
    assert.equal(getField(directRow, "deploymentTarget"), "test");
    assert.equal(getField(directRow, "level"), level);
    assert.equal(getField(directRow, "attributes.emittedLevel"), level);

    const proxyRow = requireRow(
      rows,
      message(input.runPrefix, `proxy.level.${level}`),
    );
    assert.equal(getField(proxyRow, "app"), "web");
    assert.equal(getField(proxyRow, "deploymentId"), input.runId);
    assert.equal(getField(proxyRow, "deploymentTarget"), "web-client");
    assert.equal(getField(proxyRow, "environment"), "automated-tests");
    assert.equal(getField(proxyRow, "level"), level);
    assert.equal(getField(proxyRow, "attributes.source"), "log-proxy");
    assert.equal(getField(proxyRow, "context.proxyContext"), "client-value");
  }

  const childRow = requireRow(
    rows,
    message(input.runPrefix, "direct.child-context"),
  );
  assert.equal(getField(childRow, "context.childContext"), "child-value");

  const directErrorRow = requireRow(
    rows,
    message(input.runPrefix, "direct.error"),
  );
  assert.equal(getField(directErrorRow, "error.name"), "Error");
  assert.equal(getField(directErrorRow, "error.message"), "Direct live error");

  const proxyErrorRow = requireRow(
    rows,
    message(input.runPrefix, "proxy.error"),
  );
  assert.equal(getField(proxyErrorRow, "app"), "web");
  assert.equal(getField(proxyErrorRow, "error.name"), "TypeError");
  assert.equal(
    getField(proxyErrorRow, "error.message"),
    "Proxy client live error",
  );

  const operationSuccessRow = requireRow(
    rows,
    `${message(input.runPrefix, "direct.operation.success")}.succeeded`,
  );
  assert.equal(getField(operationSuccessRow, "attributes.outcome"), "success");
  assert.equal(
    getField(operationSuccessRow, "attributes.operation"),
    message(input.runPrefix, "direct.operation.success"),
  );
  assert.ok(
    typeof getField(operationSuccessRow, "attributes.durationMs") === "number",
    "Operation success duration should be numeric.",
  );

  const operationFailureRow = requireRow(
    rows,
    `${message(input.runPrefix, "direct.operation.failure")}.failed`,
  );
  assert.equal(getField(operationFailureRow, "attributes.outcome"), "failure");
  assert.equal(
    getField(operationFailureRow, "error.message"),
    "Direct operation failure",
  );

  const rowJson = JSON.stringify(rows);
  for (const secret of Object.values(input.secrets)) {
    assert.ok(
      !rowJson.includes(secret),
      `Secret leaked into Axiom rows: ${secret}`,
    );
  }
  assert.ok(
    rowJson.includes("[REDACTED]"),
    "Expected redacted values to be present in queried rows.",
  );
}

/**
 * Finds the first Axiom row with a matching event message.
 *
 * @param rows - Rows to search.
 * @param eventMessage - Exact structured event name.
 * @returns The matching row, or `undefined` when absent.
 */
function findRow(
  rows: readonly QueryRow[],
  eventMessage: string,
): QueryRow | undefined {
  return rows.find((row) => getField(row, "message") === eventMessage);
}

/**
 * Returns an Axiom row with a required event message.
 *
 * @param rows - Rows to search.
 * @param eventMessage - Exact structured event name.
 * @returns The matching row.
 * @throws When the event is absent.
 */
function requireRow(rows: readonly QueryRow[], eventMessage: string): QueryRow {
  const row = findRow(rows, eventMessage);
  assert.ok(row, `Missing ${eventMessage}.`);

  return row;
}

/**
 * Reads an exact or dot-delimited field path from an Axiom row.
 *
 * @param row - Axiom result row.
 * @param path - Exact key or nested dot path.
 * @returns The field value, or `undefined` when the path is absent.
 */
function getField(row: QueryRow, path: string): unknown {
  if (Object.hasOwn(row, path)) {
    return row[path];
  }

  let current: unknown = row;

  for (const segment of path.split(".")) {
    if (!isRecord(current) || !(segment in current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

/**
 * Asserts that a value is a non-array object.
 *
 * @param value - Candidate record.
 * @param label - Human-readable value label used in assertion failures.
 * @throws When the value is not a record.
 */
function assertRecord(
  value: unknown,
  label: string,
): asserts value is QueryRow {
  assert.ok(isRecord(value), `${label} must be an object.`);
}

/**
 * Checks whether a value is a non-array object.
 *
 * @param value - Candidate record.
 * @returns Whether the value is a record.
 */
function isRecord(value: unknown): value is QueryRow {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Checks whether a value is a string.
 *
 * @param value - Candidate string.
 * @returns Whether the value is a string.
 */
function isString(value: unknown): value is string {
  return typeof value === "string";
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
