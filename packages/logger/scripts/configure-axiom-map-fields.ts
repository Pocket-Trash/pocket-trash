import process from "node:process";
import {
  type AxiomManagementFetch,
  type AxiomMapFieldConfig,
  axiomMapFields,
  checkAxiomMapFields,
  ensureAxiomMapFields,
} from "../src/index.js";

/** Supported Axiom map-field command modes. */
type Mode = "check" | "ensure";

/**
 * Runs the requested Axiom map-field operation from environment configuration.
 *
 * @returns Completion after the dataset is checked or ensured.
 * @rejects When arguments, configuration, or the Axiom request are invalid.
 */
async function main(): Promise<void> {
  const mode = readMode(process.argv[2]);
  const config = readConfig();

  if (mode === "check") {
    await checkAxiomMapFields(config, fetch as AxiomManagementFetch);
    console.log(
      `Axiom map fields verified for ${config.dataset}: ${axiomMapFields.join(", ")}`,
    );
    return;
  }

  await ensureAxiomMapFields(config, fetch as AxiomManagementFetch);
  console.log(
    `Axiom map fields ensured for ${config.dataset}: ${axiomMapFields.join(", ")}`,
  );
}

/**
 * Reads Axiom map-field configuration from environment variables.
 *
 * @param env - Environment variable source.
 * @returns Validated Axiom management configuration.
 * @throws When a required environment variable is missing.
 */
function readConfig(env: NodeJS.ProcessEnv = process.env): AxiomMapFieldConfig {
  return {
    dataset: requiredEnv(env, "AXIOM_DATASET"),
    token: requiredEnv(env, "AXIOM_MANAGEMENT_TOKEN"),
  };
}

/**
 * Validates the requested command mode.
 *
 * @param value - Command-line mode argument.
 * @returns Validated check or ensure mode.
 * @throws When the mode is absent or unsupported.
 */
function readMode(value: string | undefined): Mode {
  if (value === "check" || value === "ensure") {
    return value;
  }

  throw new Error("Usage: axiom:map-fields <check|ensure>.");
}

/**
 * Reads a required non-empty environment variable.
 *
 * @param env - Environment variable source.
 * @param key - Variable name to read.
 * @returns The configured value.
 * @throws When the variable is absent or empty.
 */
function requiredEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
