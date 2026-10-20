import assert from "node:assert/strict";
import test from "node:test";
import { prepareRailwayPreviewQueue } from "./railway-preview-queue.mjs";

/**
 * Creates an isolated CLI simulation without real infrastructure or credentials.
 * @param {object} [options] - Simulated volume and probe state.
 * @param {boolean} [options.mounted] - Whether persistent storage already exists.
 * @param {string} [options.mountPath] - Existing mount path.
 * @param {boolean} [options.ready] - Whether storage reaches Ready.
 * @param {boolean} [options.healthy] - Whether Redis answers ping.
 * @returns {object} Invocation options and captured command calls.
 */
function fixture({
  mounted = true,
  mountPath = "/bitnami",
  ready = true,
  healthy = true,
} = {}) {
  const calls = [];
  let volumeExists = mounted;
  let deployed = false;
  return {
    calls,
    projectId: "test-project",
    environment: "pocket-trash-pr-123",
    /**
     * Returns the configured synthetic Redis readiness result.
     * @returns {boolean} Simulated PING success.
     */
    ping: () => healthy,
    /** Skips polling delays in deterministic unit tests. */
    pause: async () => {},
    /**
     * Simulates the exact CLI boundaries used by the workflow helper.
     * @param {string[]} args - CLI arguments.
     * @returns {string} Simulated JSON response.
     * @throws {Error} For commands outside the simulated workflow.
     */
    run(args) {
      calls.push(args);
      if (args[0] === "link")
        return JSON.stringify({
          projectId: "test-project",
          environmentName: "pocket-trash-pr-123",
          environmentId: "preview-id",
          serviceName: "pocket-trash-queue",
          serviceId: "queue-id",
        });
      if (args[0] === "environment")
        return JSON.stringify({
          services: volumeExists
            ? {
                "queue-id": {
                  source: { image: "redis:8.2" },
                  deploy: {
                    requiredMountPath: "/bitnami",
                    multiRegionConfig: {
                      "us-east4-eqdc4a": { numReplicas: 1 },
                    },
                  },
                },
              }
            : {},
        });
      if (args[0] === "volume")
        return JSON.stringify({
          volumes: volumeExists
            ? [
                {
                  serviceName: "pocket-trash-queue",
                  mountPath,
                  status: ready ? "Ready" : "Pending",
                  isPendingDeletion: false,
                },
              ]
            : [],
        });
      if (args[0] === "api" && args[1].includes("query"))
        return JSON.stringify({
          data: {
            environment: {
              id: "preview-id",
              name: "pocket-trash-pr-123",
              isEphemeral: true,
              meta: {
                skippedResourceIds: {
                  services: volumeExists ? [] : ["queue-id"],
                  volumes: volumeExists
                    ? {}
                    : {
                        "inherited-volume": {
                          serviceId: "queue-id",
                          mountPath: "/bitnami",
                        },
                      },
                },
              },
            },
          },
        });
      if (args[0] === "api") {
        volumeExists = true;
        return JSON.stringify({
          data: { environmentUnskipService: true },
        });
      }
      if (args[0] === "service") {
        deployed = true;
        return JSON.stringify({ success: true });
      }
      if (args[0] === "deployment")
        return JSON.stringify([
          {
            id: deployed ? "new-deployment" : "old-deployment",
            status: "SUCCESS",
          },
        ]);
      if (args[0] === "variable")
        return JSON.stringify({
          REDIS_PUBLIC_URL: "redis://default:test-only@preview.invalid:1234",
          RAILWAY_TCP_PROXY_DOMAIN: "preview.invalid",
          RAILWAY_TCP_PROXY_PORT: "1234",
        });
      throw new Error("Unexpected CLI command");
    },
  };
}

test("activates a focused PR's skipped Redis service and its inherited volume", async () => {
  const options = fixture({ mounted: false });
  await prepareRailwayPreviewQueue(options);
  const create = options.calls.find(
    (args) => args[0] === "api" && args[1].includes("mutation"),
  );
  assert.match(create[1], /environmentUnskipService/);
  assert.ok(options.calls.every((args) => !args[1]?.includes("volumeCreate")));
  const input = JSON.parse(create[create.indexOf("--variables") + 1]);
  assert.deepEqual(input, {
    environmentId: "preview-id",
    serviceId: "queue-id",
  });
  const deploy = options.calls.find((args) => args[0] === "service");
  assert.ok(deploy.includes("--from-source"));
  assert.equal(
    deploy[deploy.indexOf("--environment") + 1],
    "pocket-trash-pr-123",
  );
});

test("reuses an attached volume without creating, detaching or replacing data", async () => {
  const options = fixture();
  await prepareRailwayPreviewQueue(options);
  assert.equal(
    options.calls.filter(
      (args) => args[0] === "api" && args[1].includes("mutation"),
    ).length,
    0,
  );
  assert.ok(
    options.calls.every(
      (args) => !args.includes("delete") && !args.includes("detach"),
    ),
  );
});

test("rejects production and the preview template before running commands", async () => {
  for (const environment of [
    "production",
    "preview",
    "pocket-trash-pr-",
    "pocket-trash-pr-0",
  ]) {
    const options = fixture();
    await assert.rejects(
      prepareRailwayPreviewQueue({ ...options, environment }),
      /native PR environment/,
    );
    assert.equal(options.calls.length, 0);
  }
});

test("refuses unexpected storage rather than moving or deleting it", async () => {
  const options = fixture({ mountPath: "/other-data" });
  await assert.rejects(
    prepareRailwayPreviewQueue(options),
    /unexpected storage/,
  );
  assert.equal(
    options.calls.filter(
      (args) =>
        (args[0] === "api" && args[1].includes("mutation")) ||
        args[0] === "service",
    ).length,
    0,
  );
});

test("does not deploy before persistent storage is ready", async () => {
  const options = fixture({ ready: false });
  await assert.rejects(
    prepareRailwayPreviewQueue(options),
    /volume did not become ready/,
  );
  assert.equal(options.calls.filter((args) => args[0] === "service").length, 0);
});

test("fails when deployment is accepted but Redis never becomes healthy", async () => {
  const options = fixture({ healthy: false });
  await assert.rejects(
    prepareRailwayPreviewQueue(options),
    /authenticated ping/,
  );
});

test("rejects an endpoint from another environment", async () => {
  const options = fixture();
  const run = options.run;
  options.run = (args) =>
    args[0] === "variable"
      ? JSON.stringify({
          REDIS_PUBLIC_URL: "redis://default:test-only@production.invalid:6379",
          RAILWAY_TCP_PROXY_DOMAIN: "preview.invalid",
          RAILWAY_TCP_PROXY_PORT: "1234",
        })
      : run(args);
  await assert.rejects(
    prepareRailwayPreviewQueue(options),
    /this queue's authenticated TCP proxy/,
  );
});

test("rejects a persistent environment even if its name looks like a PR", async () => {
  const options = fixture({ mounted: false });
  const run = options.run;
  options.run = (args) => {
    const result = JSON.parse(run(args));
    if (args[0] === "api" && args[1].includes("query"))
      result.data.environment.isEphemeral = false;
    return JSON.stringify(result);
  };
  await assert.rejects(
    prepareRailwayPreviewQueue(options),
    /verified ephemeral/,
  );
  assert.ok(options.calls.every((args) => !args[1]?.includes("mutation")));
});

test("fails closed when no skipped inherited storage exists", async () => {
  const options = fixture({ mounted: false });
  const run = options.run;
  options.run = (args) => {
    const result = JSON.parse(run(args));
    if (args[0] === "api" && args[1].includes("query"))
      result.data.environment.meta.skippedResourceIds = {};
    if (args[0] === "environment")
      result.services = {
        "queue-id": {
          source: { image: "redis:8.2" },
          deploy: { requiredMountPath: "/bitnami" },
        },
      };
    return JSON.stringify(result);
  };
  await assert.rejects(
    prepareRailwayPreviewQueue(options),
    /no skipped service to activate/,
  );
  assert.ok(options.calls.every((args) => !args[1]?.includes("mutation")));
});

test("does not treat rejected activation as successful provisioning", async () => {
  const options = fixture({ mounted: false });
  const run = options.run;
  options.run = (args) =>
    args[0] === "api" && args[1].includes("mutation")
      ? JSON.stringify({ data: { environmentUnskipService: false } })
      : run(args);
  await assert.rejects(
    prepareRailwayPreviewQueue(options),
    /activation failed/,
  );
  assert.equal(options.calls.filter((args) => args[0] === "service").length, 0);
});

test("does not accept an old healthy deployment as evidence of redeploy success", async () => {
  const options = fixture();
  const run = options.run;
  options.run = (args) =>
    args[0] === "deployment"
      ? JSON.stringify([{ id: "old-deployment", status: "SUCCESS" }])
      : run(args);
  await assert.rejects(
    prepareRailwayPreviewQueue(options),
    /did not reach SUCCESS/,
  );
});

test("fails immediately when the new deployment fails", async () => {
  const options = fixture();
  const run = options.run;
  options.run = (args) => {
    const result = JSON.parse(run(args));
    if (args[0] === "deployment" && result[0].id === "new-deployment")
      result[0].status = "FAILED";
    return JSON.stringify(result);
  };
  await assert.rejects(prepareRailwayPreviewQueue(options), /did not succeed/);
});
