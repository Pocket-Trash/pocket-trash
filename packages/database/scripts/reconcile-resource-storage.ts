import { type NeonQueryFunction, neon } from "@neondatabase/serverless";

export type StoredObject = {
  branchName: string;
  database: NeonQueryFunction<false, false>;
  id: number;
  objectPath: string;
  resourceId: number;
  table: "image" | "legacy-image" | "legacy-resource" | "resource";
};

type BunnyObject = {
  IsDirectory?: boolean;
  ObjectName?: string;
};

type NeonBranch = {
  id: string;
  name: string;
};

type ObjectMove = {
  destination: string;
  records: StoredObject[];
  source: string;
};

type BunnyConfig = {
  accessKey: string;
  endpoint: string;
  zoneName: string;
};

const resourceRoot = "resources";

export function branchResourcePrefix(branchName: string): string | undefined {
  if (branchName === "production") return undefined;
  if (branchName === "preview") return `${resourceRoot}/preview`;

  const previewPullRequest = /^preview-pr-(\d+)$/u.exec(branchName);
  if (previewPullRequest)
    return `${resourceRoot}/preview/pr-${previewPullRequest[1]}`;

  return `${resourceRoot}/dev`;
}

export function destinationPath(
  branchName: string,
  resourceId: number,
  objectPath: string,
): string {
  const prefix = branchResourcePrefix(branchName);
  if (!prefix)
    throw new Error(`No Bunny resource prefix exists for ${branchName}.`);
  return `${prefix}/${resourceId}/${baseName(objectPath)}`;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const bunnyConfig = {
    accessKey: required("BUNNY_STORAGE_ACCESS_KEY"),
    endpoint: trimTrailingSlash(required("BUNNY_STORAGE_ENDPOINT")),
    zoneName: required("BUNNY_STORAGE_ZONE_NAME"),
  };
  const cdnBaseUrl = trimTrailingSlash(required("BUNNY_CDN_BASE_URL"));
  const branches = await listNeonBranches();
  const records: StoredObject[] = [];
  const pendingPaths = new Set<string>();

  for (const branch of branches) {
    if (!branchResourcePrefix(branch.name)) {
      console.log(`SKIP ${branch.name}: production is out of scope.`);
      continue;
    }

    const database = neon(await getBranchDatabaseUrl(branch.id));
    if (!(await tableExists(database, "resources"))) {
      console.log(`SKIP ${branch.name}: no resources table.`);
      continue;
    }

    const branchRecords = await getStoredObjects(branch.name, database);
    records.push(...branchRecords);
    for (const path of await getPendingUploadPaths(database))
      pendingPaths.add(path);
    console.log(`FOUND ${branch.name}: ${branchRecords.length} reference(s).`);
  }

  const moves = buildMoves(records);
  const finalReferences = new Set([
    ...records.map(
      (record) =>
        moves.find(({ records: moved }) => moved.includes(record))
          ?.destination ?? record.objectPath,
    ),
    ...pendingPaths,
  ]);
  const existing = await listFiles(resourceRoot, bunnyConfig);
  const protectedPaths = new Set([
    ...finalReferences,
    ...moves.map(({ source }) => source),
  ]);
  const orphans = existing.filter((path) => !protectedPaths.has(path));

  console.log(
    `${apply ? "Applying" : "Dry run:"} ${moves.length} move(s), ${orphans.length} orphan deletion(s).`,
  );
  for (const { destination, source } of moves)
    console.log(`MOVE ${source} -> ${destination}`);
  for (const objectPath of orphans) console.log(`DELETE ${objectPath}`);

  if (!apply) {
    console.log("Run again with --apply to make these changes.");
    return;
  }

  for (const move of moves) {
    await moveObject(move.source, move.destination, bunnyConfig);
    const url = `${cdnBaseUrl}/${encodePath(move.destination)}`;
    for (const record of move.records)
      await updateStoredObject(record, move.destination, url);
  }

  for (const source of new Set(moves.map(({ source }) => source)))
    await bunnyRequest(source, "DELETE", [200, 404], bunnyConfig);

  for (const objectPath of orphans)
    await bunnyRequest(objectPath, "DELETE", [200, 404], bunnyConfig);

  console.log("Resource storage reconciliation complete.");
}

async function listNeonBranches(): Promise<NeonBranch[]> {
  const response = await neonRequest(
    `/projects/${encodeURIComponent(required("NEON_PROJECT_ID"))}/branches?limit=10000&sort_by=name&sort_order=asc`,
  );
  const result = (await response.json()) as { branches?: NeonBranch[] };
  if (!Array.isArray(result.branches))
    throw new Error("Neon branch response was invalid.");
  return result.branches;
}

async function getBranchDatabaseUrl(branchId: string): Promise<string> {
  const query = new URLSearchParams({
    branch_id: branchId,
    database_name: required("NEON_DATABASE_NAME"),
    pooled: "true",
    role_name: required("NEON_DATABASE_USER"),
  });
  const response = await neonRequest(
    `/projects/${encodeURIComponent(required("NEON_PROJECT_ID"))}/connection_uri?${query.toString()}`,
  );
  const result = (await response.json()) as { uri?: string };
  if (!result.uri) throw new Error(`Neon returned no URI for ${branchId}.`);
  return result.uri;
}

async function neonRequest(path: string): Promise<Response> {
  const baseUrl = trimTrailingSlash(
    process.env.NEON_API_BASE?.trim() || "https://console.neon.tech/api/v2",
  );
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${required("NEON_API_KEY")}` },
  });
  if (!response.ok)
    throw new Error(`Neon request failed (${response.status}): ${path}`);
  return response;
}

async function tableExists(
  database: NeonQueryFunction<false, false>,
  tableName: string,
): Promise<boolean> {
  const rows = await database`
    select to_regclass(${`public.${tableName}`}) is not null as exists
  `;
  return rows[0]?.exists === true;
}

async function columnExists(
  database: NeonQueryFunction<false, false>,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const rows = await database`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${tableName}
        and column_name = ${columnName}
    ) as exists
  `;
  return rows[0]?.exists === true;
}

async function getStoredObjects(
  branchName: string,
  database: NeonQueryFunction<false, false>,
): Promise<StoredObject[]> {
  const records: StoredObject[] = [];

  if (await tableExists(database, "resource_files")) {
    const rows = await database`
      select resource_files.id, resource_versions.resource_id,
        resource_files.object_path
      from resource_files
      inner join resource_versions
        on resource_versions.id = resource_files.version_id
    `;
    records.push(
      ...rows.map((row) => storedObject(branchName, database, row, "resource")),
    );
  }

  if (await tableExists(database, "resource_images")) {
    const rows = await database`
      select id, resource_id, object_path
      from resource_images
    `;
    records.push(
      ...rows.map((row) => storedObject(branchName, database, row, "image")),
    );
  } else if (
    await columnExists(database, "resources", "preview_image_object_path")
  ) {
    const rows = await database`
      select id, id as resource_id, preview_image_object_path as object_path
      from resources
      where preview_image_object_path is not null
    `;
    records.push(
      ...rows.map((row) =>
        storedObject(branchName, database, row, "legacy-image"),
      ),
    );
  }

  if (
    (await tableExists(database, "resource_versions")) &&
    (await columnExists(database, "resource_versions", "object_path"))
  ) {
    const rows = await database`
      select id, resource_id, object_path
      from resource_versions
      where object_path is not null
    `;
    records.push(
      ...rows.map((row) =>
        storedObject(branchName, database, row, "legacy-resource"),
      ),
    );
  }

  return records;
}

function storedObject(
  branchName: string,
  database: NeonQueryFunction<false, false>,
  row: Record<string, unknown>,
  table: StoredObject["table"],
): StoredObject {
  const id = Number(row.id);
  const resourceId = Number(row.resource_id);
  const objectPath = String(row.object_path);
  if (!Number.isSafeInteger(id) || !Number.isSafeInteger(resourceId))
    throw new Error(`Invalid resource reference in ${branchName}.`);
  return { branchName, database, id, objectPath, resourceId, table };
}

async function getPendingUploadPaths(
  database: NeonQueryFunction<false, false>,
): Promise<string[]> {
  if (!(await tableExists(database, "resource_upload_files"))) return [];
  const rows = await database`select object_path from resource_upload_files`;
  return rows.map((row) => String(row.object_path));
}

export function buildMoves(records: StoredObject[]): ObjectMove[] {
  const moves = new Map<string, ObjectMove>();
  const sourcesByDestination = new Map<string, string>();

  for (const record of records) {
    const destination = destinationPath(
      record.branchName,
      record.resourceId,
      record.objectPath,
    );
    if (destination === record.objectPath) continue;

    const existingSource = sourcesByDestination.get(destination);
    if (existingSource && existingSource !== record.objectPath) {
      throw new Error(
        `Multiple Bunny objects would overwrite ${destination}: ${existingSource}, ${record.objectPath}`,
      );
    }
    sourcesByDestination.set(destination, record.objectPath);

    const key = `${record.objectPath}\0${destination}`;
    const existing = moves.get(key);
    if (existing) {
      existing.records.push(record);
    } else {
      moves.set(key, {
        destination,
        records: [record],
        source: record.objectPath,
      });
    }
  }

  return [...moves.values()];
}

async function updateStoredObject(
  record: StoredObject,
  objectPath: string,
  url: string,
): Promise<void> {
  if (record.table === "resource") {
    await record.database`
      update resource_files
      set object_path = ${objectPath}, url = ${url}
      where id = ${record.id}
    `;
  } else if (record.table === "image") {
    await record.database`
      update resource_images
      set object_path = ${objectPath}, url = ${url}
      where id = ${record.id}
    `;
  } else if (record.table === "legacy-image") {
    await record.database`
      update resources
      set preview_image_object_path = ${objectPath}, preview_image_url = ${url}
      where id = ${record.id}
    `;
  } else {
    await record.database`
      update resource_versions
      set object_path = ${objectPath}, url = ${url}
      where id = ${record.id}
    `;
  }
}

async function moveObject(
  source: string,
  destination: string,
  config: BunnyConfig,
): Promise<void> {
  const sourceResponse = await bunnyRequest(source, "GET", [200, 404], config);
  if (sourceResponse.status === 404) {
    const destinationResponse = await bunnyRequest(
      destination,
      "GET",
      [200, 404],
      config,
    );
    if (destinationResponse.status === 404)
      throw new Error(`Referenced Bunny object is missing: ${source}`);
    return;
  }

  if (!sourceResponse.body)
    throw new Error(`Bunny returned no body: ${source}`);
  await bunnyRequest(
    destination,
    "PUT",
    [200, 201],
    config,
    sourceResponse.body,
    {
      "content-type":
        sourceResponse.headers.get("content-type") ??
        "application/octet-stream",
    },
  );
}

async function listFiles(
  folder: string,
  config: BunnyConfig,
): Promise<string[]> {
  const response = await bunnyRequest(`${folder}/`, "GET", [200, 404], config);
  if (response.status === 404) return [];
  const objects: unknown = await response.json();
  if (!Array.isArray(objects))
    throw new Error("Bunny list response was invalid.");

  const files: string[] = [];
  for (const object of objects as BunnyObject[]) {
    if (!object.ObjectName) continue;
    const objectPath = `${folder}/${safeName(object.ObjectName)}`;
    if (object.IsDirectory)
      files.push(...(await listFiles(objectPath, config)));
    else files.push(objectPath);
  }
  return files;
}

async function bunnyRequest(
  objectPath: string,
  method: "DELETE" | "GET" | "PUT",
  expectedStatuses: number[],
  config: BunnyConfig,
  body?: ReadableStream<Uint8Array>,
  headers?: HeadersInit,
): Promise<Response> {
  const init: RequestInit & { duplex?: "half" } = {
    body,
    headers: { AccessKey: config.accessKey, ...headers },
    method,
  };
  if (body) init.duplex = "half";
  const response = await fetch(
    `${config.endpoint}/${encodeURIComponent(config.zoneName)}/${encodePath(objectPath)}`,
    init,
  );
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `Bunny ${method} failed for ${objectPath}: ${response.status}`,
    );
  }
  return response;
}

function encodePath(objectPath: string): string {
  return objectPath.split("/").map(encodeURIComponent).join("/");
}

function baseName(objectPath: string): string {
  const name = objectPath.split("/").at(-1);
  if (!name) throw new Error(`Object path has no filename: ${objectPath}`);
  return safeName(name);
}

function safeName(name: string): string {
  if (
    !name ||
    name === "." ||
    name === ".." ||
    name.includes("/") ||
    name.includes("\\")
  ) {
    throw new Error(`Unsafe Bunny object name: ${name}`);
  }
  return name;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, "");
}

if (process.env.NODE_ENV !== "test") await main();
