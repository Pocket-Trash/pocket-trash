import { createEnv, type StandardSchemaV1 } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Unvalidated scraper environment values read from the process.
 */
export type ScraperRuntimeEnv = {
  /**
   * Application environment name.
   */
  APP_ENV?: string;
  /**
   * Axiom dataset used for scraper logs.
   */
  AXIOM_DATASET?: string;
  /**
   * Optional Axiom edge-ingestion domain.
   */
  AXIOM_EDGE_DOMAIN?: string;
  /**
   * Axiom ingestion token.
   */
  AXIOM_TOKEN?: string;
  /**
   * Bunny Storage API access key.
   */
  BUNNY_STORAGE_ACCESS_KEY?: string;
  /**
   * Bunny Storage HTTP endpoint URL.
   */
  BUNNY_STORAGE_ENDPOINT?: string;
  /**
   * Bunny Storage zone name.
   */
  BUNNY_STORAGE_ZONE_NAME?: string;
  /**
   * PostgreSQL connection URL.
   */
  DATABASE_URL?: string;
  /**
   * Public Bunny CDN base URL.
   */
  BUNNY_CDN_BASE_URL?: string;
  /**
   * Deployment-scoped Bunny image object prefix.
   */
  BUNNY_IMAGE_FOLDER_PREFIX?: string;
  /**
   * Image storage provider selector.
   */
  IMAGE_STORAGE_PROVIDER?: string;
  /**
   * Console logger mode.
   */
  LOGGER?: string;
  /**
   * Deployment identifier attached to logs.
   */
  LOG_DEPLOYMENT_ID?: string;
  /**
   * Runtime target attached to logs.
   */
  LOG_DEPLOYMENT_TARGET?: string;
  /**
   * Minimum emitted log level.
   */
  LOG_LEVEL?: string;
  /**
   * HTTP port before numeric coercion.
   */
  PORT?: string;
  /**
   * Railway environment used as deployment metadata.
   */
  RAILWAY_ENVIRONMENT_NAME?: string;
  /**
   * Legacy Railway Redis connection URL.
   */
  REDIS?: string;
  /**
   * Preferred Redis connection URL.
   */
  REDIS_URL?: string;
  /**
   * Autmog scheduling interval in minutes before numeric coercion.
   */
  SCRAPER_AUTMOG_INTERVAL_MINUTES?: string;
  /**
   * Autmog startup delay in seconds before numeric coercion.
   */
  SCRAPER_AUTMOG_START_DELAY_SECONDS?: string;
  /**
   * Dry-run flag encoded as `"true"` or `"false"`.
   */
  SCRAPER_DRY_RUN?: string;
  /**
   * Optional HTTP proxy URL for Grimsmo requests.
   */
  GRIMSMO_PROXY_URL?: string;
  /**
   * Grimsmo Fjell startup delay in seconds before numeric coercion.
   */
  SCRAPER_GRIMSMO_FJELL_START_DELAY_SECONDS?: string;
  /**
   * Grimsmo scheduling interval in minutes before numeric coercion.
   */
  SCRAPER_GRIMSMO_INTERVAL_MINUTES?: string;
  /**
   * Grimsmo Norseman startup delay in seconds before numeric coercion.
   */
  SCRAPER_GRIMSMO_NORSEMAN_START_DELAY_SECONDS?: string;
  /**
   * Grimsmo Rask startup delay in seconds before numeric coercion.
   */
  SCRAPER_GRIMSMO_RASK_START_DELAY_SECONDS?: string;
  /**
   * Grimsmo Saga startup delay in seconds before numeric coercion.
   */
  SCRAPER_GRIMSMO_SAGA_START_DELAY_SECONDS?: string;
  /**
   * Maximum image jobs handled per queue batch before numeric coercion.
   */
  SCRAPER_IMAGE_BATCH_SIZE?: string;
  /**
   * Maximum item jobs handled per queue batch before numeric coercion.
   */
  SCRAPER_ITEM_BATCH_SIZE?: string;
  /**
   * Queue processor scheduling interval in minutes before numeric coercion.
   */
  SCRAPER_QUEUE_PROCESSOR_INTERVAL_MINUTES?: string;
  /**
   * Queue processor startup delay in seconds before numeric coercion.
   */
  SCRAPER_QUEUE_PROCESSOR_START_DELAY_SECONDS?: string;
  /**
   * Concurrent queue worker count before numeric coercion.
   */
  SCRAPER_QUEUE_CONCURRENCY?: string;
  /**
   * Optional Railway cron flag encoded as `"true"` or `"false"`.
   */
  SCRAPER_CRON_ENABLED?: string;
  /**
   * Scheduler flag encoded as `"true"` or `"false"`.
   */
  SCRAPER_SCHEDULER_ENABLED?: string;
};

/**
 * One environment validation problem exposed to CLI callers.
 */
export type ScraperEnvValidationIssue = {
  /**
   * Human-readable validation message.
   */
  message: string;
  /**
   * Environment variable responsible for the issue, or `"unknown"`.
   */
  variable: string;
};

/**
 * Reports every invalid scraper environment variable.
 */
export class ScraperEnvValidationError extends Error {
  /**
   * Formatted validation issues.
   */
  readonly issues: readonly ScraperEnvValidationIssue[];
  /**
   * Unique invalid environment variable names.
   */
  readonly variables: readonly string[];

  /**
   * Creates an environment validation error from standard-schema issues.
   *
   * @param issues - Validation issues returned by the environment schema.
   */
  constructor(issues: readonly StandardSchemaV1.Issue[]) {
    const validationIssues = issues.map(formatValidationIssue);
    const variables = [
      ...new Set(validationIssues.map((issue) => issue.variable)),
    ];
    super(
      `Invalid environment variables: ${
        variables.length > 0 ? variables.join(", ") : "unknown"
      }`,
    );
    this.name = "ScraperEnvValidationError";
    this.issues = validationIssues;
    this.variables = variables;
  }
}

/**
 * Environment schema shared by the HTTP server and job commands.
 */
const scraperServerSchema = {
  BUNNY_IMAGE_FOLDER_PREFIX: z
    .string()
    .regex(/^images(?:\/(?:dev|preview(?:\/pr-[1-9]\d*)?))?$/u),
  APP_ENV: z.string().min(1).optional(),
  AXIOM_DATASET: z.string().min(1).optional(),
  AXIOM_EDGE_DOMAIN: z.string().min(1).optional(),
  AXIOM_TOKEN: z.string().min(1).optional(),
  LOGGER: z.string().min(1).optional(),
  LOG_DEPLOYMENT_ID: z.string().min(1).optional(),
  LOG_DEPLOYMENT_TARGET: z.string().min(1).optional(),
  LOG_LEVEL: z.string().min(1).optional(),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4007),
  RAILWAY_ENVIRONMENT_NAME: z.string().min(1).optional(),
  SCRAPER_SCHEDULER_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
} as const;

/**
 * Required Redis or TLS Redis URL schema.
 */
const redisUrlSchema = z
  .string()
  .min(1)
  .url()
  .refine((value) => isRedisUrl(value), {
    message: "Invalid Redis URL",
  });

/**
 * Validates environment values required by the scraper HTTP server.
 *
 * @param runtimeEnv - Unvalidated process environment values.
 * @returns Coerced server configuration with defaults applied.
 * @throws {ScraperEnvValidationError} When one or more environment values are invalid.
 */
export function createScraperEnv(runtimeEnv: ScraperRuntimeEnv) {
  return createEnv({
    emptyStringAsUndefined: true,
    isServer: true,
    /**
     * Converts schema failures into the scraper-specific validation error.
     *
     * @param issues - Standard-schema validation issues.
     * @throws {ScraperEnvValidationError} Always, with formatted variable details.
     */
    onValidationError(issues) {
      throw new ScraperEnvValidationError(issues);
    },
    runtimeEnvStrict: getScraperRuntimeEnvStrict(runtimeEnv),
    server: scraperServerSchema,
  });
}

/**
 * Validates the complete environment required by scraper jobs.
 *
 * @param runtimeEnv - Unvalidated process environment values.
 * @returns Coerced job configuration with bounded scheduling defaults.
 * @throws {ScraperEnvValidationError} When one or more environment values are invalid.
 */
export function createScraperJobEnv(runtimeEnv: ScraperRuntimeEnv) {
  return createEnv({
    emptyStringAsUndefined: true,
    isServer: true,
    /**
     * Converts schema failures into the scraper-specific validation error.
     *
     * @param issues - Standard-schema validation issues.
     * @throws {ScraperEnvValidationError} Always, with formatted variable details.
     */
    onValidationError(issues) {
      throw new ScraperEnvValidationError(issues);
    },
    runtimeEnvStrict: getScraperRuntimeEnvStrict(runtimeEnv),
    server: {
      ...scraperServerSchema,
      BUNNY_STORAGE_ACCESS_KEY: z.string().min(1).optional(),
      BUNNY_STORAGE_ENDPOINT: z.string().min(1).url().optional(),
      BUNNY_STORAGE_ZONE_NAME: z.string().min(1).optional(),
      DATABASE_URL: z.string().min(1).url(),
      BUNNY_CDN_BASE_URL: z.string().min(1).url().optional(),
      IMAGE_STORAGE_PROVIDER: z.string().min(1).default("bunny"),
      REDIS_URL: redisUrlSchema,
      GRIMSMO_PROXY_URL: z.string().min(1).url().optional(),
      SCRAPER_AUTMOG_INTERVAL_MINUTES: z.coerce
        .number()
        .int()
        .min(1)
        .max(24 * 60)
        .default(60),
      SCRAPER_AUTMOG_START_DELAY_SECONDS: z.coerce
        .number()
        .int()
        .min(0)
        .max(60 * 60)
        .default(0),
      SCRAPER_DRY_RUN: z
        .enum(["true", "false"])
        .optional()
        .transform((value) => value === "true"),
      SCRAPER_GRIMSMO_FJELL_START_DELAY_SECONDS: z.coerce
        .number()
        .int()
        .min(0)
        .max(60 * 60)
        .default(30 * 60),
      SCRAPER_GRIMSMO_INTERVAL_MINUTES: z.coerce
        .number()
        .int()
        .min(1)
        .max(24 * 60)
        .default(60),
      SCRAPER_GRIMSMO_NORSEMAN_START_DELAY_SECONDS: z.coerce
        .number()
        .int()
        .min(0)
        .max(60 * 60)
        .default(45 * 60),
      SCRAPER_GRIMSMO_RASK_START_DELAY_SECONDS: z.coerce
        .number()
        .int()
        .min(0)
        .max(60 * 60)
        .default(15 * 60),
      SCRAPER_GRIMSMO_SAGA_START_DELAY_SECONDS: z.coerce
        .number()
        .int()
        .min(0)
        .max(60 * 60)
        .default(0),
      SCRAPER_IMAGE_BATCH_SIZE: z.coerce
        .number()
        .int()
        .min(1)
        .max(500)
        .default(25),
      SCRAPER_ITEM_BATCH_SIZE: z.coerce
        .number()
        .int()
        .min(1)
        .max(1_000)
        .default(100),
      SCRAPER_QUEUE_PROCESSOR_INTERVAL_MINUTES: z.coerce
        .number()
        .int()
        .min(1)
        .max(24 * 60)
        .default(15),
      SCRAPER_QUEUE_PROCESSOR_START_DELAY_SECONDS: z.coerce
        .number()
        .int()
        .min(0)
        .max(60 * 60)
        .default(30),
      SCRAPER_QUEUE_CONCURRENCY: z.coerce
        .number()
        .int()
        .min(1)
        .max(20)
        .default(3),
      SCRAPER_CRON_ENABLED: z
        .enum(["true", "false"])
        .optional()
        .transform((value) =>
          value === undefined ? undefined : value === "true",
        ),
    },
  });
}

/**
 * Maps supported runtime inputs to the exact environment schema keys.
 *
 * @param runtimeEnv - Unvalidated process environment values.
 * @returns Strict runtime values, with the preferred valid Redis URL selected.
 */
function getScraperRuntimeEnvStrict(runtimeEnv: ScraperRuntimeEnv) {
  return {
    APP_ENV: runtimeEnv.APP_ENV,
    AXIOM_DATASET: runtimeEnv.AXIOM_DATASET,
    AXIOM_EDGE_DOMAIN: runtimeEnv.AXIOM_EDGE_DOMAIN,
    AXIOM_TOKEN: runtimeEnv.AXIOM_TOKEN,
    BUNNY_STORAGE_ACCESS_KEY: runtimeEnv.BUNNY_STORAGE_ACCESS_KEY,
    BUNNY_STORAGE_ENDPOINT: runtimeEnv.BUNNY_STORAGE_ENDPOINT,
    BUNNY_STORAGE_ZONE_NAME: runtimeEnv.BUNNY_STORAGE_ZONE_NAME,
    DATABASE_URL: runtimeEnv.DATABASE_URL,
    BUNNY_CDN_BASE_URL: runtimeEnv.BUNNY_CDN_BASE_URL,
    BUNNY_IMAGE_FOLDER_PREFIX: runtimeEnv.BUNNY_IMAGE_FOLDER_PREFIX,
    IMAGE_STORAGE_PROVIDER: runtimeEnv.IMAGE_STORAGE_PROVIDER,
    GRIMSMO_PROXY_URL: runtimeEnv.GRIMSMO_PROXY_URL,
    LOGGER: runtimeEnv.LOGGER,
    LOG_DEPLOYMENT_ID: runtimeEnv.LOG_DEPLOYMENT_ID,
    LOG_DEPLOYMENT_TARGET: runtimeEnv.LOG_DEPLOYMENT_TARGET,
    LOG_LEVEL: runtimeEnv.LOG_LEVEL,
    PORT: runtimeEnv.PORT,
    RAILWAY_ENVIRONMENT_NAME: runtimeEnv.RAILWAY_ENVIRONMENT_NAME,
    REDIS_URL: selectRedisUrl(runtimeEnv),
    SCRAPER_AUTMOG_INTERVAL_MINUTES: runtimeEnv.SCRAPER_AUTMOG_INTERVAL_MINUTES,
    SCRAPER_AUTMOG_START_DELAY_SECONDS:
      runtimeEnv.SCRAPER_AUTMOG_START_DELAY_SECONDS,
    SCRAPER_DRY_RUN: runtimeEnv.SCRAPER_DRY_RUN,
    SCRAPER_GRIMSMO_FJELL_START_DELAY_SECONDS:
      runtimeEnv.SCRAPER_GRIMSMO_FJELL_START_DELAY_SECONDS,
    SCRAPER_GRIMSMO_INTERVAL_MINUTES:
      runtimeEnv.SCRAPER_GRIMSMO_INTERVAL_MINUTES,
    SCRAPER_GRIMSMO_NORSEMAN_START_DELAY_SECONDS:
      runtimeEnv.SCRAPER_GRIMSMO_NORSEMAN_START_DELAY_SECONDS,
    SCRAPER_GRIMSMO_RASK_START_DELAY_SECONDS:
      runtimeEnv.SCRAPER_GRIMSMO_RASK_START_DELAY_SECONDS,
    SCRAPER_GRIMSMO_SAGA_START_DELAY_SECONDS:
      runtimeEnv.SCRAPER_GRIMSMO_SAGA_START_DELAY_SECONDS,
    SCRAPER_IMAGE_BATCH_SIZE: runtimeEnv.SCRAPER_IMAGE_BATCH_SIZE,
    SCRAPER_ITEM_BATCH_SIZE: runtimeEnv.SCRAPER_ITEM_BATCH_SIZE,
    SCRAPER_QUEUE_PROCESSOR_INTERVAL_MINUTES:
      runtimeEnv.SCRAPER_QUEUE_PROCESSOR_INTERVAL_MINUTES,
    SCRAPER_QUEUE_PROCESSOR_START_DELAY_SECONDS:
      runtimeEnv.SCRAPER_QUEUE_PROCESSOR_START_DELAY_SECONDS,
    SCRAPER_QUEUE_CONCURRENCY: runtimeEnv.SCRAPER_QUEUE_CONCURRENCY,
    SCRAPER_CRON_ENABLED: runtimeEnv.SCRAPER_CRON_ENABLED,
    SCRAPER_SCHEDULER_ENABLED: runtimeEnv.SCRAPER_SCHEDULER_ENABLED,
  };
}

/**
 * Selects a valid Redis URL while supporting Railway's legacy variable name.
 *
 * @param runtimeEnv - Runtime environment containing preferred and legacy Redis values.
 * @returns The first valid URL, or the first supplied invalid value for schema reporting.
 */
function selectRedisUrl(runtimeEnv: ScraperRuntimeEnv): string | undefined {
  if (runtimeEnv.REDIS_URL && isRedisUrl(runtimeEnv.REDIS_URL)) {
    return runtimeEnv.REDIS_URL;
  }

  if (runtimeEnv.REDIS && isRedisUrl(runtimeEnv.REDIS)) {
    return runtimeEnv.REDIS;
  }

  return runtimeEnv.REDIS_URL ?? runtimeEnv.REDIS;
}

/**
 * Checks whether a string is a Redis or TLS Redis URL.
 *
 * @param value - Candidate URL.
 * @returns Whether the value parses with a `redis:` or `rediss:` protocol.
 */
function isRedisUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "redis:" || url.protocol === "rediss:";
  } catch {
    return false;
  }
}

/**
 * Converts a standard-schema issue to the scraper's public issue shape.
 *
 * @param issue - Standard-schema validation issue.
 * @returns The issue message and owning environment variable.
 */
function formatValidationIssue(
  issue: StandardSchemaV1.Issue,
): ScraperEnvValidationIssue {
  return {
    message: issue.message,
    variable: getIssueVariable(issue),
  };
}

/**
 * Extracts an environment variable name from a validation issue path.
 *
 * @param issue - Standard-schema validation issue.
 * @returns The first path key, or `"unknown"` when no key exists.
 */
function getIssueVariable(issue: StandardSchemaV1.Issue): string {
  const [firstPathSegment] = issue.path ?? [];

  if (firstPathSegment === undefined) {
    return "unknown";
  }

  if (
    typeof firstPathSegment === "object" &&
    firstPathSegment !== null &&
    "key" in firstPathSegment
  ) {
    return String(firstPathSegment.key);
  }

  return String(firstPathSegment);
}
