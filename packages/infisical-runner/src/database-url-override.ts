import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const databaseUrlInitialsPattern = /^[A-Z0-9]+$/;

export function getDatabaseUrlOverride(
  filePaths: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): { name: string; value: string } | undefined {
  for (const filePath of filePaths) {
    if (!existsSync(filePath)) {
      continue;
    }

    const { DATABASE_URL_INITIALS: configuredInitials } = parseEnv(
      readFileSync(filePath, "utf8"),
    );

    if (configuredInitials === undefined) {
      continue;
    }

    const initials = configuredInitials.trim().toUpperCase();

    if (!initials || !databaseUrlInitialsPattern.test(initials)) {
      throw new Error(
        `DATABASE_URL_INITIALS in ${filePath} must contain only letters and numbers.`,
      );
    }

    const name = `DATABASE_URL_${initials}`;
    const value = environment[name];

    if (!value) {
      throw new Error(
        `${name} was selected by ${filePath} but is missing from Infisical /local/database.`,
      );
    }

    return { name, value };
  }

  return undefined;
}
