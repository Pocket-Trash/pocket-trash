import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { resolveRailwayContext } from "../.railway/context.ts";

/** Environment-local queue managed by the preview workflow. */
const queueName = "pocket-trash-queue";

/**
 * Runs Railway without echoing secret-bearing output or subprocess errors.
 * @param {string[]} args - Railway CLI arguments.
 * @returns {string} Captured CLI output.
 * @throws {Error} When Railway fails, without exposing subprocess output.
 */
function runRailway(args) {
  try {
    return execFileSync("pnpm", ["exec", "railway", ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
    });
  } catch {
    throw new Error("Railway preview queue operation failed; output withheld.");
  }
}

/**
 * Checks Redis using the queue package's existing Redis dependency.
 * @param {string} redisUrl - Authenticated public Redis endpoint.
 * @returns {boolean} Whether an authenticated ping succeeds.
 */
function pingRedis(redisUrl) {
  try {
    execFileSync(
      "pnpm",
      [
        "--filter",
        "@package/queue",
        "exec",
        "node",
        "--input-type=module",
        "--eval",
        `import { Redis } from "ioredis";
const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, connectTimeout: 2000, maxRetriesPerRequest: 0, retryStrategy: () => null });
redis.on("error", () => {});
try { await redis.connect(); if (await redis.ping() !== "PONG") process.exitCode = 1; }
catch { process.exitCode = 1; }
finally { redis.disconnect(); }`,
      ],
      {
        env: { ...process.env, REDIS_URL: redisUrl },
        stdio: "ignore",
        timeout: 5_000,
      },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Waits for bounded provisioning/readiness checks without exposing their data.
 * @param {() => boolean} check - Read-only readiness check.
 * @param {(milliseconds: number) => Promise<unknown>} pause - Polling delay.
 * @param {string} message - Safe timeout diagnostic.
 * @param {number} [attempts] - Maximum readiness checks, including CLI latency.
 * @returns {Promise<void>} Readiness completion.
 * @rejects {Error} When the check fails or readiness times out.
 */
async function waitUntil(check, pause, message, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (check()) return;
    await pause(1_000);
  }
  throw new Error(message);
}

/**
 * Activates skipped PR Redis storage and verifies the queue after redeployment.
 * @param {object} options - Explicit preview scope and command seams.
 * @param {string} options.projectId - Railway project ID from CI secrets.
 * @param {string} options.environment - Native PR environment name.
 * @param {(args: string[]) => string} [options.run] - Railway command runner.
 * @param {(url: string) => boolean} [options.ping] - Authenticated Redis probe.
 * @param {(milliseconds: number) => Promise<unknown>} [options.pause] - Poll delay.
 * @returns {Promise<void>} Healthy persistent preview queue.
 * @rejects {Error} When scope, activation, storage or readiness verification fails.
 */
export async function prepareRailwayPreviewQueue({
  projectId,
  environment,
  run = runRailway,
  ping = pingRedis,
  pause = setTimeout,
}) {
  if (!projectId || !/^pocket-trash-pr-[1-9]\d*$/.test(environment)) {
    throw new Error(
      "Queue provisioning requires an explicit project and native PR environment.",
    );
  }
  const scope = [
    "--project",
    projectId,
    "--environment",
    environment,
    "--service",
    queueName,
  ];
  const context = resolveRailwayContext(projectId, environment, queueName, run);
  if (
    context.projectId !== projectId ||
    context.environmentName !== environment ||
    context.serviceName !== queueName ||
    !context.serviceId ||
    !context.environmentId
  ) {
    throw new Error(
      "Railway resolved a different preview scope; refusing changes.",
    );
  }
  const metadata = JSON.parse(
    run([
      "api",
      "query($projectId:String!,$environmentId:String!){environment(id:$environmentId,projectId:$projectId){id name isEphemeral meta{skippedResourceIds}}}",
      "--variables",
      JSON.stringify({ projectId, environmentId: context.environmentId }),
      "--compact",
    ]),
  );
  const preview = metadata.data?.environment;
  if (
    metadata.errors ||
    preview?.id !== context.environmentId ||
    preview?.name !== environment ||
    preview?.isEphemeral !== true
  )
    throw new Error(
      "Queue activation requires a verified ephemeral PR environment.",
    );
  const skipped = preview.meta?.skippedResourceIds;
  const skippedMount = Object.values(skipped?.volumes ?? {}).find(
    (volume) => volume.serviceId === context.serviceId,
  );
  const skippedService = skipped?.services?.includes(context.serviceId);
  /**
   * Reads only this project's resolved environment configuration.
   * @returns {object | undefined} Environment configuration without account listings.
   */
  const readConfig = () =>
    JSON.parse(
      run([
        "api",
        "query QueueConfig($projectId:String!,$environmentId:String!){environment(id:$environmentId,projectId:$projectId){config}}",
        "--variables",
        JSON.stringify({ projectId, environmentId: context.environmentId }),
        "--compact",
      ]),
    ).data?.environment?.config;
  const queue = readConfig()?.services?.[context.serviceId];
  const mountPath =
    queue?.deploy?.requiredMountPath ?? skippedMount?.mountPath ?? "/data";
  if (
    (!skippedService && !/^redis:/.test(queue?.source?.image ?? "")) ||
    !["/data", "/bitnami"].includes(mountPath)
  ) {
    throw new Error(
      "Preview queue image or required mount does not match the managed Redis contract.",
    );
  }
  /**
   * Reads only volumes attached to this preview's queue.
   * @returns {Array<object>} Attached volume metadata.
   */
  const volumes = () =>
    JSON.parse(run(["volume", ...scope, "list", "--json"])).volumes.filter(
      (volume) => volume.serviceName === queueName,
    );
  const existing = volumes();
  if (
    existing.length > 1 ||
    existing.some(
      (volume) =>
        volume.mountPath !== mountPath ||
        volume.deletedAt ||
        volume.isPendingDeletion,
    )
  ) {
    throw new Error(
      "Preview queue has unexpected storage; refusing to replace or detach it.",
    );
  }
  if (existing.length === 0) {
    if (!skippedService)
      throw new Error(
        "Preview queue has no skipped service to activate; refusing to create a replacement volume.",
      );
    const result = JSON.parse(
      run([
        "api",
        "mutation($environmentId:String!,$serviceId:String!){environmentUnskipService(environmentId:$environmentId,serviceId:$serviceId)}",
        "--variables",
        JSON.stringify({
          environmentId: context.environmentId,
          serviceId: context.serviceId,
        }),
        "--compact",
      ]),
    );
    if (result.errors || result.data?.environmentUnskipService !== true)
      throw new Error("Preview queue activation failed.");
  }
  await waitUntil(
    () => {
      const attached = volumes();
      return (
        attached.length === 1 &&
        attached[0].mountPath === mountPath &&
        attached[0].status === "Ready" &&
        !attached[0].isPendingDeletion
      );
    },
    pause,
    "Preview queue volume did not become ready.",
  );
  if (skippedService) {
    const activated = readConfig();
    if (
      !/^redis:/.test(
        activated.services?.[context.serviceId]?.source?.image ?? "",
      )
    )
      throw new Error(
        "Activated preview queue does not use the managed Redis image.",
      );
  }
  /**
   * Reads bounded deployment metadata without exposing manifests.
   * @returns {Array<object>} Most recent scoped deployments.
   */
  const deployments = () =>
    JSON.parse(run(["deployment", "list", ...scope, "--limit", "5", "--json"]));
  const previousId = deployments()[0]?.id;
  run(["service", "redeploy", ...scope, "--from-source", "--yes", "--json"]);
  let deploymentId;
  await waitUntil(
    () => {
      const current = deployments();
      if (!deploymentId && current[0]?.id !== previousId)
        deploymentId = current[0]?.id;
      const status = current.find(
        (deployment) => deployment.id === deploymentId,
      )?.status;
      if (
        [
          "FAILED",
          "CRASHED",
          "REMOVED",
          "REMOVING",
          "SKIPPED",
          "NEEDS_APPROVAL",
        ].includes(status)
      )
        throw new Error("Preview Redis deployment did not succeed.");
      return status === "SUCCESS";
    },
    pause,
    "Preview Redis deployment did not reach SUCCESS.",
    300, // Volume mounting can keep a healthy deployment pending for several minutes.
  );
  const variables = JSON.parse(run(["variable", "list", ...scope, "--json"]));
  const redisUrl = variables.REDIS_PUBLIC_URL;
  if (typeof redisUrl !== "string" || !/^rediss?:\/\//.test(redisUrl))
    throw new Error("Preview queue has no resolved public Redis URL.");
  const endpoint = new URL(redisUrl);
  if (
    !endpoint.password ||
    endpoint.hostname !== variables.RAILWAY_TCP_PROXY_DOMAIN ||
    endpoint.port !== variables.RAILWAY_TCP_PROXY_PORT
  )
    throw new Error(
      "Preview Redis URL does not resolve to this queue's authenticated TCP proxy.",
    );
  await waitUntil(
    () => ping(redisUrl),
    pause,
    "Preview Redis did not answer an authenticated ping.",
  );
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    await prepareRailwayPreviewQueue({
      projectId: process.env.RAILWAY_PROJECT_ID,
      environment: process.argv[2],
    });
    process.stdout.write(
      "Preview Redis has persistent storage and answers an authenticated ping.\n",
    );
  } catch (error) {
    process.stderr.write(
      `${error instanceof SyntaxError ? "Railway returned invalid JSON; output withheld." : error.message}\n`,
    );
    process.exitCode = 1;
  }
}
