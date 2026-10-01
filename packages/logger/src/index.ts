import { loggerValues } from "./constants/logger.js";

export { loggerMessages, loggerValues } from "./constants/logger.js";

/** Numeric severity thresholds for supported log levels. */
export const logLevelWeights = {
  trace: 10,
  debug: 20,
  verbose: 30,
  info: 40,
  warn: 50,
  error: 60,
  fatal: 70,
} as const;

/** Supported structured log severity. */
export type LogLevel = keyof typeof logLevelWeights;

/** Supported log levels in ascending severity order. */
export const logLevels = Object.keys(logLevelWeights) as LogLevel[];

/** Arbitrary structured fields attached to a log event. */
export type LogContext = Record<string, unknown>;

/** Error fields safe for structured serialization. */
export type SerializedError = {
  /** Redacted nested error cause, when present. */
  cause?: unknown;
  /** Error message. */
  message: string;
  /** Error class or category name. */
  name: string;
  /** Error stack trace, when available. */
  stack?: string;
};

/** Canonical structured event delivered to logger transports. */
export type LogEvent = {
  /** Application that emitted the event. */
  app: string;
  /** Event-specific searchable fields. */
  attributes?: LogContext;
  /** Per-event console rendering options. */
  console?: ConsoleLogOptions;
  /** Context shared across related events. */
  context?: LogContext;
  /** Deployment identifier, when known. */
  deploymentId?: string;
  /** Deployment platform or target, when known. */
  deploymentTarget?: string;
  /** Runtime environment that emitted the event. */
  environment: string;
  /** Serialized failure associated with the event. */
  error?: SerializedError;
  /** Event severity. */
  level: LogLevel;
  /** Stable structured event name. */
  message: string;
  /** Explicitly included and redacted source payload. */
  rawPayload?: unknown;
  /** ISO timestamp for event creation. */
  timestamp: string;
};

/** Per-event console transport overrides. */
export type ConsoleLogOptions = {
  /** Console rendering mode for this event. */
  mode?: ConsoleTransportMode;
};

/** Optional structured fields supplied while emitting an event. */
export type LogData = {
  /** Event-specific searchable fields. */
  attributes?: LogContext;
  /** Per-event console rendering options. */
  console?: ConsoleLogOptions;
  /** Context merged with the logger's base context. */
  context?: LogContext;
  /** Failure to serialize onto the event. */
  error?: unknown;
  /** Whether to retain a redacted raw payload. */
  includeRawPayload?: boolean;
  /** Source payload retained only when explicitly enabled. */
  rawPayload?: unknown;
};

/** Destination that receives structured log events. */
export type LogTransport = {
  /**
   * Waits for buffered transport work to finish.
   *
   * @returns Completion after buffered work is settled.
   */
  flush?: () => Promise<void> | void;
  /**
   * Delivers one structured event.
   *
   * @param event - Event to deliver.
   * @returns Completion after the event is accepted by the transport.
   */
  log: (event: LogEvent) => Promise<void> | void;
};

/** Console event rendering detail. */
export type ConsoleTransportMode = "compact" | "verbose";

/** Console transport behavior and output sink. */
export type ConsoleTransportConfig = {
  /** Default console rendering mode. */
  mode?: ConsoleTransportMode;
  /** Console-compatible destination for rendered lines. */
  writer?: {
    /**
     * Writes an error-level console entry.
     *
     * @param message - Primary value to write.
     * @param optionalParams - Additional values to write.
     */
    error: (message?: unknown, ...optionalParams: unknown[]) => void;
    /**
     * Writes a general console entry.
     *
     * @param message - Primary value to write.
     * @param optionalParams - Additional values to write.
     */
    log: (message?: unknown, ...optionalParams: unknown[]) => void;
    /**
     * Writes a warning-level console entry.
     *
     * @param message - Primary value to write.
     * @param optionalParams - Additional values to write.
     */
    warn: (message?: unknown, ...optionalParams: unknown[]) => void;
  };
};

/** Structured logger API with severity, forwarding, and operation helpers. */
export type Logger = {
  /**
   * Creates a logger whose base context extends this logger's context.
   *
   * @param context - Context fields to merge into future events.
   * @returns A child logger sharing the configured transports.
   */
  child: (context: LogContext) => Logger;
  /**
   * Emits a debug event.
   *
   * @param message - Stable structured event name.
   * @param data - Optional event fields.
   */
  debug: (message: string, data?: LogData) => void;
  /**
   * Emits an error event.
   *
   * @param message - Stable structured event name.
   * @param data - Optional event fields.
   */
  error: (message: string, data?: LogData) => void;
  /**
   * Emits a fatal event.
   *
   * @param message - Stable structured event name.
   * @param data - Optional event fields.
   */
  fatal: (message: string, data?: LogData) => void;
  /**
   * Waits for pending events and transport buffers to settle.
   *
   * @returns Completion after pending transport work settles.
   */
  flush: () => Promise<void>;
  /**
   * Re-emits a prebuilt event after redaction and optional enrichment.
   *
   * @param event - Event identity and fields to preserve.
   * @param data - Optional server-side enrichment.
   */
  forward: (event: LogEvent, data?: LogData) => void;
  /**
   * Emits an informational event.
   *
   * @param message - Stable structured event name.
   * @param data - Optional event fields.
   */
  info: (message: string, data?: LogData) => void;
  /**
   * Runs an action and emits its duration and outcome.
   *
   * @template T - Action result.
   * @param name - Stable operation name used for outcome events.
   * @param action - Synchronous or asynchronous work to run.
   * @param data - Optional event fields shared by outcome events.
   * @returns The action result.
   * @rejects When the action fails, after emitting a failure event.
   */
  operation: <T>(
    name: string,
    action: () => T | Promise<T>,
    data?: LogData,
  ) => Promise<T>;
  /**
   * Emits a trace event.
   *
   * @param message - Stable structured event name.
   * @param data - Optional event fields.
   */
  trace: (message: string, data?: LogData) => void;
  /**
   * Emits a verbose event.
   *
   * @param message - Stable structured event name.
   * @param data - Optional event fields.
   */
  verbose: (message: string, data?: LogData) => void;
  /**
   * Emits a warning event.
   *
   * @param message - Stable structured event name.
   * @param data - Optional event fields.
   */
  warn: (message: string, data?: LogData) => void;
};

/** Identity, filtering, redaction, and transport settings for a logger. */
export type LoggerConfig = {
  /** Application name attached to emitted events. */
  app: string;
  /** Base context included with emitted events. */
  context?: LogContext;
  /** Deployment identifier attached to emitted events. */
  deploymentId?: string;
  /** Deployment platform or target attached to emitted events. */
  deploymentTarget?: string;
  /** Runtime environment attached to emitted events. */
  environment: string;
  /** Minimum emitted severity. */
  level?: LogLevel;
  /** Additional case-insensitive field names to redact. */
  redactKeys?: readonly string[];
  /** Destinations that receive emitted events. */
  transports?: readonly LogTransport[];
};

/** Minimal HTTP response consumed by remote transports. */
export type FetchResponse = {
  /** Whether the response status represents success. */
  ok: boolean;
  /** Numeric HTTP status. */
  status: number;
  /**
   * Reads the response body as text when supported.
   *
   * @returns Response body text.
   */
  text?: () => Promise<string>;
};

/**
 * Minimal fetch contract used by remote transports.
 *
 * @param input - Request URL.
 * @param init - Optional request body, headers, and method.
 * @returns The remote response.
 * @rejects When the request cannot be completed.
 */
export type FetchLike = (
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

/** Credentials and endpoint settings for Axiom ingestion. */
export type AxiomTransportConfig = {
  /** Axiom dataset receiving events. */
  dataset: string;
  /** Optional Axiom API domain override. */
  edgeDomain?: string;
  /** Optional fetch implementation. */
  fetch?: FetchLike;
  /** Axiom API token. */
  token: string;
};

/** Endpoint settings for client log proxy delivery. */
export type ProxyTransportConfig = {
  /** Optional client authentication key. */
  clientKey?: string;
  /** Optional fetch implementation. */
  fetch?: FetchLike;
  /** Log proxy endpoint URL. */
  url: string;
};

/** Placeholder substituted for values under sensitive field names. */
const redactedValue = "[REDACTED]";

/** Case-insensitive field names redacted from structured values by default. */
const defaultRedactKeys = [
  "authorization",
  "apiKey",
  "clientSecret",
  "connectionString",
  "cookie",
  "databaseUrl",
  "jwt",
  "passphrase",
  "password",
  "privateKey",
  "secret",
  "session",
  "token",
] as const;

/**
 * Checks whether a value names a supported log level.
 *
 * @param value - Candidate log level.
 * @returns Whether the value is a supported level.
 */
export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === "string" && value in logLevelWeights;
}

/** Maximum number of client events accepted in one proxy request. */
export const maxClientLogBatchSize = loggerValues.logProxy.maxBatchSize;

/**
 * Validates and normalizes a single client event or event batch.
 *
 * @param body - Parsed client request payload.
 * @returns Normalized events or the first validation error.
 */
export function parseClientLogEvents(body: unknown):
  | {
      /** Successful parse marker. */
      ok: true;
      /** Normalized client events. */
      value: LogEvent[];
    }
  | {
      /** Validation failure description. */
      error: string;
      /** Failed parse marker. */
      ok: false;
    } {
  const events = unwrapLogEvents(body);

  if (!Array.isArray(events)) {
    return { error: "Expected a log event or an event batch.", ok: false };
  }

  if (events.length === 0) {
    return { error: "Expected at least one log event.", ok: false };
  }

  if (events.length > maxClientLogBatchSize) {
    return {
      error: `Log batches are limited to ${maxClientLogBatchSize} events.`,
      ok: false,
    };
  }

  const normalizedEvents: LogEvent[] = [];

  for (const event of events) {
    const normalizedEvent = normalizeClientLogEvent(event);

    if (!normalizedEvent.ok) {
      return normalizedEvent;
    }

    normalizedEvents.push(normalizedEvent.value);
  }

  return { ok: true, value: normalizedEvents };
}

/**
 * Resolves a configured log level, defaulting invalid values to `info`.
 *
 * @param value - Configured log level.
 * @returns A supported log level.
 */
export function normalizeLogLevel(value: string | undefined): LogLevel {
  return isLogLevel(value) ? value : "info";
}

/**
 * Resolves a console mode, defaulting values other than `verbose` to `compact`.
 *
 * @param value - Configured console mode.
 * @returns The normalized console mode.
 */
export function normalizeConsoleTransportMode(
  value: string | undefined,
): ConsoleTransportMode {
  return value === "verbose" ? "verbose" : "compact";
}

/**
 * Recursively redacts sensitive fields and normalizes dates and errors.
 * Circular references become the string `[Circular]`.
 *
 * @param value - Structured value to sanitize.
 * @param extraKeys - Additional case-insensitive field names to redact.
 * @returns A sanitized copy or the original primitive value.
 */
export function redactValue(
  value: unknown,
  extraKeys: readonly string[] = [],
): unknown {
  return redactUnknown(
    value,
    createRedactSet(extraKeys),
    new WeakSet<object>(),
  );
}

/**
 * Converts an unknown failure into structured error fields.
 *
 * @param error - Failure value to serialize.
 * @returns A structured error with redacted cause data when available.
 */
export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      cause: error.cause ? redactValue(error.cause) : undefined,
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
    name: "Error",
  };
}

/**
 * Summarizes a database payload without retaining its values.
 *
 * @param payload - Database payload to summarize.
 * @returns Payload kind, shape, and bounded key metadata.
 */
export function summarizeDbPayload(payload: unknown): LogContext {
  return summarizePayload("db", payload);
}

/**
 * Summarizes an API payload without retaining its values.
 *
 * @param payload - API payload to summarize.
 * @returns Payload kind, shape, and bounded key metadata.
 */
export function summarizeApiPayload(payload: unknown): LogContext {
  return summarizePayload("api", payload);
}

/**
 * Creates a logger that filters and structures events without delivering them.
 *
 * @param config - Optional logger identity, context, level, and redaction settings.
 * @returns A logger with no transports.
 */
export function createNoopLogger(config: Partial<LoggerConfig> = {}): Logger {
  return createLogger({
    app: config.app ?? "unknown",
    context: config.context,
    environment: config.environment ?? "unknown",
    level: config.level,
    redactKeys: config.redactKeys,
    transports: [],
  });
}

/**
 * Creates a structured logger that redacts fields before asynchronous delivery.
 * Transport failures are swallowed by emission and awaited flush work.
 *
 * @param config - Logger identity, filtering, redaction, and transport settings.
 * @returns A structured logger.
 */
export function createLogger(config: LoggerConfig): Logger {
  const level = config.level ?? "info";
  const transports = [...(config.transports ?? [])];
  const redactKeys = [...(config.redactKeys ?? [])];
  const baseContext = { ...(config.context ?? {}) };
  const pending = new Set<Promise<void>>();

  /**
   * Starts delivery to every transport and tracks pending work.
   *
   * @param event - Structured event to deliver.
   */
  const send = (event: LogEvent): void => {
    for (const transport of transports) {
      const task = Promise.resolve(transport.log(event)).catch(() => undefined);
      pending.add(task);
      task.then(
        () => pending.delete(task),
        () => pending.delete(task),
      );
    }
  };

  /**
   * Builds, filters, redacts, and sends a local event.
   *
   * @param eventLevel - Severity assigned to the event.
   * @param message - Stable structured event name.
   * @param data - Optional event fields.
   */
  const emit = (
    eventLevel: LogLevel,
    message: string,
    data?: LogData,
  ): void => {
    if (logLevelWeights[eventLevel] < logLevelWeights[level]) {
      return;
    }

    const event: LogEvent = {
      app: config.app,
      deploymentId: config.deploymentId,
      deploymentTarget: config.deploymentTarget,
      environment: config.environment,
      level: eventLevel,
      message,
      timestamp: new Date().toISOString(),
    };

    const context = redactValue(
      {
        ...baseContext,
        ...(data?.context ?? {}),
      },
      redactKeys,
    );

    if (hasKeys(context)) {
      event.context = context;
    }

    if (data?.attributes) {
      const attributes = redactValue(data.attributes, redactKeys);
      if (hasKeys(attributes)) {
        event.attributes = attributes;
      }
    }

    if (data?.error) {
      event.error = serializeError(data.error);
    }

    if (data?.includeRawPayload) {
      event.rawPayload = redactValue(data.rawPayload, redactKeys);
    }

    if (data?.console) {
      event.console = data.console;
    }

    send(event);
  };

  /**
   * Filters, redacts, enriches, and sends a prebuilt event.
   *
   * @param inputEvent - Client event whose top-level identity is preserved.
   * @param data - Optional server-side enrichment.
   */
  const forward = (inputEvent: LogEvent, data?: LogData): void => {
    if (logLevelWeights[inputEvent.level] < logLevelWeights[level]) {
      return;
    }

    const event: LogEvent = {
      app: String(inputEvent.app),
      deploymentId: inputEvent.deploymentId,
      deploymentTarget: inputEvent.deploymentTarget,
      environment: String(inputEvent.environment),
      level: inputEvent.level,
      message: String(inputEvent.message),
      timestamp: String(inputEvent.timestamp),
    };

    const context = redactValue(
      {
        ...baseContext,
        ...(inputEvent.context ?? {}),
        ...(data?.context ?? {}),
      },
      redactKeys,
    );

    if (hasKeys(context)) {
      event.context = context;
    }

    const attributes = redactValue(
      {
        ...(inputEvent.attributes ?? {}),
        ...(data?.attributes ?? {}),
      },
      redactKeys,
    );

    if (hasKeys(attributes)) {
      event.attributes = attributes;
    }

    if (data?.error) {
      event.error = serializeError(data.error);
    } else if (inputEvent.error) {
      event.error = redactValue(
        inputEvent.error,
        redactKeys,
      ) as SerializedError;
    }

    if (data?.includeRawPayload) {
      event.rawPayload = redactValue(data.rawPayload, redactKeys);
    } else if (inputEvent.rawPayload !== undefined) {
      event.rawPayload = redactValue(inputEvent.rawPayload, redactKeys);
    }

    if (data?.console ?? inputEvent.console) {
      event.console = data?.console ?? inputEvent.console;
    }

    send(event);
  };

  const logger: Logger = {
    /**
     * Creates a logger with additional base context.
     *
     * @param context - Context fields to merge into future events.
     * @returns A child logger sharing the configured transports.
     */
    child(context) {
      return createLogger({
        ...config,
        context: {
          ...baseContext,
          ...context,
        },
        transports,
      });
    },
    /**
     * Emits a debug event.
     *
     * @param message - Stable structured event name.
     * @param data - Optional event fields.
     */
    debug(message, data) {
      emit("debug", message, data);
    },
    /**
     * Emits an error event.
     *
     * @param message - Stable structured event name.
     * @param data - Optional event fields.
     */
    error(message, data) {
      emit("error", message, data);
    },
    /**
     * Emits a fatal event.
     *
     * @param message - Stable structured event name.
     * @param data - Optional event fields.
     */
    fatal(message, data) {
      emit("fatal", message, data);
    },
    /**
     * Waits for pending deliveries and transport buffers to settle.
     *
     * @returns Completion after all pending transport work settles.
     */
    async flush() {
      await Promise.all([...pending]);
      await Promise.all(transports.map((transport) => transport.flush?.()));
    },
    forward,
    /**
     * Emits an informational event.
     *
     * @param message - Stable structured event name.
     * @param data - Optional event fields.
     */
    info(message, data) {
      emit("info", message, data);
    },
    /**
     * Runs an action and emits its duration and outcome.
     *
     * @template T - Action result.
     * @param name - Stable operation name used for outcome events.
     * @param action - Synchronous or asynchronous work to run.
     * @param data - Optional event fields shared by outcome events.
     * @returns The action result.
     * @rejects When the action fails, after emitting a failure event.
     */
    async operation(name, action, data) {
      const startedAt = Date.now();

      try {
        const result = await action();
        emit("info", `${name}.succeeded`, {
          ...data,
          attributes: {
            ...(data?.attributes ?? {}),
            durationMs: Date.now() - startedAt,
            operation: name,
            outcome: "success",
          },
        });
        return result;
      } catch (error) {
        emit("error", `${name}.failed`, {
          ...data,
          attributes: {
            ...(data?.attributes ?? {}),
            durationMs: Date.now() - startedAt,
            operation: name,
            outcome: "failure",
          },
          error,
        });
        throw error;
      }
    },
    /**
     * Emits a trace event.
     *
     * @param message - Stable structured event name.
     * @param data - Optional event fields.
     */
    trace(message, data) {
      emit("trace", message, data);
    },
    /**
     * Emits a verbose event.
     *
     * @param message - Stable structured event name.
     * @param data - Optional event fields.
     */
    verbose(message, data) {
      emit("verbose", message, data);
    },
    /**
     * Emits a warning event.
     *
     * @param message - Stable structured event name.
     * @param data - Optional event fields.
     */
    warn(message, data) {
      emit("warn", message, data);
    },
  };

  return logger;
}

/**
 * Creates a transport that writes one JSON line per event.
 *
 * @param config - Default rendering mode and console-compatible writer.
 * @returns A synchronous console transport.
 */
export function createConsoleTransport(
  config: ConsoleTransportConfig = {},
): LogTransport {
  const mode = config.mode ?? "compact";
  const writer = config.writer ?? console;

  return {
    /**
     * Renders and writes an event at its matching console severity.
     *
     * @param event - Structured event to write.
     */
    log(event) {
      const eventMode = event.console?.mode ?? mode;
      const eventForOutput = omitConsoleOptions(event);
      const output =
        eventMode === "verbose"
          ? {
              ...eventForOutput,
              levelWeight: logLevelWeights[event.level],
            }
          : compactConsoleEvent(eventForOutput);
      const line = JSON.stringify(output);

      if (event.level === "fatal" || event.level === "error") {
        writer.error(line);
        return;
      }

      if (event.level === "warn") {
        writer.warn(line);
        return;
      }

      writer.log(line);
    },
  };
}

/**
 * Creates a transport that ingests events into an Axiom dataset.
 *
 * @param config - Axiom credentials, dataset, domain, and fetch override.
 * @returns An Axiom ingestion transport.
 */
export function createAxiomTransport(
  config: AxiomTransportConfig,
): LogTransport {
  return {
    /**
     * Sends an event to the configured Axiom dataset.
     *
     * @param event - Structured event to ingest.
     * @returns Completion after Axiom accepts the request.
     * @rejects When fetch is unavailable, the request fails, or Axiom rejects it.
     */
    async log(event) {
      const fetcher = config.fetch ?? getGlobalFetch();
      const domain = config.edgeDomain ?? "api.axiom.co";
      const eventForIngest = omitConsoleOptions(event);
      const response = await fetcher(
        `https://${domain}/v1/datasets/${encodeURIComponent(
          config.dataset,
        )}/ingest`,
        {
          body: JSON.stringify([eventForIngest]),
          headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      if (!response.ok) {
        const body = await response.text?.();
        throw new Error(
          `Axiom ingest failed with ${response.status}${body ? `: ${body}` : ""}`,
        );
      }
    },
  };
}

/**
 * Creates a transport that posts events to a log proxy endpoint.
 *
 * @param config - Proxy URL, optional client key, and fetch override.
 * @returns A log proxy transport.
 */
export function createProxyTransport(
  config: ProxyTransportConfig,
): LogTransport {
  return {
    /**
     * Sends an event batch containing one event to the configured proxy.
     *
     * @param event - Structured event to forward.
     * @returns Completion after the proxy accepts the request.
     * @rejects When fetch is unavailable, the request fails, or the proxy rejects it.
     */
    async log(event) {
      const fetcher = config.fetch ?? getGlobalFetch();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (config.clientKey) {
        headers[loggerValues.logProxy.clientKeyHeader] = config.clientKey;
      }

      const response = await fetcher(config.url, {
        body: JSON.stringify({
          events: [omitConsoleOptions(event)],
        }),
        headers,
        method: "POST",
      });

      if (!response.ok) {
        const body = await response.text?.();
        throw new Error(
          `Log proxy failed with ${response.status}${body ? `: ${body}` : ""}`,
        );
      }
    },
  };
}

/**
 * Removes console-only options before remote transport delivery.
 *
 * @param event - Event containing optional console settings.
 * @returns A shallow event copy without console settings.
 */
function omitConsoleOptions(event: LogEvent): Omit<LogEvent, "console"> {
  const { console: consoleOptions, ...eventForTransport } = event;
  void consoleOptions;

  return eventForTransport;
}

/**
 * Extracts an event array from accepted client payload shapes.
 *
 * @param body - Single event, event array, or object with an `events` array.
 * @returns The supplied event array or a single-item wrapper.
 */
function unwrapLogEvents(body: unknown): unknown {
  if (Array.isArray(body)) {
    return body;
  }

  if (isRecord(body) && Array.isArray(body.events)) {
    return body.events;
  }

  return [body];
}

/**
 * Validates and normalizes one untrusted client log event.
 *
 * @param event - Candidate client event.
 * @returns A normalized event or validation error.
 */
function normalizeClientLogEvent(event: unknown):
  | {
      /** Successful normalization marker. */
      ok: true;
      /** Normalized client event. */
      value: LogEvent;
    }
  | {
      /** Validation failure description. */
      error: string;
      /** Failed normalization marker. */
      ok: false;
    } {
  if (!isRecord(event)) {
    return { error: "Log event must be an object.", ok: false };
  }

  if (!isShortString(event.app)) {
    return { error: "Log event app must be a string.", ok: false };
  }

  if (!isShortString(event.environment)) {
    return { error: "Log event environment must be a string.", ok: false };
  }

  if (
    event.deploymentTarget !== undefined &&
    !isShortString(event.deploymentTarget)
  ) {
    return {
      error: "Log event deploymentTarget must be a string.",
      ok: false,
    };
  }

  if (event.deploymentId !== undefined && !isShortString(event.deploymentId)) {
    return { error: "Log event deploymentId must be a string.", ok: false };
  }

  if (!isLogLevel(event.level)) {
    return { error: "Log event level is invalid.", ok: false };
  }

  if (!isShortString(event.message, 500)) {
    return { error: "Log event message must be a string.", ok: false };
  }

  if (event.timestamp !== undefined && typeof event.timestamp !== "string") {
    return { error: "Log event timestamp must be a string.", ok: false };
  }

  if (event.attributes !== undefined && !isRecord(event.attributes)) {
    return { error: "Log event attributes must be an object.", ok: false };
  }

  if (event.context !== undefined && !isRecord(event.context)) {
    return { error: "Log event context must be an object.", ok: false };
  }

  if (event.error !== undefined && !isRecord(event.error)) {
    return { error: "Log event error must be an object.", ok: false };
  }

  const normalizedEvent: LogEvent = {
    app: event.app,
    deploymentId: event.deploymentId,
    deploymentTarget: event.deploymentTarget,
    environment: event.environment,
    level: event.level,
    message: event.message,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };

  if (event.attributes) {
    normalizedEvent.attributes = event.attributes;
  }

  if (event.context) {
    normalizedEvent.context = event.context;
  }

  if (event.error) {
    normalizedEvent.error = {
      message: String(event.error.message ?? "Client error"),
      name: String(event.error.name ?? "Error"),
      stack:
        typeof event.error.stack === "string" ? event.error.stack : undefined,
    };
  }

  if (event.rawPayload !== undefined) {
    normalizedEvent.rawPayload = event.rawPayload;
  }

  return {
    ok: true,
    value: normalizedEvent,
  };
}

/**
 * Checks whether a value is a non-array object.
 *
 * @param value - Candidate record.
 * @returns Whether the value is a record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Checks whether a value is a non-empty string within a length limit.
 *
 * @param value - Candidate string.
 * @param maxLength - Maximum accepted character count.
 * @returns Whether the value is within the accepted range.
 */
function isShortString(value: unknown, maxLength = 64): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= maxLength
  );
}

/**
 * Builds the normalized set of default and caller-supplied redaction keys.
 *
 * @param extraKeys - Additional sensitive field names.
 * @returns Normalized field names to redact.
 */
function createRedactSet(extraKeys: readonly string[]): Set<string> {
  return new Set(
    [...defaultRedactKeys, ...extraKeys].map((key) => normalizeKey(key)),
  );
}

/**
 * Reduces an event to fields useful in compact console output.
 *
 * @param event - Structured event to compact.
 * @returns Compact event identity, selected context, attributes, and error.
 */
function compactConsoleEvent(event: LogEvent): LogContext {
  const output: LogContext = {
    app: event.app,
    ...(event.deploymentId ? { deploymentId: event.deploymentId } : {}),
    ...(event.deploymentTarget
      ? { deploymentTarget: event.deploymentTarget }
      : {}),
    environment: event.environment,
    level: event.level,
    message: event.message,
    timestamp: event.timestamp,
  };

  copyKnownFields(output, event.context, [
    "requestId",
    "traceId",
    "spanId",
    "route",
  ]);
  copyKnownFields(output, event.attributes, [
    "source",
    "route",
    "method",
    "status",
    "statusCode",
    "operation",
    "outcome",
    "durationMs",
    "clientApp",
    "clientEnvironment",
  ]);

  const error = compactError(event);

  if (error) {
    output.error = error;
  }

  return output;
}

/**
 * Extracts compact error identity from server or client error fields.
 *
 * @param event - Structured event with optional error details.
 * @returns Error name and message, or `undefined` when absent.
 */
function compactError(event: LogEvent): LogContext | undefined {
  if (event.error) {
    return {
      message: event.error.message,
      name: event.error.name,
    };
  }

  const clientError = event.attributes?.clientError;

  if (!isPlainRecord(clientError)) {
    return undefined;
  }

  return {
    message: String(clientError.message ?? "Client error"),
    name: String(clientError.name ?? "Error"),
  };
}

/**
 * Copies defined allowlisted fields into an output object.
 *
 * @param output - Mutable destination record.
 * @param source - Optional source record.
 * @param keys - Field names permitted to copy.
 */
function copyKnownFields(
  output: LogContext,
  source: LogContext | undefined,
  keys: readonly string[],
): void {
  if (!source) {
    return;
  }

  for (const key of keys) {
    const value = source[key];

    if (value !== undefined) {
      output[key] = value;
    }
  }
}

/**
 * Recursively sanitizes a value while tracking circular object references.
 *
 * @param value - Value to sanitize.
 * @param redactKeys - Normalized field names whose values must be replaced.
 * @param seen - Objects already visited during this traversal.
 * @returns A sanitized copy or normalized primitive.
 */
function redactUnknown(
  value: unknown,
  redactKeys: Set<string>,
  seen: WeakSet<object>,
): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item, redactKeys, seen));
  }

  const result: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    result[key] = redactKeys.has(normalizeKey(key))
      ? redactedValue
      : redactUnknown(item, redactKeys, seen);
  }

  return result;
}

/**
 * Normalizes a field name for case- and punctuation-insensitive matching.
 *
 * @param key - Field name to normalize.
 * @returns Lowercase alphanumeric field name.
 */
function normalizeKey(key: string): string {
  return key.replaceAll(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

/**
 * Checks whether a value is a non-empty record.
 *
 * @param value - Candidate structured context.
 * @returns Whether the value contains at least one own key.
 */
function hasKeys(value: unknown): value is LogContext {
  return isPlainRecord(value) && Object.keys(value).length > 0;
}

/**
 * Checks whether a value is a non-array object.
 *
 * @param value - Candidate record.
 * @returns Whether the value is a record.
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Summarizes a payload's shape after redaction without retaining values.
 *
 * @param kind - Source category attached to the summary.
 * @param payload - Payload to redact and summarize.
 * @returns Payload kind, type, size, and up to twenty object keys.
 */
function summarizePayload(kind: "api" | "db", payload: unknown): LogContext {
  const redactedPayload = redactValue(payload);

  if (!redactedPayload || typeof redactedPayload !== "object") {
    return {
      kind,
      type: typeof redactedPayload,
    };
  }

  if (Array.isArray(redactedPayload)) {
    return {
      kind,
      length: redactedPayload.length,
      type: "array",
    };
  }

  const keys = Object.keys(redactedPayload);

  return {
    kind,
    keyCount: keys.length,
    keys: keys.slice(0, 20),
    type: "object",
  };
}

/**
 * Returns the runtime's global fetch implementation.
 *
 * @returns The global fetch implementation.
 * @throws When the runtime does not provide global fetch.
 */
function getGlobalFetch(): FetchLike {
  const fetcher = (
    globalThis as {
      /** Runtime fetch implementation, when available. */
      fetch?: FetchLike;
    }
  ).fetch;

  if (!fetcher) {
    throw new Error("A fetch implementation is required for this transport.");
  }

  return fetcher;
}
