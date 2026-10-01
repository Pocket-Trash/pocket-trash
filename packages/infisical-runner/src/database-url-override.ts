import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

/** The allowed format for user database URL initials. */
const urlInitialsPattern = /^[A-Z0-9]+$/;

/**
 * Finds the first configured personal database URL override.
 *
 * @param filePaths - Environment files to inspect in precedence order.
 * @param environment - Environment containing the selected Infisical secret.
 * @returns The normalized selector and secret, or `undefined` when no selector exists.
 * @throws When an environment file cannot be read or parsed.
 * @throws When the selector is invalid or its selected secret is absent.
 */
export function getDatabaseUrlOverride(
  filePaths: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
):
  | {
      /** The normalized user initials. */
      initials: string;
      /** The selected environment variable name. */
      name: string;
      /** The selected database connection string. */
      value: string;
    }
  | undefined {
  for (const filePath of filePaths) {
    if (!existsSync(filePath)) {
      continue;
    }

    const { URL_INITIALS: configuredInitials } = parseEnv(
      readFileSync(filePath, "utf8"),
    );

    if (configuredInitials === undefined) {
      continue;
    }

    const initials = configuredInitials.trim().toUpperCase();

    if (!initials || !urlInitialsPattern.test(initials)) {
      throw new Error(
        `URL_INITIALS in ${filePath} must contain only letters and numbers.`,
      );
    }

    const name = `DATABASE_URL_${initials}`;
    const value = environment[name];

    if (!value) {
      throw new Error(
        `${name} was selected by ${filePath} but is missing from Infisical /local/database.`,
      );
    }

    return { initials, name, value };
  }

  return undefined;
}

/**
 * Applies a selected personal database URL to an environment object.
 *
 * @param filePaths - Environment files to inspect in precedence order.
 * @param environment - Environment to read and mutate.
 * @returns The applied override, or `undefined` when no selector exists.
 * @throws When override discovery fails validation or file access.
 */
export function applyDatabaseUrlOverride(
  filePaths: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
) {
  const override = getDatabaseUrlOverride(filePaths, environment);
  if (override) {
    environment.DATABASE_URL = override.value;
    environment.URL_INITIALS = override.initials;
  }
  return override;
}
