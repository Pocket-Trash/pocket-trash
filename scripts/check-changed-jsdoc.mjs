import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { ESLint } from "eslint";
import jsdoc from "eslint-plugin-jsdoc";
import ts from "typescript";
import tseslint from "typescript-eslint";

/** Generated source files excluded from changed-declaration enforcement. */
const generatedFiles = new Set([
  "apps/api/src/worker-configuration.d.ts",
  "apps/web/src/routeTree.gen.ts",
  "apps/web/src/vite-env.d.ts",
]);
/** ESLint selectors for stable named declarations that require JSDoc. */
const jsdocContexts = [
  "FunctionDeclaration",
  "ClassDeclaration",
  "MethodDefinition",
  "PropertyDefinition",
  "TSInterfaceDeclaration",
  "TSTypeAliasDeclaration",
  "TSPropertySignature",
  "TSMethodSignature",
  "TSCallSignatureDeclaration",
  "TSEnumDeclaration",
  "TSModuleDeclaration",
  "Program > VariableDeclaration",
  "ExportNamedDeclaration[declaration.type='VariableDeclaration']",
  "VariableDeclaration[parent.type!='ExportNamedDeclaration']:has(VariableDeclarator[init.type='ArrowFunctionExpression'])",
  "VariableDeclaration[parent.type!='ExportNamedDeclaration']:has(VariableDeclarator[init.type='FunctionExpression'])",
  "Property[method=true]",
  "Property[value.type='ArrowFunctionExpression']",
  "Property[value.type='FunctionExpression']",
];
/** ESLint selectors for named callable declarations with inspectable parameters. */
const callableContexts = [
  "FunctionDeclaration",
  "VariableDeclarator > ArrowFunctionExpression",
  "VariableDeclarator > FunctionExpression",
  "MethodDefinition > FunctionExpression",
  "Property > ArrowFunctionExpression",
  "Property > FunctionExpression",
  "PropertyDefinition > ArrowFunctionExpression",
  "PropertyDefinition > FunctionExpression",
  "TSMethodSignature",
  "TSCallSignatureDeclaration",
  "TSFunctionType",
  "TSEmptyBodyFunctionExpression",
  "TSDeclareFunction",
];
/** Callable selectors that exclude explicitly void TypeScript signatures. */
const returnContexts = [
  ...callableContexts.slice(0, 8),
  ...callableContexts.slice(8).map((context) => ({
    context: `${context}:not([returnType.typeAnnotation.type='TSVoidKeyword'])`,
    forceRequireReturn: true,
  })),
];

/** TypeScript parser modes keyed by supported source extension. */
const scriptKinds = new Map([
  [".cjs", ts.ScriptKind.JS],
  [".cts", ts.ScriptKind.TS],
  [".js", ts.ScriptKind.JS],
  [".jsx", ts.ScriptKind.JSX],
  [".mjs", ts.ScriptKind.JS],
  [".mts", ts.ScriptKind.TS],
  [".ts", ts.ScriptKind.TS],
  [".tsx", ts.ScriptKind.TSX],
]);

/**
 * Runs Git and returns its UTF-8 output.
 *
 * @param cwd - Repository working directory.
 * @param args - Git command arguments.
 * @returns Git standard output.
 */
function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

/**
 * Lists changed JavaScript and TypeScript files from a Git diff.
 *
 * @param cwd - Repository working directory.
 * @param diffArgs - Arguments selecting the Git diff range.
 * @returns Changed source files and their Git statuses.
 */
function diffFiles(cwd, diffArgs) {
  const fields = git(cwd, [
    "diff",
    ...diffArgs,
    "--name-status",
    "-z",
    "--diff-filter=ACMR",
    "--find-renames",
  ]).split("\0");
  const files = [];

  for (let index = 0; index < fields.length - 1; ) {
    const status = fields[index++];
    const renamed = status.startsWith("R") || status.startsWith("C");
    const oldPath = renamed ? fields[index++] : undefined;
    const path = fields[index++];
    if (/\.[cm]?[jt]sx?$/.test(path)) {
      files.push({ oldPath, path, status: status[0] });
    }
  }

  return files;
}

/**
 * Extracts changed target lines for one file.
 *
 * @param cwd - Repository working directory.
 * @param diffArgs - Arguments selecting the Git diff range.
 * @param file - Current path and optional pre-rename path.
 * @param file.oldPath - Path before a detected rename.
 * @param file.path - Current source path.
 * @returns Changed line numbers in the current and previous file versions.
 */
function changedLinesForFile(cwd, diffArgs, { oldPath, path }) {
  const patch = git(cwd, [
    "diff",
    ...diffArgs,
    "--unified=0",
    "--no-ext-diff",
    "--",
    ...[oldPath, path].filter(Boolean),
  ]);
  const changedLines = new Set();
  const deletedLines = new Set();

  for (const line of patch.split("\n")) {
    const hunk = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!hunk) {
      continue;
    }
    const oldStart = Number(hunk[1]);
    const oldCount = hunk[2] === undefined ? 1 : Number(hunk[2]);
    const newStart = Number(hunk[3]);
    const newCount = hunk[4] === undefined ? 1 : Number(hunk[4]);
    for (let offset = 0; offset < oldCount; offset += 1) {
      deletedLines.add(oldStart + offset);
    }
    for (let offset = 0; offset < newCount; offset += 1) {
      changedLines.add(newStart + offset);
    }
  }

  return { changedLines, deletedLines };
}

/**
 * Finds changed source lines in the staged or merge-base diff.
 *
 * @param options - Diff selection options.
 * @param options.baseRef - PR base ref; omit to inspect staged changes.
 * @param options.cwd - Repository working directory.
 * @returns Changed lines and new-file status keyed by current path.
 */
export function getChangedFileLines({ baseRef, cwd = process.cwd() } = {}) {
  const baseCommit = baseRef
    ? git(cwd, ["merge-base", "HEAD", baseRef]).trim()
    : "HEAD";
  const diffArgs = baseRef ? [baseCommit, "HEAD"] : ["--cached"];

  return new Map(
    diffFiles(cwd, diffArgs).map((file) => {
      const isNewFile = file.status === "A" || file.status === "C";
      return [
        file.path,
        {
          ...changedLinesForFile(cwd, diffArgs, file),
          isNewFile,
          previousSourceText: isNewFile
            ? undefined
            : git(cwd, ["show", `${baseCommit}:${file.oldPath ?? file.path}`]),
        },
      ];
    }),
  );
}

/**
 * Converts a source position to its one-based line number.
 *
 * @param sourceFile - Parsed TypeScript source file.
 * @param position - Zero-based character position.
 * @returns One-based source line number.
 */
function lineAt(sourceFile, position) {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

/**
 * Reads the stable source name for a declaration node.
 *
 * @param node - TypeScript declaration name node.
 * @param sourceFile - Parsed TypeScript source file.
 * @returns The declaration name, when one is available.
 */
function declarationName(node, sourceFile) {
  if (
    ts.isIdentifier(node) ||
    ts.isPrivateIdentifier(node) ||
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node)
  ) {
    return node.text;
  }
  return node?.getText(sourceFile);
}

/**
 * Describes an eligible declaration or excluded contextual callback.
 *
 * @param node - TypeScript syntax node to classify.
 * @param sourceFile - Parsed TypeScript source file.
 * @returns Declaration range metadata, or `undefined` for unrelated syntax.
 */
function declarationFor(node, sourceFile) {
  let eligible = true;
  let name;
  let owner = node;

  if (ts.isFunctionDeclaration(node) && node.name) {
    name = node.name.text;
  } else if (
    ts.isTypeAliasDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isModuleDeclaration(node)
  ) {
    if (!node.name) {
      return undefined;
    }
    name = node.name.text;
  } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
    const statement = node.parent.parent;
    const callable =
      node.initializer &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer));
    const topLevel = statement.parent === sourceFile;
    if (!callable && !topLevel) {
      return undefined;
    }
    name = node.name.text;
    owner = statement;
  } else if (
    ts.isMethodDeclaration(node) ||
    ts.isMethodSignature(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isPropertySignature(node)
  ) {
    name = declarationName(node.name, sourceFile);
  } else if (ts.isConstructorDeclaration(node)) {
    name = "constructor";
  } else if (
    ts.isPropertyAssignment(node) &&
    node.initializer &&
    (ts.isArrowFunction(node.initializer) ||
      ts.isFunctionExpression(node.initializer))
  ) {
    name = declarationName(node.name, sourceFile);
  } else if (ts.isCallSignatureDeclaration(node)) {
    name = "call signature";
  } else if (ts.isConstructSignatureDeclaration(node)) {
    name = "construct signature";
  } else if (ts.isIndexSignatureDeclaration(node)) {
    name = "index signature";
  } else if (
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
    ((ts.isCallExpression(node.parent) &&
      node.parent.arguments.includes(node)) ||
      (ts.isNewExpression(node.parent) &&
        node.parent.arguments?.includes(node)) ||
      (ts.isJsxExpression(node.parent) && node.parent.expression === node))
  ) {
    eligible = false;
    name = "anonymous callback";
  } else {
    return undefined;
  }

  const jsdoc = ts.getJSDocCommentsAndTags(owner);
  const start = jsdoc.length > 0 ? jsdoc[0].pos : owner.getStart(sourceFile);
  const functionType =
    ts.isTypeAliasDeclaration(node) && ts.isFunctionTypeNode(node.type)
      ? node.type
      : undefined;

  return {
    end: owner.end,
    endLine: lineAt(sourceFile, owner.end),
    eligible,
    functionType,
    id: `${node.kind}:${start}:${owner.end}`,
    key: `${node.kind}:${name}`,
    name,
    start,
    startLine: lineAt(sourceFile, start),
    tags: functionType ? ts.getJSDocTags(owner) : undefined,
  };
}

/**
 * Checks tags that eslint-plugin-jsdoc cannot associate with function type aliases.
 *
 * @param declaration - Selected function type alias metadata.
 * @param filePath - Absolute source path.
 * @returns Missing or mismatched tag diagnostics.
 */
function functionTypeAliasDiagnostics(declaration, filePath) {
  const { functionType, startLine: line, tags } = declaration;
  if (!functionType) {
    return [];
  }
  /**
   * Builds a JSDoc rule diagnostic on the alias documentation line.
   *
   * @param ruleId - JSDoc rule identifier.
   * @param message - Diagnostic message.
   * @returns A diagnostic for the selected alias.
   */
  const diagnostic = (ruleId, message) => ({
    column: 1,
    endColumn: 1,
    endLine: line,
    filePath,
    line,
    message,
    ruleId,
    severity: 2,
  });
  const paramTags = tags.filter(ts.isJSDocParameterTag);
  const diagnostics = [];
  for (const parameter of functionType.parameters) {
    const name = parameter.name.getText();
    const tag = paramTags.find(
      (candidate) => candidate.name?.getText() === name,
    );
    if (!tag) {
      diagnostics.push(
        diagnostic(
          "jsdoc/require-param",
          `Missing JSDoc @param "${name}" declaration.`,
        ),
      );
    } else if (!tag.comment) {
      diagnostics.push(
        diagnostic(
          "jsdoc/require-param-description",
          `Missing JSDoc @param "${name}" description.`,
        ),
      );
    }
  }
  if (
    paramTags.some(
      (tag) =>
        !functionType.parameters.some(
          (parameter) => parameter.name.getText() === tag.name?.getText(),
        ),
    )
  ) {
    diagnostics.push(
      diagnostic(
        "jsdoc/check-param-names",
        "JSDoc @param name does not match the function signature.",
      ),
    );
  }
  const returnTag = tags.find(ts.isJSDocReturnTag);
  if (functionType.type.kind !== ts.SyntaxKind.VoidKeyword && !returnTag) {
    diagnostics.push(
      diagnostic(
        "jsdoc/require-returns",
        "Missing JSDoc @returns declaration.",
      ),
    );
  } else if (returnTag && !returnTag.comment) {
    diagnostics.push(
      diagnostic(
        "jsdoc/require-returns-description",
        "Missing JSDoc @returns description.",
      ),
    );
  }
  const documentedTemplates = new Set(
    tags
      .filter(ts.isJSDocTemplateTag)
      .flatMap((tag) => tag.typeParameters.map(({ name }) => name.text)),
  );
  const typeParameters = new Set(
    (functionType.typeParameters ?? []).map(({ name }) => name.text),
  );
  for (const name of typeParameters) {
    if (!documentedTemplates.has(name)) {
      diagnostics.push(
        diagnostic("jsdoc/require-template", `Missing @template ${name}`),
      );
    }
  }
  for (const name of documentedTemplates) {
    if (!typeParameters.has(name)) {
      diagnostics.push(
        diagnostic(
          "jsdoc/check-template-names",
          `@template ${name} not in use`,
        ),
      );
    }
  }
  return diagnostics;
}

/**
 * Enumerates declaration ranges in a source file.
 *
 * @param input - Source file path and contents.
 * @param input.filePath - Repository-relative source path.
 * @param input.sourceText - Current source contents.
 * @returns Eligible declarations and excluded callback ranges.
 */
function declarationsIn({ filePath, sourceText }) {
  const extension = filePath.slice(filePath.lastIndexOf("."));
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKinds.get(extension) ?? ts.ScriptKind.TS,
  );
  const declarations = [];

  /**
   * Collects declaration metadata recursively.
   *
   * @param node - Current TypeScript syntax node.
   * @returns Nothing.
   */
  function visit(node) {
    const declaration = declarationFor(node, sourceFile);
    if (declaration) {
      declarations.push(declaration);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return declarations;
}

/**
 * Selects declarations affected by changed source lines.
 *
 * @param input - Source and Git change metadata.
 * @param input.changedLines - Added and modified source lines.
 * @param input.deletedLines - Deleted source lines from the previous version.
 * @param input.filePath - Repository-relative source path.
 * @param input.isNewFile - Whether Git reports an added or copied file.
 * @param input.previousSourceText - Source contents before the change.
 * @param input.sourceText - Current source contents.
 * @returns Changed eligible declarations.
 */
export function selectChangedDeclarations({
  changedLines,
  deletedLines = new Set(),
  filePath,
  isNewFile = false,
  previousSourceText,
  sourceText,
}) {
  if (generatedFiles.has(filePath)) {
    return [];
  }

  const declarations = declarationsIn({ filePath, sourceText });
  const selected = declarations.filter(
    (declaration) =>
      declaration.eligible &&
      (isNewFile ||
        [...changedLines].some(
          (line) =>
            line >= declaration.startLine && line <= declaration.endLine,
        )),
  );
  if (!previousSourceText || deletedLines.size === 0) {
    return selected;
  }

  const selectedIds = new Set(selected.map(({ id }) => id));
  const previousDeclarations = declarationsIn({
    filePath,
    sourceText: previousSourceText,
  });
  for (const line of deletedLines) {
    const previousOwner = previousDeclarations
      .filter(
        ({ eligible, endLine, startLine }) =>
          eligible && line >= startLine && line <= endLine,
      )
      .sort(
        (left, right) => left.end - left.start - (right.end - right.start),
      )[0];
    if (!previousOwner) {
      continue;
    }
    for (const declaration of declarations) {
      if (
        declaration.eligible &&
        declaration.key === previousOwner.key &&
        !selectedIds.has(declaration.id)
      ) {
        selected.push(declaration);
        selectedIds.add(declaration.id);
      }
    }
  }
  return selected;
}

/**
 * Runs JSDoc rules and retains diagnostics owned by changed declarations.
 *
 * @param input - Lint inputs.
 * @param input.changes - Changed lines keyed by repository-relative path.
 * @param input.cwd - Repository working directory.
 * @returns JSDoc diagnostics for changed declarations.
 */
export async function lintChangedDeclarations({
  changes,
  cwd = process.cwd(),
}) {
  const declarationsByPath = new Map(
    [...changes].map(([filePath, change]) => {
      const absolutePath = resolve(cwd, filePath);
      const sourceText = readFileSync(absolutePath, "utf8");
      const all = generatedFiles.has(filePath)
        ? []
        : declarationsIn({ filePath, sourceText });
      const selected = selectChangedDeclarations({
        ...change,
        filePath,
        sourceText,
      });
      return [absolutePath, { all, selected }];
    }),
  );
  const selectedPaths = [...declarationsByPath]
    .filter(([, { selected }]) => selected.length > 0)
    .map(([filePath]) => filePath);
  if (selectedPaths.length === 0) {
    return [];
  }

  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        plugins: { jsdoc },
        settings: {
          jsdoc: {
            mode: "typescript",
            structuredTags: { rejects: { type: false } },
          },
        },
        rules: {
          "jsdoc/check-param-names": ["error", { checkDestructured: false }],
          "jsdoc/check-tag-names": "error",
          "jsdoc/check-template-names": "error",
          "jsdoc/require-description": ["error", { contexts: jsdocContexts }],
          "jsdoc/require-jsdoc": ["error", { contexts: jsdocContexts }],
          "jsdoc/require-param": [
            "error",
            {
              checkDestructured: false,
              checkDestructuredRoots: true,
              contexts: callableContexts,
            },
          ],
          "jsdoc/require-param-description": [
            "error",
            { contexts: callableContexts },
          ],
          "jsdoc/require-param-name": ["error", { contexts: callableContexts }],
          "jsdoc/require-rejects": ["error", { contexts: callableContexts }],
          "jsdoc/require-returns": ["error", { contexts: returnContexts }],
          "jsdoc/require-returns-description": [
            "error",
            { contexts: callableContexts },
          ],
          "jsdoc/require-template": "error",
          "jsdoc/require-template-description": "error",
          "jsdoc/require-throws": ["error", { contexts: callableContexts }],
          "jsdoc/require-throws-description": "error",
          "jsdoc/require-yields": ["error", { contexts: callableContexts }],
          "jsdoc/require-yields-description": "error",
        },
      },
      {
        files: ["**/*.{ts,tsx,mts,cts}"],
        rules: {
          "jsdoc/check-tag-names": ["error", { typed: true }],
          "jsdoc/no-types": "error",
        },
      },
    ],
  });
  const results = await eslint.lintFiles(selectedPaths);

  return results.flatMap((result) => {
    const { all = [], selected = [] } =
      declarationsByPath.get(result.filePath) ?? {};
    const selectedIds = new Set(selected.map(({ id }) => id));
    const messages = result.messages
      .filter(({ line, ruleId }) => {
        const owner = all
          .filter(
            ({ endLine, startLine }) => line >= startLine && line <= endLine,
          )
          .sort(
            (left, right) => left.end - left.start - (right.end - right.start),
          )[0];
        return (
          owner &&
          selectedIds.has(owner.id) &&
          !(owner.functionType && ruleId === "jsdoc/check-template-names")
        );
      })
      .map((message) => ({ ...message, filePath: result.filePath }));
    return [
      ...selected.flatMap((declaration) =>
        functionTypeAliasDiagnostics(declaration, result.filePath),
      ),
      ...new Map(
        messages.map((message) => [
          [message.line, message.column, message.ruleId, message.message].join(
            ":",
          ),
          message,
        ]),
      ).values(),
    ];
  });
}

/**
 * Checks the current staged diff or pull-request merge-base for JSDoc errors.
 *
 * @param options - Command options.
 * @param options.baseRef - PR base ref; omit to inspect staged changes.
 * @param options.cwd - Repository working directory.
 * @returns Process exit code for the changed-declaration check.
 */
export async function runChangedJsdoc({
  baseRef = process.env.JSDOC_BASE_REF ||
    (process.env.GITHUB_BASE_REF
      ? `origin/${process.env.GITHUB_BASE_REF}`
      : undefined),
  cwd = process.cwd(),
} = {}) {
  const diagnostics = await lintChangedDeclarations({
    changes: getChangedFileLines({ baseRef, cwd }),
    cwd,
  });
  if (diagnostics.length === 0) {
    return 0;
  }

  for (const { column, filePath, line, message, ruleId } of diagnostics) {
    console.error(
      `${relative(cwd, filePath)}:${line}:${column} error ${message} ${ruleId}`,
    );
  }
  console.error(
    `\n${diagnostics.length} JSDoc error(s) in changed declarations.`,
  );
  return 1;
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  process.exitCode = await runChangedJsdoc();
}
