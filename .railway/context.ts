import { execFileSync } from "node:child_process";

/** Project-local resource identity returned by the public Railway API. */
type RailwayTarget = {
  /** Resource identifier. */
  id: string;
  /** Exact resource name. */
  name: string;
};

/** One node in a project resource connection. */
type RailwayEdge = {
  /** Resource identity. */
  node: RailwayTarget;
};

/**
 * Runs a scoped Railway read without exposing subprocess output.
 * @param args - Public CLI arguments.
 * @returns Captured JSON response.
 * @throws {Error} When the read fails.
 */
function readRailway(args: string[]): string {
  try {
    return execFileSync("pnpm", ["exec", "railway", ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
    });
  } catch {
    throw new Error("Railway project lookup failed; output withheld.");
  }
}

/**
 * Resolves names and IDs without the account-only lookup used by `railway link`.
 * @param projectId - Explicit authorized project ID.
 * @param environment - Exact environment name or ID within that project.
 * @param serviceName - Optional service name within that project.
 * @param run - Read-only CLI seam for tests and preview tooling.
 * @returns Verified Pocket Trash project, environment and optional service context.
 * @throws {Error} For a failed lookup, wrong project or missing/ambiguous target.
 */
export function resolveRailwayContext(
  projectId: string,
  environment: string,
  serviceName?: string,
  run: (args: string[]) => string = readRailway,
) {
  const result = JSON.parse(
    run([
      "api",
      "query ProjectContext($id:String!){project(id:$id){id name environments{edges{node{id name}}}services{edges{node{id name}}}}}",
      "--variables",
      JSON.stringify({ id: projectId }),
      "--compact",
    ]),
  );
  const project = result.data?.project;
  if (
    result.errors ||
    project?.id !== projectId ||
    project?.name !== "Pocket Trash"
  )
    throw new Error("Railway context must target the Pocket Trash project.");
  const environments =
    project.environments?.edges?.map(({ node }: RailwayEdge) => node) ?? [];
  const byId = environments.filter(
    (entry: RailwayTarget) => entry.id === environment,
  );
  const matches = byId.length
    ? byId
    : environments.filter((entry: RailwayTarget) => entry.name === environment);
  const target = matches[0];
  if (
    matches.length !== 1 ||
    typeof target?.id !== "string" ||
    typeof target?.name !== "string"
  )
    throw new Error(
      "Railway environment is missing or ambiguous in the selected project.",
    );
  const services = serviceName
    ? (project.services?.edges?.filter(
        ({ node }: RailwayEdge) => node.name === serviceName,
      ) ?? [])
    : [];
  if (
    serviceName &&
    (services.length !== 1 || typeof services[0]?.node?.id !== "string")
  )
    throw new Error(
      "Railway service is missing or ambiguous in the selected project.",
    );
  return {
    projectId,
    projectName: "Pocket Trash",
    environmentId: target.id,
    environmentName: target.name,
    serviceId: services[0]?.node.id,
    serviceName,
  };
}
