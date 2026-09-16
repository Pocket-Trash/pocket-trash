import { createEnv, type StandardSchemaV1 } from "@t3-oss/env-core";
import { z } from "zod";

export type ScraperRuntimeEnv = {
  APP_ENV?: string;
  AXIOM_DATASET?: string;
  AXIOM_EDGE_DOMAIN?: string;
  AXIOM_TOKEN?: string;
  BUNNY_STORAGE_ACCESS_KEY?: string;
  BUNNY_STORAGE_ENDPOINT?: string;
  BUNNY_STORAGE_ZONE_NAME?: string;
  DATABASE_URL?: string;
  IMAGE_CDN_BASE_URL?: string;
  IMAGE_FOLDER_PREFIX?: string;
  IMAGE_STORAGE_PROVIDER?: string;
  LOGGER?: string;
  LOG_DEPLOYMENT_ID?: string;
  LOG_DEPLOYMENT_TARGET?: string;
  LOG_LEVEL?: string;
  PORT?: string;
  RAILWAY_ENVIRONMENT_NAME?: string;
  REDIS?: string;
  REDIS_URL?: string;
  SCRAPER_AUTMOG_INTERVAL_MINUTES?: string;
  SCRAPER_AUTMOG_START_DELAY_SECONDS?: string;
  SCRAPER_DRY_RUN?: string;
  GRIMSMO_PROXY_URL?: string;
  SCRAPER_GRIMSMO_FJELL_START_DELAY_SECONDS?: string;
  SCRAPER_GRIMSMO_INTERVAL_MINUTES?: string;
  SCRAPER_GRIMSMO_NORSEMAN_START_DELAY_SECONDS?: string;
  SCRAPER_GRIMSMO_RASK_START_DELAY_SECONDS?: string;
  SCRAPER_GRIMSMO_SAGA_START_DELAY_SECONDS?: string;
  SCRAPER_IMAGE_BATCH_SIZE?: string;
  SCRAPER_ITEM_BATCH_SIZE?: string;
  SCRAPER_QUEUE_PROCESSOR_INTERVAL_MINUTES?: string;
  SCRAPER_QUEUE_PROCESSOR_START_DELAY_SECONDS?: string;
  SCRAPER_QUEUE_CONCURRENCY?: string;
  SCRAPER_CRON_ENABLED?: string;
  SCRAPER_SCHEDULER_ENABLED?: string;
};

export type ScraperEnvValidationIssue = {
  message: string;
  variable: string;
};

export class ScraperEnvValidationError extends Error {
  readonly issues: readonly ScraperEnvValidationIssue[];
  readonly variables: readonly string[];

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

const scraperServerSchema = {
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

const redisUrlSchema = z
  .string()
  .min(1)
  .url()
  .refine((value) => isRedisUrl(value), {
    message: "Invalid Redis URL",
  });

export function createScraperEnv(runtimeEnv: ScraperRuntimeEnv) {
  return createEnv({
    emptyStringAsUndefined: true,
    isServer: true,
    onValidationError(issues) {
      throw new ScraperEnvValidationError(issues);
    },
    runtimeEnvStrict: getScraperRuntimeEnvStrict(runtimeEnv),
    server: scraperServerSchema,
  });
}

export function createScraperJobEnv(runtimeEnv: ScraperRuntimeEnv) {
  return createEnv({
    emptyStringAsUndefined: true,
    isServer: true,
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
      IMAGE_CDN_BASE_URL: z.string().min(1).url().optional(),
      IMAGE_FOLDER_PREFIX: z.string().min(1).optional(),
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
    IMAGE_CDN_BASE_URL: runtimeEnv.IMAGE_CDN_BASE_URL,
    IMAGE_FOLDER_PREFIX: runtimeEnv.IMAGE_FOLDER_PREFIX,
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

function selectRedisUrl(runtimeEnv: ScraperRuntimeEnv): string | undefined {
  if (runtimeEnv.REDIS_URL && isRedisUrl(runtimeEnv.REDIS_URL)) {
    return runtimeEnv.REDIS_URL;
  }

  if (runtimeEnv.REDIS && isRedisUrl(runtimeEnv.REDIS)) {
    return runtimeEnv.REDIS;
  }

  return runtimeEnv.REDIS_URL ?? runtimeEnv.REDIS;
}

function isRedisUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "redis:" || url.protocol === "rediss:";
  } catch {
    return false;
  }
}

function formatValidationIssue(
  issue: StandardSchemaV1.Issue,
): ScraperEnvValidationIssue {
  return {
    message: issue.message,
    variable: getIssueVariable(issue),
  };
}

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
