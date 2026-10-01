import { spawn } from "node:child_process";
import { chmodSync, existsSync, statSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/** CommonJS resolver scoped to this ES module. */
const require = createRequire(import.meta.url);
/** Installed `drizzle-view` package manifest path. */
const packageJsonPath = require.resolve("drizzle-view/package.json");
/** Installed `drizzle-view` package directory. */
const packageDir = dirname(packageJsonPath);
/** Platform-specific executable filename expected by `drizzle-view`. */
const binaryName = getBinaryName();
/** Path to the installed platform executable. */
const binaryPath = join(packageDir, "bin", binaryName);

if (existsSync(binaryPath)) {
  const stats = statSync(binaryPath);

  if (stats.size === 0) {
    unlinkSync(binaryPath);
  } else if (process.platform !== "win32") {
    chmodSync(binaryPath, 0o755);
  }
}

/** Installed `drizzle-view` JavaScript CLI entry point. */
const cliPath = require.resolve("drizzle-view/drizzle-view.js");
/** Child process running the CLI with inherited terminal I/O. */
const child = spawn(process.execPath, [cliPath, ...process.argv.slice(2)], {
  stdio: "inherit",
});

child.on("error", (error) => {
  throw error;
});

child.on("exit", (code, signal) => {
  if (typeof code === "number") {
    process.exitCode = code;
    return;
  }

  console.error(`drizzle-view exited after signal ${signal ?? "unknown"}.`);
  process.exitCode = 1;
});

/**
 * Builds the executable filename for the current platform and architecture.
 *
 * @returns The installed `drizzle-view` binary filename.
 */
function getBinaryName() {
  const extension = process.platform === "win32" ? ".exe" : "";

  return `drizzle-view-${process.platform}-${process.arch}${extension}`;
}
