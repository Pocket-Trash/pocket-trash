import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";

/** Repository root used as the child-process working directory. */
const repoRoot = new URL("..", import.meta.url).pathname;
/** Expected Clerk application identifier injected by Infisical. */
const clerkAppId = process.env.APP_ID?.trim();
/** Expected Clerk development instance identifier injected by Infisical. */
const clerkInstanceId = process.env.INS_ID?.trim();
if (!clerkAppId || !clerkInstanceId) {
  throw new Error(
    "APP_ID and INS_ID are required from Infisical development /local/clerk.",
  );
}
/** Normalized developer initials used in the local relay key. */
const initials = readInitials([
  join(repoRoot, ".env.local"),
  join(repoRoot, ".env"),
]);

if (!initials) {
  throw new Error(
    "URL_INITIALS is required in repository-root .env.local or .env for local webhook forwarding.",
  );
}

await assertClerkLink();
if (process.argv[2] === "--check-clerk-link") process.exit(0);
/** Ephemeral credential authorizing the Clerk webhook listener. */
const relayToken = JSON.parse(
  await run("clerk", ["webhooks", "token", "--json"]),
).token;
/** Local API endpoint receiving relayed Clerk webhooks. */
const forwardTo = `http://localhost:4006/api/v0/webhooks/clerk/${initials.toLowerCase()}`;
/** Clerk webhook listener child process. */
const listener = spawn(
  "clerk",
  [
    "webhooks",
    "listen",
    "--token",
    relayToken,
    "--forward-to",
    forwardTo,
    "--json",
  ],
  { cwd: repoRoot, stdio: ["ignore", "pipe", "inherit"] },
);
/** Environment passed to the web process after removing tooling credentials. */
const webEnv = { ...process.env };
delete webEnv.APP_ID;
delete webEnv.CLOUDFLARE_ACCOUNT_ID;
delete webEnv.CLOUDFLARE_API_TOKEN;
delete webEnv.INS_ID;
/** Local web development server child process. */
const web = spawn("pnpm", ["dev:web"], {
  cwd: repoRoot,
  env: webEnv,
  stdio: "inherit",
});
/** Remote KV key advertising this developer's local relay. */
const key = `target:local:${initials}`;
/** Whether the remote relay registration must be removed during shutdown. */
let registered = false;
/** Whether coordinated shutdown has already begun. */
let stopping = false;

/** Registers the relay URL and terminates both children if registration fails. */
try {
  const relayUrl = await waitForRelayUrl(listener);
  await wrangler([
    "kv",
    "key",
    "put",
    key,
    "enabled",
    "--binding",
    "CLERK_WEBHOOK_TARGETS",
    "--env",
    "development",
    "--remote",
    "--ttl",
    "86400",
    "--metadata",
    JSON.stringify({ kind: "local", url: relayUrl }),
  ]);
  registered = true;
  process.stderr.write(`Registered ${key} -> ${relayUrl}\n`);
} catch (error) {
  listener.kill("SIGTERM");
  web.kill("SIGTERM");
  throw error;
}

/** Installs coordinated shutdown for supported termination signals. */
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => void stop(signal));
}
listener.on("exit", () => void stop());
web.on("exit", () => void stop());
await new Promise(() => {});

/**
 * Stops child processes, removes the relay registration, and exits.
 *
 * @param signal - Termination signal that initiated shutdown, when present.
 * @returns A promise that resolves immediately for duplicate calls; the first call exits the process.
 */
async function stop(signal) {
  if (stopping) return;
  stopping = true;
  listener.kill(signal ?? "SIGTERM");
  web.kill(signal ?? "SIGTERM");
  if (registered) {
    try {
      await wrangler([
        "kv",
        "key",
        "delete",
        key,
        "--binding",
        "CLERK_WEBHOOK_TARGETS",
        "--env",
        "development",
        "--remote",
      ]);
    } catch (error) {
      process.stderr.write(`Failed to remove ${key}: ${String(error)}\n`);
    }
  }
  process.exit(signal ? 128 : 0);
}

/**
 * Reads the first configured developer initials selector.
 *
 * @param paths - Environment files in precedence order.
 * @returns Normalized initials, or `undefined` when no selector exists.
 * @throws When a file cannot be read or parsed, or initials are invalid.
 */
function readInitials(paths) {
  for (const path of paths) {
    if (!existsSync(path)) continue;
    const value = parseEnv(readFileSync(path, "utf8")).URL_INITIALS;
    if (value === undefined) continue;
    const normalized = value.trim().toUpperCase();
    if (!/^[A-Z0-9]+$/u.test(normalized)) {
      throw new Error(
        `${path} URL_INITIALS must contain only letters and numbers.`,
      );
    }
    return normalized;
  }
}

/**
 * Waits for the Clerk listener to announce its relay URL.
 *
 * @param child - Clerk listener child process with piped standard output.
 * @returns A promise for the ready relay URL.
 * @rejects When the child fails or exits before readiness.
 */
function waitForRelayUrl(child) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        process.stdout.write(`${line}\n`);
        try {
          const event = JSON.parse(line);
          if (event.type === "ready" && typeof event.relay_url === "string") {
            resolve(event.relay_url);
          }
        } catch {
          // Clerk also writes non-JSON progress lines to stdout.
        }
      }
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      reject(new Error(`Clerk webhook listener exited with code ${code}.`)),
    );
  });
}

/**
 * Runs Wrangler through the Infisical preview-secret policy.
 *
 * @param args - Wrangler arguments.
 * @returns A promise for captured standard output.
 * @rejects When the wrapped command fails.
 */
function wrangler(args) {
  return run("pnpm", [
    "exec",
    "tsx",
    join(repoRoot, "packages/infisical-runner/src/cli.ts"),
    "api",
    "deploy:preview",
    "--",
    "pnpm",
    "--filter",
    "@app/api",
    "exec",
    "wrangler",
    ...args,
  ]);
}

/**
 * Verifies that Clerk CLI targets the configured application and instance.
 *
 * @returns A promise that settles after successful validation.
 * @rejects When the CLI is unhealthy, unlinked, or linked elsewhere.
 */
async function assertClerkLink() {
  let diagnostics;
  try {
    diagnostics = JSON.parse(await run("clerk", ["doctor", "--json"]));
  } catch {
    throw new Error(
      "Clerk CLI health check failed; dev:web:webhooks requires an authenticated, linked Clerk CLI.",
    );
  }
  if (!Array.isArray(diagnostics)) {
    throw new Error("Clerk CLI returned an invalid health check response.");
  }

  const application = diagnostics.find(
    (diagnostic) => diagnostic?.name === "Application reachable",
  );
  const project = diagnostics.find(
    (diagnostic) => diagnostic?.name === "Project linked",
  );
  if (
    application?.status !== "pass" ||
    typeof application.message !== "string" ||
    !application.message.includes(`(${clerkAppId})`) ||
    project?.status !== "pass" ||
    typeof project.detail !== "string" ||
    !project.detail.includes(`Dev instance: ${clerkInstanceId}`)
  ) {
    throw new Error(
      `dev:web:webhooks is not linked to the Clerk app and development instance configured in Infisical /local/clerk.`,
    );
  }
}

/**
 * Runs a command with captured standard output and inherited errors.
 *
 * @param command - Executable name or path.
 * @param args - Command arguments.
 * @returns A promise for captured standard output.
 * @rejects When the process cannot start or exits unsuccessfully.
 */
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "inherit"],
    });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${command} exited with code ${code}.`));
    });
  });
}
