import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getDatabaseUrlOverride } from "./database-url-override.js";

const temporaryDirectories: string[] = [];

function createEnvFile(contents: string): string {
  const directory = mkdtempSync(join(tmpdir(), "database-url-override-"));
  temporaryDirectories.push(directory);
  const filePath = join(directory, ".env.local");
  writeFileSync(filePath, contents);
  return filePath;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("getDatabaseUrlOverride", () => {
  it("uses the shared database when .env.local does not exist", () => {
    expect(getDatabaseUrlOverride(["/missing/.env.local"])).toBeUndefined();
  });

  it("selects a personal database URL injected from Infisical", () => {
    const filePath = createEnvFile("DATABASE_URL_INITIALS=ra\n");

    expect(
      getDatabaseUrlOverride([filePath], {
        DATABASE_URL_RA: "postgresql://personal",
      }),
    ).toEqual({
      name: "DATABASE_URL_RA",
      value: "postgresql://personal",
    });
  });

  it("rejects a selected database URL missing from Infisical", () => {
    const filePath = createEnvFile("DATABASE_URL_INITIALS=RA\n");

    expect(() => getDatabaseUrlOverride([filePath], {})).toThrow(
      "DATABASE_URL_RA was selected",
    );
  });

  it("rejects invalid initials", () => {
    const filePath = createEnvFile("DATABASE_URL_INITIALS=R-A\n");

    expect(() => getDatabaseUrlOverride([filePath], {})).toThrow(
      "must contain only letters and numbers",
    );
  });

  it("falls back to the package-level selector", () => {
    const rootFilePath = createEnvFile("SITE_URL=http://localhost\n");
    const packageFilePath = createEnvFile("DATABASE_URL_INITIALS=RA\n");

    expect(
      getDatabaseUrlOverride([rootFilePath, packageFilePath], {
        DATABASE_URL_RA: "postgresql://personal",
      }),
    ).toEqual({
      name: "DATABASE_URL_RA",
      value: "postgresql://personal",
    });
  });
});
