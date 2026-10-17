import { z } from "zod";

/** Discord snowflake represented as an unsigned decimal string. */
const snowflakeSchema = z.string().regex(/^[1-9]\d{16,19}$/u);

/** Redis connection URL accepted by the queue adapter. */
const redisUrlSchema = z
  .url()
  .refine(
    (value) => value.startsWith("redis://") || value.startsWith("rediss://"),
  );

/** Validated Discord bot process configuration. */
const discordBotEnvSchema = z.object({
  APP_ENV: z.string().min(1).default("development"),
  AXIOM_DATASET: z.string().min(1).optional(),
  AXIOM_EDGE_DOMAIN: z.string().min(1).optional(),
  AXIOM_TOKEN: z.string().min(1).optional(),
  DISCORD_APPLICATION_ID: snowflakeSchema,
  DISCORD_GUILD_ID: snowflakeSchema,
  DISCORD_MODERATOR_ROLE_ID: snowflakeSchema,
  DISCORD_OWNER_ROLE_ID: snowflakeSchema,
  DISCORD_TOKEN: z.string().min(1),
  LOGGER: z.string().min(1).optional(),
  LINEAR_API_KEY: z.string().min(1),
  LOG_DEPLOYMENT_ID: z.string().min(1).optional(),
  LOG_DEPLOYMENT_TARGET: z.string().min(1).optional(),
  LOG_LEVEL: z.string().min(1).optional(),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4009),
  RAILWAY_ENVIRONMENT_NAME: z.string().min(1).optional(),
  REDIS_URL: redisUrlSchema,
});

/** Unvalidated environment values consumed by the Discord bot. */
export type DiscordBotRuntimeEnv = Partial<
  Record<keyof z.input<typeof discordBotEnvSchema>, string | undefined>
>;

/**
 * Validates required bot secrets, IDs, and runtime values.
 *
 * @param runtimeEnv - Untrusted process environment values.
 * @returns Validated Discord bot configuration.
 * @throws When a required value is missing or malformed.
 */
export function createDiscordBotEnv(runtimeEnv: DiscordBotRuntimeEnv) {
  const result = discordBotEnvSchema.safeParse(runtimeEnv);
  if (result.success) return result.data;

  const variables = [
    ...new Set(
      result.error.issues.map((issue) => String(issue.path[0] ?? "unknown")),
    ),
  ];
  throw new Error(`Invalid environment variables: ${variables.join(", ")}`);
}
