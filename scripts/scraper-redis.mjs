import { spawn } from "node:child_process";

/** Stable Docker container name for the local scraper Redis instance. */
export const scraperRedisContainerName = "pocket-trash-scraper-redis";

/**
 * Resolves the expected local scraper Redis port.
 *
 * @param env - Environment variables that may override the default port.
 * @returns The configured port or `4008`.
 */
export function getScraperRedisPort(env = process.env) {
  return env.SCRAPER_REDIS_PORT ?? "4008";
}

/**
 * Resolves the scraper Redis connection URL.
 *
 * @param env - Environment variables that may provide a URL or port.
 * @returns The configured URL or a localhost URL using the scraper port.
 */
export function getScraperRedisUrl(env = process.env) {
  return env.REDIS_URL ?? `redis://localhost:${getScraperRedisPort(env)}`;
}

/**
 * Creates or starts the local scraper Redis container and validates its port.
 *
 * @param options - Container startup options.
 * @param options.env - Environment variables used to resolve defaults.
 * @param options.redisPort - Expected host port for Redis.
 * @returns A promise that settles when the container is ready.
 * @rejects When Docker fails or the existing container uses another port.
 */
export async function ensureScraperRedisContainer({
  env = process.env,
  redisPort = getScraperRedisPort(env),
} = {}) {
  const existing = await capture("docker", [
    "ps",
    "-a",
    "--filter",
    `name=^/${scraperRedisContainerName}$`,
    "--format",
    "{{.Names}} {{.Status}}",
  ]);

  if (!existing.trim()) {
    await runCommand("docker", [
      "run",
      "--name",
      scraperRedisContainerName,
      "-p",
      `${redisPort}:6379`,
      "-d",
      "redis:8.2.1",
    ]);
    return;
  }

  if (!existing.includes("Up ")) {
    await runCommand("docker", ["start", scraperRedisContainerName]);
  }

  await assertScraperRedisPort(redisPort);
}

/**
 * Runs a command with inherited terminal I/O.
 *
 * @param command - Executable name or path.
 * @param args - Command arguments.
 * @param env - Environment passed to the child process.
 * @returns A promise that resolves after a successful exit.
 * @rejects When the process cannot start or exits unsuccessfully.
 */
export function runCommand(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with ${code ?? "null"}`));
    });
  });
}

/**
 * Writes a caught script failure to standard error.
 *
 * @param error - The caught failure value.
 */
export function printScriptError(error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
}

/**
 * Runs a command and captures its standard output.
 *
 * @param command - Executable name or path.
 * @param args - Command arguments.
 * @returns A promise for captured standard output.
 * @rejects When the process cannot start or exits unsuccessfully.
 */
function capture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr || `${command} exited with ${code ?? "null"}`));
    });
  });
}

/**
 * Verifies that the scraper Redis container exposes the expected host port.
 *
 * @param expectedPort - Required host port.
 * @returns A promise that resolves when the mapping matches.
 * @rejects When Docker fails or the mapping differs.
 */
async function assertScraperRedisPort(expectedPort) {
  const portOutput = await capture("docker", [
    "port",
    scraperRedisContainerName,
    "6379/tcp",
  ]);
  const hostPorts = getHostPorts(portOutput);

  if (hostPorts.includes(expectedPort)) {
    return;
  }

  throw new Error(
    [
      `Existing Docker container "${scraperRedisContainerName}" is mapped to host port ${hostPorts.join(", ") || "unknown"}, but the scraper expects ${expectedPort}.`,
      "Docker cannot change port mappings on an existing container.",
      "",
      "To recreate the local scraper Redis container on the expected port, run:",
      `  docker rm -f ${scraperRedisContainerName}`,
      "  pnpm dev:scraper",
      "",
      "To keep using the existing container, run scraper commands with matching env:",
      `  SCRAPER_REDIS_PORT=${hostPorts[0] ?? "6379"} REDIS_URL=redis://localhost:${hostPorts[0] ?? "6379"} pnpm scraper:scrape -- autmog`,
    ].join("\n"),
  );
}

/**
 * Extracts unique host ports from `docker port` output.
 *
 * @param portOutput - Docker port mapping output.
 * @returns Host port strings in encounter order.
 */
function getHostPorts(portOutput) {
  return [
    ...new Set(
      portOutput
        .trim()
        .split("\n")
        .map((line) => line.match(/:(\d+)$/)?.[1])
        .filter(Boolean),
    ),
  ];
}
