import { type NeonQueryFunction, neon } from "@neondatabase/serverless";

/**
 * Database record that points to a Bunny-hosted resource object.
 *
 * @internal
 */
export type StoredObject = {
  /** Neon branch containing the reference. */
  branchName: string;
  /** Query function for the branch database. */
  database: NeonQueryFunction<false, false>;
  /** Primary key of the referencing row. */
  id: number;
  /** Current Bunny object path stored in the row. */
  objectPath: string;
  /** Resource identifier that owns the object. */
  resourceId: number;
  /** Current or legacy table shape containing the reference. */
  table: "archive" | "image" | "legacy-image" | "legacy-resource" | "resource";
};

/** Relevant object metadata returned by the Bunny Storage API. */
type BunnyObject = {
  /** Whether the entry represents a directory. */
  IsDirectory?: boolean;
  /** Object or directory name relative to the listed folder. */
  ObjectName?: string;
};

/** Neon branch identity returned by the Neon API. */
type NeonBranch = {
  /** Neon branch identifier. */
  id: string;
  /** Human-readable Neon branch name. */
  name: string;
};

/** One Bunny object move and all database references it satisfies. */
type ObjectMove = {
  /** Canonical destination object path. */
  destination: string;
  /** Database records updated after the object moves. */
  records: StoredObject[];
  /** Existing Bunny object path. */
  source: string;
};

/** Credentials and endpoint used for Bunny Storage requests. */
type BunnyConfig = {
  /** Bunny Storage API access key. */
  accessKey: string;
  /** Bunny Storage API endpoint without a trailing slash. */
  endpoint: string;
  /** Bunny storage-zone name. */
  zoneName: string;
};

/** Top-level Bunny folder containing resource objects. */
const resourceRoot = "resources";

/**
 * Maps a non-production Neon branch to its canonical Bunny resource prefix.
 *
 * @param branchName - Neon branch name.
 * @returns The branch prefix, or `undefined` for production.
 * @internal
 */
export function branchResourcePrefix(branchName: string): string | undefined {
  if (branchName === "production") return undefined;
  if (branchName === "preview") return `${resourceRoot}/preview`;

  const previewPullRequest = /^preview-pr-(\d+)$/u.exec(branchName);
  if (previewPullRequest)
    return `${resourceRoot}/preview/pr-${previewPullRequest[1]}`;

  return `${resourceRoot}/dev`;
}

/**
 * Builds the canonical Bunny path for a referenced resource object.
 *
 * @param branchName - Neon branch containing the reference.
 * @param resourceId - Resource identifier that owns the object.
 * @param objectPath - Existing Bunny object path.
 * @returns The canonical branch-scoped object path.
 * @throws When the branch is production or the object path has no safe filename.
 * @internal
 */
export function destinationPath(
  branchName: string,
  resourceId: number,
  objectPath: string,
): string {
  const prefix = branchResourcePrefix(branchName);
  if (!prefix)
    throw new Error(`No Bunny resource prefix exists for ${branchName}.`);
  if (
    /^images\/(?:dev\/|preview\/(?:pr-[1-9]\d*\/)?)?resources\//u.test(
      objectPath,
    )
  ) {
    return `${prefix.replace(/^resources/u, "images")}/resources/${resourceId}/${baseName(objectPath)}`;
  }
  const version =
    /^resources\/(?:files|dev|preview(?:\/pr-[1-9]\d*)?)\/\d+\/(v[1-9]\d*)\/[^/]+$/u.exec(
      objectPath,
    )?.[1];
  return `${prefix}/${resourceId}/${version ? `${version}/` : ""}${baseName(objectPath)}`;
}

/**
 * Plans non-production storage reconciliation and applies it only with `--apply`.
 *
 * @rejects When configuration, Neon, database, or Bunny operations fail.
 */
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

/**
 * Lists every branch in the configured Neon project.
 *
 * @returns Neon branch identities sorted by the API.
 * @rejects When configuration is missing, the request fails, or Neon returns an
 * invalid branch payload.
 */
async function listNeonBranches(): Promise<NeonBranch[]> {
  const response = await neonRequest(
    `/projects/${encodeURIComponent(required("NEON_PROJECT_ID"))}/branches?limit=10000&sort_by=name&sort_order=asc`,
  );
  const result = (await response.json()) as {
    /** Branches returned by Neon. */
    branches?: NeonBranch[];
  };
  if (!Array.isArray(result.branches))
    throw new Error("Neon branch response was invalid.");
  return result.branches;
}

/**
 * Requests a pooled connection URL for a Neon branch.
 *
 * @param branchId - Neon branch identifier.
 * @returns The branch database connection URL.
 * @rejects When configuration is missing, the request fails, or Neon omits the
 * connection URI.
 */
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
  const result = (await response.json()) as {
    /** Pooled branch connection URI returned by Neon. */
    uri?: string;
  };
  if (!result.uri) throw new Error(`Neon returned no URI for ${branchId}.`);
  return result.uri;
}

/**
 * Sends an authenticated request to the configured Neon API.
 *
 * @param path - API path including its leading slash.
 * @returns The successful HTTP response.
 * @rejects When the API key is missing, Neon returns a non-success status, or
 * the request fails.
 */
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

/**
 * Checks whether a public table exists in a branch database.
 *
 * @param database - Branch query function.
 * @param tableName - Unqualified public table name.
 * @returns Whether PostgreSQL resolves the table name.
 * @rejects When the database query fails.
 */
async function tableExists(
  database: NeonQueryFunction<false, false>,
  tableName: string,
): Promise<boolean> {
  const rows = await database`
    select to_regclass(${`public.${tableName}`}) is not null as exists
  `;
  return rows[0]?.exists === true;
}

/**
 * Checks whether a column exists on a public table.
 *
 * @param database - Branch query function.
 * @param tableName - Unqualified public table name.
 * @param columnName - Column name to locate.
 * @returns Whether the information schema contains the column.
 * @rejects When the database query fails.
 */
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

/**
 * Collects current and legacy resource-object references from a branch.
 *
 * @param branchName - Neon branch name attached to collected records.
 * @param database - Branch query function.
 * @returns All supported storage references present in the branch schema.
 * @rejects When a database query fails or a reference contains invalid identifiers.
 */
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

  if (
    (await tableExists(database, "resource_versions")) &&
    (await columnExists(database, "resource_versions", "archive_object_path"))
  ) {
    const rows = await database`
      select id, resource_id, archive_object_path as object_path
      from resource_versions
      where archive_object_path is not null
    `;
    records.push(
      ...rows.map((row) => storedObject(branchName, database, row, "archive")),
    );
  }

  return records;
}

/**
 * Converts a database row into a validated storage reference.
 *
 * @param branchName - Neon branch containing the row.
 * @param database - Query function for the branch database.
 * @param row - Raw query result containing IDs and an object path.
 * @param table - Row shape that produced the reference.
 * @returns A normalized storage reference.
 * @throws When either identifier is not a safe integer.
 */
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

/**
 * Collects paths reserved by pending uploads or deletions.
 *
 * @param database - Branch query function.
 * @returns Reserved object paths from every supported schema generation.
 * @rejects When a database query fails.
 * @internal
 */
export async function getPendingUploadPaths(
  database: NeonQueryFunction<false, false>,
): Promise<string[]> {
  const paths: string[] = [];
  if (await tableExists(database, "upload_file")) {
    const rows = await database`select object_path from upload_file`;
    paths.push(...rows.map((row) => String(row.object_path)));
  }
  if (await tableExists(database, "storage_object_deletion")) {
    const rows =
      await database`select object_path from storage_object_deletion`;
    paths.push(...rows.map((row) => String(row.object_path)));
  }
  // Older preview branches still reserve uploads in the previous table.
  if (await tableExists(database, "resource_upload_files")) {
    const rows = await database`select object_path from resource_upload_files`;
    paths.push(...rows.map((row) => String(row.object_path)));
  }
  return paths;
}

/**
 * Groups storage references into non-conflicting Bunny object moves.
 *
 * @param records - Stored object references to canonicalize.
 * @returns Unique source-to-destination moves with their affected records.
 * @throws When a record has no canonical destination or distinct source objects
 * map to the same destination.
 * @internal
 */
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

/**
 * Updates one database reference after its Bunny object moves.
 *
 * @param record - Referencing database row.
 * @param objectPath - New canonical Bunny object path.
 * @param url - Public CDN URL for the moved object.
 * @rejects When the database update fails.
 */
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
  } else if (record.table === "legacy-resource") {
    await record.database`
      update resource_versions
      set object_path = ${objectPath}, url = ${url}
      where id = ${record.id}
    `;
  } else {
    await record.database`
      update resource_versions
      set archive_object_path = ${objectPath}
      where id = ${record.id}
    `;
  }
}

/**
 * Copies a Bunny object to its canonical path when needed.
 *
 * @param source - Existing Bunny object path.
 * @param destination - Canonical Bunny object path.
 * @param config - Bunny request configuration.
 * @rejects When neither source nor destination exists, the source has no body,
 * or a Bunny request fails.
 */
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

/**
 * Recursively lists files beneath a Bunny storage folder.
 *
 * @param folder - Bunny folder path without a trailing slash.
 * @param config - Bunny request configuration.
 * @returns File paths relative to the storage zone root.
 * @rejects When a request fails or Bunny returns an invalid listing, including
 * an unsafe object name.
 */
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

/**
 * Sends an authenticated Bunny Storage request and validates its status.
 *
 * @param objectPath - Object path relative to the storage-zone root.
 * @param method - HTTP method for the storage operation.
 * @param expectedStatuses - Accepted response status codes.
 * @param config - Bunny request configuration.
 * @param body - Optional upload body.
 * @param headers - Optional request headers merged with authentication.
 * @returns The accepted HTTP response.
 * @rejects When Bunny returns an unexpected status or the request fails.
 */
async function bunnyRequest(
  objectPath: string,
  method: "DELETE" | "GET" | "PUT",
  expectedStatuses: number[],
  config: BunnyConfig,
  body?: ReadableStream<Uint8Array>,
  headers?: HeadersInit,
): Promise<Response> {
  const init: RequestInit & {
    /** Node fetch streaming mode required when an upload body is present. */
    duplex?: "half";
  } = {
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

/**
 * Percent-encodes each segment of a Bunny object path.
 *
 * @param objectPath - Slash-delimited object path.
 * @returns The encoded path with separators preserved.
 */
function encodePath(objectPath: string): string {
  return objectPath.split("/").map(encodeURIComponent).join("/");
}

/**
 * Extracts and validates the filename from an object path.
 *
 * @param objectPath - Slash-delimited Bunny object path.
 * @returns The final safe path segment.
 * @throws When the path has no filename or ends in an unsafe segment.
 */
function baseName(objectPath: string): string {
  const name = objectPath.split("/").at(-1);
  if (!name) throw new Error(`Object path has no filename: ${objectPath}`);
  return safeName(name);
}

/**
 * Validates a Bunny object name as one safe path segment.
 *
 * @param name - Object or directory name.
 * @returns The unchanged safe name.
 * @throws When the name is empty, traverses directories, or contains separators.
 */
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

/**
 * Reads a required environment variable.
 *
 * @param name - Environment variable name.
 * @returns The trimmed non-empty value.
 * @throws When the variable is missing or blank.
 */
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

/**
 * Removes every trailing slash from a URL or path.
 *
 * @param value - Value to normalize.
 * @returns The value without trailing slashes.
 */
function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, "");
}

if (process.env.NODE_ENV !== "test") await main();
