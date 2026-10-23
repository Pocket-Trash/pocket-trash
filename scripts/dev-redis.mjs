import { createRequire } from "node:module";
import { setTimeout } from "node:timers/promises";
import {
  ensureScraperRedisContainer,
  getScraperRedisUrl,
  printScriptError,
  runCommand,
} from "./scraper-redis.mjs";

/** Reuses the scraper's installed Redis client without adding a root dependency. */
const Redis = createRequire(
  new URL("../apps/scraper/package.json", import.meta.url),
)("ioredis");

/** Validates development-only Redis selection before starting any application. */
try {
  if (
    [
      process.env.APP_ENV,
      process.env.NODE_ENV,
      process.env.RAILWAY_ENVIRONMENT_NAME,
    ].some((value) => ["prod", "production"].includes(value))
  ) {
    throw new Error("Local development refuses a production environment.");
  }
  const redisUrl = getScraperRedisUrl({
    ...process.env,
    REDIS_URL: process.env.POCKET_TRASH_DEV_REDIS_URL ?? process.env.REDIS_URL,
  });
  let url;
  try {
    url = new URL(redisUrl);
    if (
      !["redis:", "rediss:"].includes(url.protocol) ||
      !url.hostname ||
      url.hostname.endsWith(".railway.internal")
    )
      throw new Error();
  } catch {
    throw new Error(
      "REDIS_URL must be a reachable development redis:// or rediss:// URL, not a Railway reference or private hostname.",
    );
  }
  if (!process.env.POCKET_TRASH_DEV_REDIS_URL && !process.env.REDIS_URL) {
    await ensureScraperRedisContainer();
  }
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    connectTimeout: 1000,
    commandTimeout: 1000,
    maxRetriesPerRequest: 0,
    /**
     * Disables automatic retries so the bounded readiness loop controls startup.
     * @returns Null to stop automatic reconnection.
     */
    retryStrategy: () => null,
  });
  redis.on("error", () => {});
  try {
    let ready = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        await redis.connect();
        ready = (await redis.ping()) === "PONG";
        if (ready) break;
      } catch {
        redis.disconnect();
      }
      await setTimeout(250);
    }
    if (!ready)
      throw new Error(
        "Development Redis is not ready. Start Docker/OrbStack or check the explicit REDIS_URL; credentials are not displayed.",
      );
  } finally {
    redis.disconnect();
  }
  const [command, ...args] = process.argv.slice(2);
  if (!command) throw new Error("Expected a development command.");
  const env = { ...process.env, REDIS_URL: redisUrl };
  delete env.POCKET_TRASH_DEV_REDIS_URL;
  await runCommand(command, args, env);
} catch (error) {
  printScriptError(error);
  process.exitCode = 1;
}
