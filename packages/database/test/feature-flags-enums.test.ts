import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  featureFlagAudiences,
  featureFlagOverrideSources,
} from "../src/schema/enums.js";

/** Absolute path to the shared feature-flag constants. */
const sharedFeatureFlagsPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../feature-flags/src/index.ts",
);

/**
 * Reads an exported string-array constant from the feature-flags package.
 *
 * @param exportName - Exported constant name to locate.
 * @returns The constant's string values.
 * @throws When the export is absent or is not a string-array literal.
 */
function readSharedStringArray(exportName: string): string[] {
  const sourceFile = ts.createSourceFile(
    sharedFeatureFlagsPath,
    readFileSync(sharedFeatureFlagsPath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === exportName &&
        declaration.initializer
      ) {
        return readStringArrayInitializer(declaration.initializer, exportName);
      }
    }
  }

  throw new Error(`Could not find ${exportName} in ${sharedFeatureFlagsPath}.`);
}

/**
 * Extracts string values from a TypeScript array initializer.
 *
 * @param initializer - Export initializer to inspect.
 * @param exportName - Export name used in validation errors.
 * @returns String literals in source order.
 * @throws When the initializer is not an array of string literals.
 */
function readStringArrayInitializer(
  initializer: ts.Expression,
  exportName: string,
): string[] {
  const expression = ts.isAsExpression(initializer)
    ? initializer.expression
    : initializer;

  if (!ts.isArrayLiteralExpression(expression)) {
    throw new Error(`${exportName} must be an array literal.`);
  }

  return expression.elements.map((element) => {
    if (!ts.isStringLiteral(element)) {
      throw new Error(`${exportName} must contain only string literals.`);
    }

    return element.text;
  });
}

describe("feature flag schema enums", () => {
  it("match the shared feature flag package constants", () => {
    expect(featureFlagAudiences).toEqual(
      readSharedStringArray("featureFlagAudiences"),
    );
    expect(featureFlagOverrideSources).toEqual(
      readSharedStringArray("featureFlagOverrideSources"),
    );
  });
});
