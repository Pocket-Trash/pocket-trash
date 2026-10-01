import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import YAML from "yaml";

/** Repository root used to resolve diagram inputs and outputs. */
const repoRoot = process.cwd();
/** Infrastructure diagram metadata file. */
const metadataPath = path.join(repoRoot, "docs/infrastructure-diagram.yaml");
/** Workspace roots scanned for package manifests. */
const packageRoots = ["apps", "packages"];
/** Source extensions eligible for runtime dependency detection. */
const sourceExtensions = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);
/** Prefix identifying local workspace dependencies. */
const workspaceDependencyPrefix = "workspace:";
/** Eraser relationship connector used by generated edges. */
const connector = ">";
/** Source detections restored when absent from metadata. */
const defaultDetections = [
  {
    id: "webLogProxy",
    source: "@app/web",
    target: "axiom",
    label: "source scan: browser log proxy -> /api/v0/logs",
    paths: ["apps/web/src/lib/logger.ts"],
    patterns: ["/api/v0/logs", "createProxyTransport"],
  },
  {
    id: "webClerk",
    source: "@app/web",
    target: "clerk",
    label: "source scan: Clerk web SDK",
    paths: ["apps/web/src"],
    patterns: ["@clerk/tanstack-react-start"],
  },
  {
    id: "webAxiom",
    source: "@app/web",
    target: "axiom",
    label: "source scan: createAxiomTransport",
    paths: ["apps/web"],
    patterns: ["createAxiomTransport", "AXIOM_TOKEN"],
  },
];

/**
 * Validates and returns an array metadata value.
 *
 * @param value - Candidate metadata value.
 * @param label - Metadata path used in validation errors.
 * @returns The validated array.
 * @throws When the value is not an array.
 */
function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value;
}

/**
 * Converts a label or package name into an Eraser identifier.
 *
 * @param value - Source label.
 * @returns A normalized identifier.
 */
function createSlug(value) {
  return value
    .replace(/^@/, "")
    .replaceAll("/", "_")
    .replaceAll("-", "_")
    .replaceAll(".", "_")
    .replace(/[^A-Za-z0-9_]/g, "_");
}

/**
 * Escapes a value as an Eraser quoted string.
 *
 * @param value - Value to serialize.
 * @returns The quoted string.
 */
function quote(value) {
  return `"${String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n")}"`;
}

/**
 * Serializes one Eraser attribute value.
 *
 * @param key - Attribute name.
 * @param value - Attribute value.
 * @returns A quoted or safe unquoted value.
 */
function propertyValue(key, value) {
  if (key === "label" || key === "link") {
    return quote(value);
  }

  if (typeof value === "string" && /^[#A-Za-z0-9_<>-]+$/.test(value)) {
    return value;
  }

  return quote(value);
}

/**
 * Serializes populated Eraser attributes.
 *
 * @param attributes - Attribute names and values.
 * @returns A bracketed attribute list, or an empty string.
 */
function properties(attributes) {
  const entries = Object.entries(attributes).filter(
    ([, value]) => value !== undefined && value !== "",
  );

  if (entries.length === 0) {
    return "";
  }

  return ` [${entries.map(([key, value]) => `${key}: ${propertyValue(key, value)}`).join(", ")}]`;
}

/**
 * Indents one generated diagram line.
 *
 * @param indent - Two-space indentation depth.
 * @param value - Line content.
 * @returns The indented line.
 */
function line(indent, value) {
  return `${"  ".repeat(indent)}${value}`;
}

/**
 * Reads and parses a JSON file.
 *
 * @param filePath - JSON file path.
 * @returns The parsed value.
 * @rejects When the file cannot be read or parsed.
 */
async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

/**
 * Tests whether a filesystem path exists.
 *
 * @param filePath - Path to inspect.
 * @returns Whether the path exists.
 * @rejects When filesystem inspection fails for a reason other than absence.
 */
async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

/**
 * Finds package manifests directly beneath configured workspace roots.
 *
 * @returns Sorted absolute manifest paths.
 * @rejects When workspace directories cannot be inspected.
 */
async function findPackageJsonFiles() {
  const files = [];

  for (const root of packageRoots) {
    const rootPath = path.join(repoRoot, root);

    if (!(await pathExists(rootPath))) {
      continue;
    }

    const entries = await readdir(rootPath, { withFileTypes: true });

    for (const entry of entries.sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      if (!entry.isDirectory()) {
        continue;
      }

      const packagePath = path.join(rootPath, entry.name, "package.json");

      if (await pathExists(packagePath)) {
        files.push(packagePath);
      }
    }
  }

  return files.sort((left, right) =>
    path.relative(repoRoot, left).localeCompare(path.relative(repoRoot, right)),
  );
}

/**
 * Loads dependency metadata for every workspace package.
 *
 * @returns Sorted workspace package information.
 * @rejects When package discovery or manifest parsing fails.
 */
async function collectAllWorkspacePackageInfos() {
  const packageJsonFiles = await findPackageJsonFiles();
  const packages = [];

  for (const packageJsonFile of packageJsonFiles) {
    const packageJson = await readJson(packageJsonFile);

    packages.push({
      dependencies: {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      },
      directory: path.relative(repoRoot, path.dirname(packageJsonFile)),
      name: packageJson.name,
    });
  }

  return packages.sort((left, right) =>
    (left.name ?? "").localeCompare(right.name ?? ""),
  );
}

/**
 * Loads workspace packages included by diagram metadata.
 *
 * @param metadata - Infrastructure diagram metadata.
 * @returns Included packages indexed by name.
 * @rejects When metadata or package manifests are invalid.
 */
async function collectWorkspacePackages(metadata) {
  const packageJsonFiles = await findPackageJsonFiles();
  const includedNames = new Set([
    ...assertArray(metadata.scope.apps, "scope.apps"),
    ...assertArray(metadata.scope.packages, "scope.packages"),
  ]);
  const excludedNames = new Set([
    ...assertArray(metadata.scope.excludedApps, "scope.excludedApps"),
    ...assertArray(metadata.scope.excludedPackages, "scope.excludedPackages"),
  ]);
  const packages = new Map();

  for (const packageJsonFile of packageJsonFiles) {
    const packageJson = await readJson(packageJsonFile);
    const packageName = packageJson.name;

    if (!includedNames.has(packageName) || excludedNames.has(packageName)) {
      continue;
    }

    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    packages.set(packageName, {
      dependencies,
      directory: path.relative(repoRoot, path.dirname(packageJsonFile)),
      id: createSlug(packageName),
      name: packageName,
    });
  }

  return new Map(
    [...packages.entries()].sort(([leftName], [rightName]) =>
      leftName.localeCompare(rightName),
    ),
  );
}

/**
 * Finds workspace packages reachable from included applications.
 *
 * @param packageInfos - All workspace package dependency metadata.
 * @param appNames - Application package names that seed traversal.
 * @param excludedNames - Package names excluded from traversal.
 * @returns Reachable package names, including seed applications.
 */
function reachableWorkspacePackageNames(packageInfos, appNames, excludedNames) {
  const packageByName = new Map(
    packageInfos.map((packageInfo) => [packageInfo.name, packageInfo]),
  );
  const reachable = new Set(appNames);
  const pending = [...appNames];

  while (pending.length > 0) {
    const packageName = pending.pop();
    const packageInfo = packageByName.get(packageName);

    if (!packageInfo) {
      continue;
    }

    for (const [dependencyName, dependencyVersion] of Object.entries(
      packageInfo.dependencies,
    )) {
      if (
        !dependencyVersion.startsWith(workspaceDependencyPrefix) ||
        excludedNames.has(dependencyName) ||
        reachable.has(dependencyName)
      ) {
        continue;
      }

      reachable.add(dependencyName);
      pending.push(dependencyName);
    }
  }

  return reachable;
}

/**
 * Refreshes generated scope and default detections in diagram metadata.
 *
 * @param metadata - Existing infrastructure diagram metadata.
 * @returns Refreshed metadata without writing it.
 * @rejects When workspace discovery or metadata validation fails.
 */
async function refreshMetadata(metadata) {
  const packageInfos = await collectAllWorkspacePackageInfos();
  const excludedApps = new Set(
    assertArray(metadata.scope.excludedApps, "scope.excludedApps"),
  );
  const excludedPackages = new Set(
    assertArray(metadata.scope.excludedPackages, "scope.excludedPackages"),
  );
  const appNames = packageInfos
    .filter((packageInfo) => packageInfo.name.startsWith("@app/"))
    .map((packageInfo) => packageInfo.name)
    .filter((packageName) => !excludedApps.has(packageName));
  const allExcludedNames = new Set([...excludedApps, ...excludedPackages]);
  const reachableNames = reachableWorkspacePackageNames(
    packageInfos,
    appNames,
    allExcludedNames,
  );
  const currentPackageNames = new Set(
    assertArray(metadata.scope.packages, "scope.packages"),
  );
  const packageNames = packageInfos
    .filter((packageInfo) => packageInfo.name.startsWith("@package/"))
    .map((packageInfo) => packageInfo.name)
    .filter(
      (packageName) =>
        !excludedPackages.has(packageName) &&
        (reachableNames.has(packageName) ||
          currentPackageNames.has(packageName)),
    );
  const currentDetectionIds = new Set(
    assertArray(metadata.detections, "detections").map(
      (detection) => detection.id,
    ),
  );
  const detections = [
    ...metadata.detections,
    ...defaultDetections.filter(
      (detection) => !currentDetectionIds.has(detection.id),
    ),
  ];

  return {
    ...metadata,
    generatedBy: "pnpm diagram:infra",
    output: "docs/infrastructure-diagram.eraser",
    source: "docs/infrastructure-diagram.yaml",
    scope: {
      ...metadata.scope,
      apps: appNames,
      packages: packageNames,
      excludedApps: [...excludedApps],
      excludedPackages: [...excludedPackages],
    },
    detections,
  };
}

/**
 * Collects diagram edges for local workspace dependencies.
 *
 * @param packages - Included packages indexed by name.
 * @returns Package dependency edges.
 */
function collectManifestEdges(packages) {
  const edges = [];

  for (const sourcePackage of packages.values()) {
    for (const [dependencyName, dependencyVersion] of Object.entries(
      sourcePackage.dependencies,
    )) {
      if (
        !dependencyVersion.startsWith(workspaceDependencyPrefix) ||
        !packages.has(dependencyName)
      ) {
        continue;
      }

      edges.push({
        from: sourcePackage.id,
        label: "workspace dependency",
        source: "package.json",
        to: packages.get(dependencyName).id,
      });
    }
  }

  return edges;
}

/**
 * Recursively collects eligible source files beneath a path.
 *
 * @param targetPath - Repository-relative file or directory path.
 * @returns Sorted absolute source file paths.
 * @rejects When the target tree cannot be inspected.
 */
async function collectSourceFiles(targetPath) {
  const fullPath = path.join(repoRoot, targetPath);
  const stats = await stat(fullPath);

  if (stats.isFile()) {
    return [fullPath];
  }

  const entries = await readdir(fullPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name === ".output"
    ) {
      continue;
    }

    const entryPath = path.join(fullPath, entry.name);

    if (entry.isDirectory()) {
      files.push(
        ...(await collectSourceFiles(path.relative(repoRoot, entryPath))),
      );
      continue;
    }

    if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files.sort((left, right) =>
    path.relative(repoRoot, left).localeCompare(path.relative(repoRoot, right)),
  );
}

/**
 * Tests whether every configured detection pattern exists in its source paths.
 *
 * @param detection - Source detection metadata.
 * @returns Whether all patterns were found.
 * @rejects When metadata is invalid or source files cannot be read.
 */
async function detectionMatches(detection) {
  const patterns = assertArray(
    detection.patterns,
    `detections.${detection.id}.patterns`,
  );
  const remainingPatterns = new Set(patterns);

  for (const detectionPath of assertArray(
    detection.paths,
    `detections.${detection.id}.paths`,
  )) {
    if (!(await pathExists(path.join(repoRoot, detectionPath)))) {
      continue;
    }

    const files = await collectSourceFiles(detectionPath);

    for (const file of files) {
      const contents = await readFile(file, "utf8");

      for (const pattern of patterns) {
        if (contents.includes(pattern)) {
          remainingPatterns.delete(pattern);
        }
      }

      if (remainingPatterns.size === 0) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Collects runtime relationship edges confirmed by source detections.
 *
 * @param metadata - Infrastructure diagram metadata.
 * @param packages - Included packages indexed by name.
 * @returns Confirmed source detection edges.
 * @rejects When references, detections, or source access are invalid.
 */
async function collectDetectionEdges(metadata, packages) {
  const edges = [];
  const serviceIds = new Set(
    assertArray(metadata.services, "services").map((service) => service.id),
  );
  const packageNames = new Set(packages.keys());

  for (const detection of assertArray(metadata.detections, "detections")) {
    if (!packageNames.has(detection.source)) {
      throw new Error(
        `detections.${detection.id}.source must reference an included workspace package.`,
      );
    }

    if (
      !packageNames.has(detection.target) &&
      !serviceIds.has(detection.target)
    ) {
      throw new Error(
        `detections.${detection.id}.target must reference an included workspace package or service.`,
      );
    }

    if (!(await detectionMatches(detection))) {
      continue;
    }

    const source = packages.get(detection.source);
    const target = packages.get(detection.target);
    const targetId =
      target?.id ??
      (serviceIds.has(detection.target)
        ? `service_${detection.target}`
        : undefined);

    edges.push({
      from: source.id,
      label: detection.label,
      source: "source scan",
      to: targetId,
    });
  }

  return edges;
}

/**
 * Indexes configured external services by identifier.
 *
 * @param metadata - Infrastructure diagram metadata.
 * @returns Services indexed by identifier.
 */
function createServiceMap(metadata) {
  return new Map(
    assertArray(metadata.services, "services").map((service) => [
      service.id,
      service,
    ]),
  );
}

/**
 * Renders one Eraser node definition.
 *
 * @param id - Node identifier.
 * @param node - Node metadata.
 * @param serviceMap - Services indexed by identifier.
 * @returns The rendered node definition.
 */
function createNodeDefinition(id, node, serviceMap) {
  const service = serviceMap.get(node.service);
  const attributes = {
    color: service?.color,
    icon: service?.icon ?? node.icon,
    label: node.label,
  };

  return `${id}${properties(attributes)}`;
}

/**
 * Renders one Eraser relationship definition.
 *
 * @param edge - Relationship endpoints and optional label.
 * @returns The rendered edge definition.
 */
function createEdgeDefinition(edge) {
  const labelText = edge.label ? `: ${edge.label}` : "";
  return `${edge.from} ${connector} ${edge.to}${labelText}`;
}

/**
 * Removes duplicate edges while preserving encounter order.
 *
 * @param edges - Candidate diagram edges.
 * @returns Unique edges by endpoints and label.
 */
function uniqueEdges(edges) {
  const seen = new Set();
  const output = [];

  for (const edge of edges) {
    const key = `${edge.from}\t${edge.to}\t${edge.label}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(edge);
  }

  return output;
}

/**
 * Renders one deployment environment and its relationships.
 *
 * @param environment - Environment metadata.
 * @param serviceMap - Services indexed by identifier.
 * @returns Generated Eraser lines.
 */
function renderEnvironment(environment, serviceMap) {
  const output = [];
  const nodesByGroup = new Map();

  for (const node of assertArray(
    environment.nodes,
    `environments.${environment.id}.nodes`,
  )) {
    const group = node.group ?? "Services";
    const groupNodes = nodesByGroup.get(group) ?? [];
    groupNodes.push(node);
    nodesByGroup.set(group, groupNodes);
  }

  output.push(
    line(
      0,
      `${environment.id}${properties({ color: environment.color, label: environment.label })} {`,
    ),
  );

  for (const [group, nodes] of nodesByGroup) {
    const groupId = `${environment.id}_${createSlug(group)}`;
    output.push(line(1, `${groupId}${properties({ label: group })} {`));

    for (const node of nodes) {
      output.push(line(2, createNodeDefinition(node.id, node, serviceMap)));
    }

    output.push(line(1, "}"));
  }

  output.push(line(0, "}"));
  output.push("");

  for (const edge of assertArray(
    environment.edges,
    `environments.${environment.id}.edges`,
  )) {
    output.push(line(0, createEdgeDefinition(edge)));
  }

  return output;
}

/**
 * Renders shared packages, services, and detected relationships.
 *
 * @param packages - Included packages indexed by name.
 * @param manifestEdges - Workspace dependency edges.
 * @param detectionEdges - Source-detected runtime edges.
 * @param serviceMap - Services indexed by identifier.
 * @returns Generated Eraser lines.
 */
function renderSharedPackages(
  packages,
  manifestEdges,
  detectionEdges,
  serviceMap,
) {
  const output = [];

  output.push(
    'shared_packages [label: "Shared packages and detected runtime links", color: "gray"] {',
  );

  for (const packageInfo of packages.values()) {
    output.push(
      line(
        1,
        `${packageInfo.id}${properties({
          icon: packageInfo.name.startsWith("@app/") ? "box" : "package",
          label: `${packageInfo.name}\n${packageInfo.directory}`,
        })}`,
      ),
    );
  }

  for (const service of serviceMap.values()) {
    output.push(
      line(
        1,
        `service_${service.id}${properties({
          color: service.color,
          icon: service.icon,
          label: service.label,
        })}`,
      ),
    );
  }

  output.push("}");
  output.push("");

  for (const edge of uniqueEdges([...manifestEdges, ...detectionEdges])) {
    output.push(createEdgeDefinition(edge));
  }

  return output;
}

/**
 * Renders the diagram legend.
 *
 * @returns Generated Eraser legend lines.
 */
function renderLegend() {
  return [
    "",
    `legend${properties({ position: "bottom-right" })} {`,
    `  ${properties({ connection: connector, label: "Runtime or deployment relationship" })}`,
    `  ${properties({ color: "gray", label: "Shared code or tooling" })}`,
    `  ${properties({ color: "green", label: "Production" })}`,
    `  ${properties({ color: "blue", label: "Preview" })}`,
    `  ${properties({ color: "yellow", label: "Development" })}`,
    "}",
  ];
}

/**
 * Renders unsaved interactive feedback lines.
 *
 * @param feedbackOverlay - User-provided Eraser lines or comments.
 * @returns Generated overlay lines.
 */
function renderFeedbackOverlay(feedbackOverlay) {
  if (feedbackOverlay.length === 0) {
    return [];
  }

  return [
    "",
    "// Interactive feedback overlay. Move durable changes into docs/infrastructure-diagram.yaml.",
    ...feedbackOverlay,
  ];
}

/**
 * Generates a complete Eraser infrastructure diagram.
 *
 * @param metadata - Infrastructure diagram metadata.
 * @param feedbackOverlay - Unsaved interactive additions.
 * @returns The generated Eraser diagram source.
 * @rejects When metadata validation or workspace detection fails.
 */
async function generateDiagram(metadata, feedbackOverlay = []) {
  const packages = await collectWorkspacePackages(metadata);
  const serviceMap = createServiceMap(metadata);
  const manifestEdges = collectManifestEdges(packages);
  const detectionEdges = await collectDetectionEdges(metadata, packages);
  const output = [
    `// ${metadata.title}`,
    `// Generated by \`${metadata.generatedBy}\` from \`${metadata.source}\`.`,
    "// Edit the YAML metadata, then rerun the generator.",
    "direction right",
    "colorMode pastel",
    "styleMode plain",
    "typeface clean",
    "",
  ];

  for (const environment of assertArray(
    metadata.environments,
    "environments",
  )) {
    output.push(...renderEnvironment(environment, serviceMap), "");
  }

  output.push(
    ...renderSharedPackages(
      packages,
      manifestEdges,
      detectionEdges,
      serviceMap,
    ),
  );
  output.push(...renderFeedbackOverlay(feedbackOverlay));
  output.push(...renderLegend());

  return `${output.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

/**
 * Loads parsed infrastructure diagram metadata.
 *
 * @returns Parsed YAML metadata.
 * @rejects When the metadata file cannot be read or parsed.
 */
async function loadMetadata() {
  return YAML.parse(await readFile(metadataPath, "utf8"));
}

/**
 * Loads the editable YAML metadata document.
 *
 * @returns The parsed YAML document.
 * @rejects When the metadata file cannot be read or parsed.
 */
async function loadMetadataDocument() {
  const document = YAML.parseDocument(await readFile(metadataPath, "utf8"));

  if (document.errors.length > 0) {
    throw document.errors[0];
  }

  return document;
}

/**
 * Refreshes generated metadata fields and writes the YAML file.
 *
 * @returns The refreshed plain metadata value.
 * @rejects When discovery, parsing, or writing fails.
 */
async function refreshMetadataFile() {
  const document = await loadMetadataDocument();
  const refreshedMetadata = await refreshMetadata(document.toJS());

  document.set("generatedBy", refreshedMetadata.generatedBy);
  document.set("output", refreshedMetadata.output);
  document.set("source", refreshedMetadata.source);
  document.setIn(["scope", "apps"], refreshedMetadata.scope.apps);
  document.setIn(["scope", "packages"], refreshedMetadata.scope.packages);
  document.setIn(
    ["scope", "excludedApps"],
    refreshedMetadata.scope.excludedApps,
  );
  document.setIn(
    ["scope", "excludedPackages"],
    refreshedMetadata.scope.excludedPackages,
  );

  const detectionsNode = document.get("detections", true);

  if (refreshedMetadata.detections.length !== detectionsNode.items.length) {
    document.set("detections", refreshedMetadata.detections);
  }

  await writeFile(metadataPath, String(document));
  process.stdout.write("Wrote docs/infrastructure-diagram.yaml\n");

  return refreshedMetadata;
}

/**
 * Writes generated diagram source between terminal delimiters.
 *
 * @param diagram - Eraser diagram source.
 */
function printDiagram(diagram) {
  process.stdout.write("\n--- Eraser diagram code ---\n\n");
  process.stdout.write(diagram);
  process.stdout.write("\n--- End diagram code ---\n\n");
}

/**
 * Writes generated diagram source to its configured output path.
 *
 * @param metadata - Metadata containing the output path.
 * @param diagram - Eraser diagram source.
 * @returns A promise that settles after the file is written.
 * @rejects When the output file cannot be written.
 */
async function writeDiagram(metadata, diagram) {
  await writeFile(path.join(repoRoot, metadata.output), diagram);
}

/**
 * Generates and writes the diagram once.
 *
 * @param options - One-shot generation options.
 * @param options.print - Whether to also print generated source.
 * @param options.refresh - Whether to refresh metadata before generation.
 * @returns A promise that settles after generation and writing.
 * @rejects When refresh, generation, or writing fails.
 */
async function runOnce({ print = false, refresh = false } = {}) {
  const metadata = refresh ? await refreshMetadataFile() : await loadMetadata();
  const diagram = await generateDiagram(metadata);

  if (print) {
    printDiagram(diagram);
  }

  await writeDiagram(metadata, diagram);
  process.stdout.write(`Wrote ${metadata.output}\n`);
}

/**
 * Runs the terminal feedback loop for diagram generation.
 *
 * @returns A promise that settles after writing or quitting.
 * @rejects When metadata, generation, input, or writing fails.
 */
async function runInteractive() {
  const feedbackOverlay = [];
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      const metadata = await loadMetadata();
      const diagram = await generateDiagram(metadata, feedbackOverlay);
      printDiagram(diagram);

      const answer = (
        await rl.question(
          "Type 'write', 'refresh', 'regen', 'quit', 'edge <from> > <to>: <label>', or 'append <Eraser code>': ",
        )
      ).trim();
      const normalizedAnswer = answer.toLowerCase();

      if (
        normalizedAnswer === "write" ||
        normalizedAnswer === "accept" ||
        normalizedAnswer === "yes"
      ) {
        await writeDiagram(metadata, diagram);
        process.stdout.write(`Wrote ${metadata.output}\n`);
        return;
      }

      if (
        normalizedAnswer === "quit" ||
        normalizedAnswer === "exit" ||
        normalizedAnswer === "q"
      ) {
        process.stdout.write("No diagram file written.\n");
        return;
      }

      if (normalizedAnswer === "regen" || normalizedAnswer === "") {
        continue;
      }

      if (normalizedAnswer === "refresh") {
        await refreshMetadataFile();
        continue;
      }

      if (answer.startsWith("edge ")) {
        feedbackOverlay.push(answer.slice("edge ".length));
        continue;
      }

      if (answer.startsWith("append ")) {
        feedbackOverlay.push(answer.slice("append ".length));
        continue;
      }

      feedbackOverlay.push(`// Feedback: ${answer}`);
    }
  } finally {
    rl.close();
  }
}

/** Command-line flags controlling diagram generation mode. */
const args = new Set(process.argv.slice(2));

if (args.has("--once")) {
  await runOnce({
    print: args.has("--print"),
    refresh: args.has("--refresh-metadata"),
  });
} else if (args.has("--refresh-metadata")) {
  await refreshMetadataFile();
  await runInteractive();
} else if (!process.stdin.isTTY) {
  await runOnce();
} else {
  await runInteractive();
}
