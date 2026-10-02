import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { ESLint } from "eslint";
import jsdoc from "eslint-plugin-jsdoc";
import ts from "typescript";
import tseslint from "typescript-eslint";

/** Generated source files excluded from repository-wide enforcement. */
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
  "TSConstructSignatureDeclaration",
  "TSIndexSignature",
  "TSEnumDeclaration",
  "TSModuleDeclaration",
  "Program > VariableDeclaration",
  "ExportNamedDeclaration[declaration.type='VariableDeclaration']",
  "VariableDeclaration[parent.type!='ExportNamedDeclaration']:has(> VariableDeclarator[init.type='ArrowFunctionExpression'])",
  "VariableDeclaration[parent.type!='ExportNamedDeclaration']:has(> VariableDeclarator[init.type='FunctionExpression'])",
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
  "TSConstructSignatureDeclaration",
  "TSIndexSignature",
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
 * Lists existing tracked, hand-authored JavaScript and TypeScript source files.
 *
 * @param options - Repository selection.
 * @param options.cwd - Repository working directory.
 * @returns Repository-relative source paths, including staged additions.
 */
export function getTrackedSourceFiles({ cwd = process.cwd() } = {}) {
  return execFileSync("git", ["ls-files", "--cached", "--deduplicate", "-z"], {
    cwd,
    encoding: "utf8",
  })
    .split("\0")
    .filter(
      (filePath) =>
        /\.[cm]?[jt]sx?$/.test(filePath) &&
        !generatedFiles.has(filePath) &&
        existsSync(resolve(cwd, filePath)),
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
    endColumn:
      sourceFile.getLineAndCharacterOfPosition(owner.end).character + 1,
    endLine: lineAt(sourceFile, owner.end),
    eligible,
    functionType,
    name,
    start,
    startColumn: sourceFile.getLineAndCharacterOfPosition(start).character + 1,
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
export function declarationsIn({ filePath, sourceText }) {
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
 * Checks every eligible declaration in tracked source, excluding contextual callbacks.
 *
 * @param options - Repository selection.
 * @param options.cwd - Repository working directory.
 * @returns JSDoc diagnostics for all tracked, hand-authored declarations.
 */
export async function lintJsdoc({ cwd = process.cwd() } = {}) {
  const declarationsByPath = new Map(
    getTrackedSourceFiles({ cwd }).map((filePath) => {
      const absolutePath = resolve(cwd, filePath);
      const sourceText = readFileSync(absolutePath, "utf8");
      return [absolutePath, declarationsIn({ filePath, sourceText })];
    }),
  );
  const sourcePaths = [...declarationsByPath.keys()];
  if (sourcePaths.length === 0) {
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
  const results = await eslint.lintFiles(sourcePaths);

  return results.flatMap((result) => {
    const declarations = declarationsByPath.get(result.filePath) ?? [];
    const messages = result.messages
      .filter(({ column, line, ruleId }) => {
        const owner = declarations
          .filter(
            ({ endColumn, endLine, startColumn, startLine }) =>
              (line > startLine ||
                (line === startLine && column >= startColumn)) &&
              (line < endLine || (line === endLine && column <= endColumn)),
          )
          .sort(
            (left, right) => left.end - left.start - (right.end - right.start),
          )[0];
        return (
          owner &&
          owner.eligible &&
          !(owner.functionType && ruleId === "jsdoc/check-template-names")
        );
      })
      .map((message) => ({ ...message, filePath: result.filePath }));
    return [
      ...declarations
        .filter(({ eligible }) => eligible)
        .flatMap((declaration) =>
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
 * Checks all tracked source and prints any JSDoc errors.
 *
 * @param options - Repository selection.
 * @param options.cwd - Repository working directory.
 * @returns Zero for complete coverage, or one when JSDoc diagnostics are found.
 */
export async function runJsdoc({ cwd = process.cwd() } = {}) {
  const diagnostics = await lintJsdoc({ cwd });
  if (diagnostics.length === 0) {
    return 0;
  }

  for (const { column, filePath, line, message, ruleId } of diagnostics) {
    console.error(
      `${relative(cwd, filePath)}:${line}:${column} error ${message} ${ruleId}`,
    );
  }
  console.error(`\n${diagnostics.length} JSDoc error(s) in tracked source.`);
  return 1;
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  process.exitCode = await runJsdoc();
}
