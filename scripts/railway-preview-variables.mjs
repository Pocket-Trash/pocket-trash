import { execFileSync } from "node:child_process";
import { resolveRailwayContext } from "../.railway/context.ts";

/** Shared cooldown budget for this preview's idempotent configuration calls. */
const retryDeadline = Date.now() + 60 * 60_000;

/**
 * Runs Railway with secret-bearing variables on stdin and quota-aware retries.
 * @param {string[]} args - Public Railway command arguments.
 * @param {object} [variables] - GraphQL variables supplied through stdin.
 * @returns {string} Captured JSON output.
 * @throws {Error} For non-quota errors or an exhausted retry budget, without provider output.
 */
function runRailway(args, variables) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const output = execFileSync("pnpm", ["exec", "railway", ...args], {
        encoding: "utf8",
        input: variables ? JSON.stringify(variables) : "",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 30_000,
      });
      const result = JSON.parse(output);
      if (result.errors)
        throw new Error("Railway GraphQL request failed", {
          cause: JSON.stringify(result.errors),
        });
      return output;
    } catch (error) {
      const diagnostic = `${error.stderr ?? ""} ${error.stdout ?? ""} ${error.cause ?? ""}`;
      const quota = /ratelimit|rate limit/i.test(diagnostic);
      const minutes = diagnostic.match(
        /try again in about (\d+) minutes?/i,
      )?.[1];
      const delay =
        minutes === undefined ? 60_000 : Number(minutes) * 60_000 + 1_000;
      if (!quota || attempt === 2 || Date.now() + delay > retryDeadline) {
        throw new Error(
          "Railway preview configuration failed; provider output withheld.",
          { cause: error },
        );
      }
      process.stdout.write(
        `Railway quota reached; retrying preview configuration in ${Math.ceil(delay / 1000)} seconds.\n`,
      );
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
    }
  }
}

/**
 * Batches preview-only variables, skips unchanged values and verifies persisted settings.
 * @throws {Error} When scope, required inputs or readback cannot be verified.
 */
function configurePreview() {
  const {
    RAILWAY_PROJECT_ID: projectId,
    PR_NUMBER: pr,
    DATABASE_URL: databaseUrl,
    FONTAWESOME_PACKAGE_TOKEN: token,
    ISOLATED: isolated,
    DB_CHANGING: databaseChanging,
  } = process.env;
  if (
    !projectId ||
    !/^[1-9]\d*$/.test(pr ?? "") ||
    !databaseUrl ||
    !token ||
    !["true", "false"].includes(isolated) ||
    !["true", "false"].includes(databaseChanging)
  ) {
    throw new Error(
      "Preview configuration requires an explicit project, PR, database, token and boolean isolation settings.",
    );
  }
  const environment = `pocket-trash-pr-${pr}`;
  const scraper = resolveRailwayContext(
    projectId,
    environment,
    "pocket-trash (preview)",
    runRailway,
  );
  const queue = resolveRailwayContext(
    projectId,
    environment,
    "pocket-trash-queue",
    runRailway,
  );
  if (
    scraper.environmentName !== environment ||
    queue.environmentName !== environment ||
    scraper.environmentId !== queue.environmentId
  ) {
    throw new Error(
      "Railway resolved a different preview environment; refusing changes.",
    );
  }
  const logging = {
    LOG_DEPLOYMENT_ID: environment,
    LOG_DEPLOYMENT_TARGET: "railway",
  };
  const desired = {
    scraper: {
      ...logging,
      DATABASE_URL: databaseUrl,
      FONTAWESOME_PACKAGE_TOKEN: token,
      RAILPACK_INSTALL_CMD:
        "./scripts/pnpm-install.sh --frozen-lockfile --prefer-offline",
      BUNNY_IMAGE_FOLDER_PREFIX:
        isolated === "true" ? `images/preview/pr-${pr}` : "images/preview",
      REDIS_URL: "${{pocket-trash-queue.REDIS_PUBLIC_URL}}",
      SCRAPER_CRON_ENABLED: databaseChanging,
    },
    queue: logging,
  };
  const ids = {
    projectId,
    environmentId: scraper.environmentId,
    scraperId: scraper.serviceId,
    queueId: queue.serviceId,
  };
  /**
   * Reads both services once, preserving Railway references for exact comparison.
   * @returns {object} Environment-local variables with unrendered references.
   */
  const read = () =>
    JSON.parse(
      runRailway(
        [
          "api",
          "query($projectId:String!,$environmentId:String!,$scraperId:String!,$queueId:String!){scraper:variables(projectId:$projectId,environmentId:$environmentId,serviceId:$scraperId,unrendered:true) queue:variables(projectId:$projectId,environmentId:$environmentId,serviceId:$queueId,unrendered:true)}",
          "--variables",
          "@-",
          "--compact",
        ],
        ids,
      ),
    ).data;
  /**
   * Compares only variables owned by this workflow without exposing their values.
   * @param {object} actual - Provider readback.
   * @returns {boolean} Whether all intended variables were persisted.
   */
  const matches = (actual) =>
    Object.entries(desired).every(([service, variables]) =>
      Object.entries(variables).every(
        ([key, value]) => actual?.[service]?.[key] === value,
      ),
    );
  if (!matches(read())) {
    const inputs = Object.fromEntries(
      Object.entries(desired).map(([service, variables]) => [
        service,
        {
          projectId,
          environmentId: ids.environmentId,
          serviceId: ids[`${service}Id`],
          variables,
          replace: false,
          skipDeploys: true,
        },
      ]),
    );
    const result = JSON.parse(
      runRailway(
        [
          "api",
          "mutation($scraper:VariableCollectionUpsertInput!,$queue:VariableCollectionUpsertInput!){scraper:variableCollectionUpsert(input:$scraper) queue:variableCollectionUpsert(input:$queue)}",
          "--variables",
          "@-",
          "--compact",
        ],
        inputs,
      ),
    );
    if (
      result.data?.scraper !== true ||
      result.data?.queue !== true ||
      !matches(read())
    ) {
      throw new Error(
        "Railway preview variable verification failed; values withheld.",
      );
    }
  }
  process.stdout.write(
    `${JSON.stringify({ app: "ci", environment: "github-actions", level: "info", message: "ci.railway.preview.imageFolderPrefix.selected", timestamp: new Date().toISOString(), attributes: { databaseChanged: databaseChanging === "true", railwayEnvironment: environment, service: "pocket-trash (preview)", imageFolderPrefix: desired.scraper.BUNNY_IMAGE_FOLDER_PREFIX, scraperCronEnabled: databaseChanging } })}\n`,
  );
}

try {
  configurePreview();
} catch {
  process.stderr.write(
    "Railway preview configuration failed; scope or provider response could not be verified. Values withheld.\n",
  );
  process.exitCode = 1;
}
