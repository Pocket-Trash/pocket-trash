/**
 * Verifies that a mutation run targets PR-isolated preview infrastructure.
 *
 * @param environment - Environment variables supplied to the E2E process.
 * @returns The validated PR number and storage prefixes.
 * @throws When any database, storage, deployment, or Clerk boundary is unsafe.
 */
export function assertMutationIsolation(
  environment: Record<string, string | undefined>,
) {
  const prNumber = Number(environment.E2E_PR_NUMBER);
  if (!Number.isSafeInteger(prNumber) || prNumber <= 0) {
    throw new Error("E2E_PR_NUMBER must be a positive integer.");
  }

  const baseUrl = new URL(required(environment, "E2E_BASE_URL"));
  if (
    baseUrl.protocol !== "https:" ||
    !baseUrl.hostname.endsWith(".vercel.app")
  ) {
    throw new Error("Mutation tests require a Vercel preview URL.");
  }

  const databaseBranch = `preview-pr-${prNumber}`;
  const imagePrefix = `images/preview/pr-${prNumber}`;
  const resourcePrefix = `resources/preview/pr-${prNumber}`;
  if (environment.E2E_DATABASE_BRANCH !== databaseBranch) {
    throw new Error("Mutation tests require the current PR database branch.");
  }
  if (environment.BUNNY_IMAGE_FOLDER_PREFIX !== imagePrefix) {
    throw new Error("Mutation tests require the current PR image prefix.");
  }
  if (environment.BUNNY_RESOURCE_FOLDER_PREFIX !== resourcePrefix) {
    throw new Error("Mutation tests require the current PR resource prefix.");
  }
  if (!environment.CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")) {
    throw new Error(
      "Mutation tests require a Clerk development publishable key.",
    );
  }
  if (!environment.CLERK_SECRET_KEY?.startsWith("sk_test_")) {
    throw new Error("Mutation tests require a Clerk development secret key.");
  }

  return { imagePrefix, prNumber, resourcePrefix };
}

/**
 * Verifies that the configured database and deployment are the guarded targets.
 *
 * @param environment - Environment variables supplied to the E2E process.
 * @param fetchTarget - HTTP client used for provider verification.
 * @returns The validated PR number and storage prefixes.
 * @rejects When Neon or Vercel reports a different target.
 */
export async function verifyMutationTargets(
  environment: Record<string, string | undefined>,
  fetchTarget: typeof fetch = fetch,
) {
  const isolation = assertMutationIsolation(environment);
  const neonProjectId = required(environment, "NEON_PROJECT_ID");
  const neonHeaders = {
    Authorization: `Bearer ${required(environment, "NEON_API_KEY")}`,
  };
  const neonOrigin = `https://console.neon.tech/api/v2/projects/${encodeURIComponent(neonProjectId)}`;
  const branches = await fetchJson<{
    /** Neon project branch records. */
    branches: {
      /** Neon branch identifier. */
      id: string;
      /** Neon branch name. */
      name: string;
    }[];
  }>(`${neonOrigin}/branches?limit=10000`, neonHeaders, fetchTarget);
  const branch = branches.branches.find(
    ({ name }) => name === environment.E2E_DATABASE_BRANCH,
  );
  if (!branch)
    throw new Error("Mutation tests require an isolated Neon branch.");

  const endpoints = await fetchJson<{
    /** Neon project endpoint records. */
    endpoints: {
      /** Owning Neon branch identifier. */
      branch_id: string;
      /** Direct Neon endpoint hostname. */
      host: string;
    }[];
  }>(`${neonOrigin}/endpoints`, neonHeaders, fetchTarget);
  const databaseHost = new URL(required(environment, "DATABASE_URL")).hostname;
  const directDatabaseHost = databaseHost.replace(/-pooler(?=\.)/u, "");
  if (
    !endpoints.endpoints.some(
      ({ branch_id: branchId, host }) =>
        branchId === branch.id && host === directDatabaseHost,
    )
  ) {
    throw new Error(
      "Mutation tests require the isolated Neon branch connection.",
    );
  }

  const deployment = await fetchJson<{
    /** Vercel deployment target. */
    target: string | null;
    /** Vercel deployment hostname. */
    url: string;
  }>(
    `https://api.vercel.com/v13/deployments/${encodeURIComponent(required(environment, "E2E_VERCEL_DEPLOYMENT_ID"))}?teamId=${encodeURIComponent(required(environment, "VERCEL_ORG_ID"))}`,
    { Authorization: `Bearer ${required(environment, "VERCEL_TOKEN")}` },
    fetchTarget,
  );
  if (
    deployment.target !== null ||
    deployment.url !== new URL(required(environment, "E2E_BASE_URL")).hostname
  ) {
    throw new Error(
      "Mutation tests require the current Vercel preview deployment.",
    );
  }

  return isolation;
}

/**
 * Reads one provider JSON response.
 *
 * @template T - Expected provider response body.
 * @param url - Provider API URL.
 * @param headers - Authentication headers.
 * @param fetchTarget - HTTP client used for the request.
 * @returns The decoded response body.
 * @rejects When the provider rejects the request.
 */
async function fetchJson<T>(
  url: string,
  headers: Record<string, string>,
  fetchTarget: typeof fetch,
) {
  const response = await fetchTarget(url, {
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Mutation target verification failed: ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

/**
 * Reads one non-empty E2E environment variable.
 *
 * @param environment - Environment variables supplied to the E2E process.
 * @param name - Required variable name.
 * @returns The trimmed variable value.
 * @throws When the variable is missing or blank.
 */
function required(
  environment: Record<string, string | undefined>,
  name: string,
) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
