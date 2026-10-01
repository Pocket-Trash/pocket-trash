/** Node filesystem access used to load commit policy documentation. */
const fs = require("node:fs");
/** Node path helpers used to locate repository documentation. */
const path = require("node:path");

/** Absolute path to the documented commit types and scopes. */
const docsPath = path.join(__dirname, "docs", "commit-lint.md");

/**
 * Reads the lines beneath a second-level Markdown heading.
 *
 * @param markdown - The complete Markdown document.
 * @param heading - The heading text to find.
 * @returns Lines in the matching section, excluding its heading.
 */
function getSectionLines(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const sectionLines = [];
  let inSection = false;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (inSection) {
        break;
      }

      inSection = line.trim() === `## ${heading}`;
      continue;
    }

    if (inSection) {
      sectionLines.push(line);
    }
  }

  return sectionLines;
}

/**
 * Extracts first-column code values from a Markdown table section.
 *
 * @param markdown - The complete Markdown document.
 * @param heading - The table section heading.
 * @returns Code values found in the table's first column.
 */
function extractCodesFromSection(markdown, heading) {
  return getSectionLines(markdown, heading)
    .map((line) => line.match(/^\|\s*`([^`]+)`\s*\|/)?.[1])
    .filter(Boolean);
}

/** Commit policy documentation used as the configuration source of truth. */
const markdown = fs.readFileSync(docsPath, "utf8");
/** Conventional commit types allowed by the documented policy. */
const types = extractCodesFromSection(markdown, "Types");
/** Conventional commit scopes allowed by the documented policy. */
const scopes = extractCodesFromSection(markdown, "Scopes");

if (types.length === 0) {
  throw new Error(`No commit types found in ${docsPath}`);
}

if (scopes.length === 0) {
  throw new Error(`No commit scopes found in ${docsPath}`);
}

module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 72],
    "scope-enum": [2, "always", scopes],
    "subject-case": [0],
    "type-enum": [2, "always", types],
  },
};
