import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";

/**
 * Runs the real deployment command against a disposable fake provider.
 * @param t - Test lifecycle.
 * @param mode - Transport or HTTP failure to inject.
 * @returns Captured command output and request methods.
 */
async function deploy(t, mode) {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(request.method);
    request.resume();
    const reads = requests.filter((method) => method === "GET").length;
    if (
      (mode === "disconnect" && reads === 1) ||
      (mode === "postDisconnect" && request.method === "POST")
    ) {
      request.socket.destroy();
      return;
    }
    response.setHeader("content-type", "application/json");
    if ((mode === "transient" && reads === 1) || mode === "postFailure") {
      response.writeHead(503);
      response.end('{"error":"sensitive-provider-body"}');
    } else if (mode === "unauthorized" && request.method === "GET") {
      response.writeHead(401);
      response.end('{"error":"sensitive-provider-body"}');
    } else
      response.end(
        JSON.stringify(
          request.method === "POST"
            ? { id: "deployment" }
            : { readyState: "READY", url: "preview.example.test" },
        ),
      );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const child = spawn(
    "bash",
    [".github/scripts/vercel-branch-database-url.sh", "deploy-preview"],
    {
      env: {
        ...process.env,
        VERCEL_API_BASE: `http://127.0.0.1:${server.address().port}`,
        AXIOM_TOKEN: "",
        AXIOM_DATASET: "",
        VERCEL_TOKEN: "sensitive-token",
        VERCEL_ORG_ID: "team",
        VERCEL_PROJECT_ID: "project",
        BRANCH_NAME: "ra/preview",
        COMMIT_SHA: "a".repeat(40),
        REPOSITORY_ID: "123",
        PR_NUMBER: "485",
        GITHUB_OUTPUT: "",
      },
      timeout: 15_000,
    },
  );
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  const status = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  assert.ok(!output.includes("sensitive-token"));
  assert.ok(!output.includes("sensitive-provider-body"));
  return { status, output, requests };
}

for (const mode of ["transient", "disconnect"])
  test(`Vercel status reads recover from ${mode} failures`, async (t) => {
    const result = await deploy(t, mode);
    assert.equal(result.status, 0, result.output);
    assert.deepEqual(result.requests, ["POST", "GET", "GET"]);
    assert.ok(
      result.output.includes("web_preview_url=https://preview.example.test"),
    );
  });

for (const mode of ["unauthorized", "postFailure", "postDisconnect"])
  test(`Vercel ${mode} fails safely without retrying deployment creation`, async (t) => {
    const result = await deploy(t, mode);
    assert.notEqual(result.status, 0);
    assert.deepEqual(
      result.requests,
      mode === "unauthorized" ? ["POST", "GET"] : ["POST"],
    );
  });
