import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const urlInitialsPattern = /^[A-Z0-9]+$/;

export function getDatabaseUrlOverride(
  filePaths: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): { initials: string; name: string; value: string } | undefined {
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
