import { z } from "zod";
import type { FetchLike, LogEvent, LogLevel, LogTransport } from "./index.js";

/** JSON-like fields allowed in the bounded notification projection. */
const safeFieldsSchema = z.record(z.string(), z.unknown());

/** Versioned event accepted by the Discord logger-notification intake. */
export const loggerNotificationEventSchema = z.object({
  app: z.string().min(1).max(100),
  attributes: safeFieldsSchema.optional(),
  context: safeFieldsSchema.optional(),
  deploymentId: z.string().min(1).max(200).optional(),
  deploymentTarget: z.string().min(1).max(100).optional(),
  environment: z.string().min(1).max(100),
  error: z
    .object({
      message: z.string().max(1_000),
      name: z.string().max(200),
    })
    .optional(),
  eventId: z.string().min(1).max(200),
  level: z.enum([
    "trace",
    "debug",
    "verbose",
    "info",
    "warn",
    "error",
    "fatal",
  ]),
  message: z.string().min(1).max(500),
  timestamp: z.iso.datetime(),
  version: z.literal(1),
});

/** Validated event sent to the Discord logger-notification intake. */
export type LoggerNotificationEvent = z.infer<
  typeof loggerNotificationEventSchema
>;

/** One allow-list rule for logger notifications. */
type LoggerNotificationRuleBase = {
  /** Application names eligible for the rule. */
  applications: readonly string[];
  /** Deployment environments eligible for the rule. */
  environments: readonly string[];
};

/** One allow-list rule for logger notifications. */
export type LoggerNotificationRule = LoggerNotificationRuleBase &
  (
    | {
        /** Log levels eligible for the rule. */
        levels: readonly LogLevel[];
        /** Optional stable message names eligible for the rule. */
        messages?: readonly string[];
      }
    | {
        /** Optional log levels eligible for the rule. */
        levels?: readonly LogLevel[];
        /** Stable message names eligible for the rule. */
        messages: readonly string[];
      }
  );

/** Initial production-only logger notification policy. */
export const loggerNotificationRules: readonly LoggerNotificationRule[] = [
  {
    applications: ["api", "web", "scraper"],
    environments: ["production"],
    levels: ["error", "fatal"],
  },
];

/**
 * Returns whether an event satisfies one complete notification rule.
 *
 * @param event - Canonical event fields used by notification rules.
 * @param rules - Complete allow-list rules to evaluate.
 * @returns Whether at least one rule matches every configured field.
 */
export function matchesLoggerNotificationRules(
  event: Pick<LogEvent, "app" | "environment" | "level" | "message">,
  rules: readonly LoggerNotificationRule[] = loggerNotificationRules,
): boolean {
  return rules.some(
    (rule) =>
      rule.applications.includes(event.app) &&
      rule.environments.includes(event.environment) &&
      (rule.levels === undefined || rule.levels.includes(event.level)) &&
      (rule.messages === undefined || rule.messages.includes(event.message)),
  );
}

/**
 * Projects a canonical log event onto the bounded notification contract.
 *
 * @param event - Canonical log event to project.
 * @returns A validated event without raw payloads, stacks, causes, or console settings.
 */
export function toLoggerNotificationEvent(
  event: LogEvent,
): LoggerNotificationEvent {
  return loggerNotificationEventSchema.parse({
    app: event.app,
    attributes: event.attributes,
    context: event.context,
    deploymentId: event.deploymentId,
    deploymentTarget: event.deploymentTarget,
    environment: event.environment,
    error: event.error
      ? { message: event.error.message, name: event.error.name }
      : undefined,
    eventId: event.eventId,
    level: event.level,
    message: event.message,
    timestamp: event.timestamp,
    version: 1,
  });
}

/** Settings for the server-only direct notification transport. */
export type LoggerNotificationTransportConfig = {
  /** Authenticated logger intake URL. */
  endpoint: string;
  /** Optional fetch implementation used by tests and alternate runtimes. */
  fetch?: FetchLike;
  /** Optional rule override. */
  rules?: readonly LoggerNotificationRule[];
  /** Bearer credential bound to the sending application. */
  token: string;
};

/**
 * Creates a filtered server-only transport for the Discord bot intake.
 *
 * @param config - Intake endpoint, credential, and optional rule overrides.
 * @returns A transport that posts only matching events.
 */
export function createLoggerNotificationTransport(
  config: LoggerNotificationTransportConfig,
): LogTransport {
  return {
    /**
     * Sends one matching event to the authenticated logger intake.
     *
     * @param event - Canonical log event to filter and deliver.
     * @rejects When the intake rejects or cannot receive the event.
     */
    async log(event) {
      if (!matchesLoggerNotificationRules(event, config.rules)) return;

      const response = await (config.fetch ?? globalThis.fetch)(
        config.endpoint,
        {
          body: JSON.stringify(toLoggerNotificationEvent(event)),
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
          `Logger notification failed with ${response.status}${body ? `: ${body}` : ""}`,
        );
      }
    },
  };
}
