import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import ts from "typescript";

/** Reviewed package whose individual style exports are bundled by the web app. */
const kit = "@awesome.me/kit-64c2f1f813";
/** Full icon-pack dependencies must not replace the reviewed subset. */
const fullPack = /^@fortawesome\/[^/]+-svg-icons(?:\/|$)/u;
/** Classic style modules and their Font Awesome definition prefixes. */
const prefixes = { light: "fal", solid: "fas", brands: "fab" };
/** Installed dependencies and generated output do not own application imports. */
const excluded = new Set([
  "node_modules",
  ".output",
  "dist",
  "storybook-static",
  ".turbo",
]);

/**
 * Lists application, story and configuration source without scanning build output.
 * @param directory - Application directory to inspect.
 * @returns Source file paths.
 */
function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (excluded.has(entry.name)) return [];
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && /\.[cm]?[jt]sx?$/u.test(entry.name) ? [path] : [];
  });
}

/**
 * Compares the reviewed inventory with installed Kit definitions and named imports.
 * @returns The number of reviewed bundled icons.
 * @throws When files, Kit exports or source imports disagree with the inventory.
 */
function checkInventory() {
  const manifest = JSON.parse(readFileSync("apps/web/package.json", "utf8"));
  const version = manifest.dependencies?.[kit];
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/u.test(version))
    throw new Error("Pin an exact Kit version in apps/web/package.json");
  for (const name of Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  }))
    if (fullPack.test(name))
      throw new Error(`Remove full icon pack dependency: ${name}`);
  const expected = new Set();
  for (const line of readFileSync("docs/fontawesome-icons.txt", "utf8")
    .trim()
    .split(/\r?\n/u)) {
    const match =
      /^(?:fa-classic fa-(light|solid)|fa-(brands)) fa-([a-z0-9]+(?:-[a-z0-9]+)*)$/u.exec(
        line.trim().replace(/\s+/gu, " "),
      );
    if (!match) throw new Error(`Invalid inventory line: ${line}`);
    const style = match[1] ?? match[2];
    const name = match[3];
    const key = `${style}:${name}`;
    if (expected.has(key)) throw new Error(`Duplicate inventory icon: ${key}`);
    expected.add(key);
  }
  const require = createRequire(resolve("apps/web/package.json"));
  if (require(`${kit}/package.json`).version !== version)
    throw new Error("Installed Kit version differs from the pinned dependency");
  const definitions = Object.fromEntries(
    Object.keys(prefixes).map((style) => [
      style,
      require(`${kit}/icons/classic/${style}`),
    ]),
  );
  const exported = new Set();
  for (const [style, values] of Object.entries(definitions))
    for (const icon of Object.values(values))
      if (icon && Array.isArray(icon.icon)) {
        if (icon.prefix !== prefixes[style])
          throw new Error(
            `Kit style prefix differs for ${style}/${icon.iconName}`,
          );
        exported.add(`${style}:${icon.iconName}`);
      }
  const imported = new Set();
  for (const file of sourceFiles("apps/web")) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    /**
     * Checks module access while collecting individual icon imports.
     * @param node - Source syntax node.
     * @throws When an import uses a full pack, an aggregate, or a missing icon.
     */
    function visit(node) {
      let module;
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        module = node.moduleSpecifier.text;
      else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === "require")) &&
        node.arguments[0] &&
        ts.isStringLiteralLike(node.arguments[0])
      )
        module = node.arguments[0].text;
      if (module && fullPack.test(module))
        throw new Error(`Remove full icon pack import in ${file}: ${module}`);
      if (module === kit || module?.startsWith(`${kit}/`)) {
        const style = module.slice(`${kit}/icons/classic/`.length);
        const bindings =
          ts.isImportDeclaration(node) && node.importClause?.namedBindings;
        if (
          module !== `${kit}/icons/classic/${style}` ||
          !Object.hasOwn(definitions, style) ||
          !bindings ||
          node.importClause.name ||
          !ts.isNamedImports(bindings)
        )
          throw new Error(`Use individual Kit style imports in ${file}`);
        for (const specifier of bindings.elements) {
          const name = (specifier.propertyName ?? specifier.name).text;
          const icon = definitions[style][name];
          if (!icon || !Array.isArray(icon.icon))
            throw new Error(`Missing Kit export ${style}/${name} in ${file}`);
          imported.add(`${style}:${icon.iconName}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  for (const [label, actual] of [
    ["Kit exports", exported],
    ["Source imports", imported],
  ]) {
    const missing = [...expected].filter((name) => !actual.has(name));
    const extra = [...actual].filter((name) => !expected.has(name));
    if (missing.length || extra.length)
      throw new Error(
        `${label} differ from inventory; missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}`,
      );
  }
  return expected.size;
}

try {
  console.log(`Inventory matches ${checkInventory()} bundled Kit icons.`);
} catch (error) {
  console.error(`[icons:check] ${error.message}`);
  process.exitCode = 1;
}
