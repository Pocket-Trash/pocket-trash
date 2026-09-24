export async function bunnyRequest(
  config: {
    accessKey: string;
    endpoint: string;
    zoneName: string;
    fetch: typeof fetch;
    fetchTimeoutMs?: number;
  },
  objectPath: string,
  input: {
    body?: BodyInit;
    expectedStatuses: number[];
    headers?: HeadersInit;
    method: "DELETE" | "GET" | "PUT";
  },
): Promise<Response> {
  const response = await config.fetch(
    `${config.endpoint}/${config.zoneName}/${objectPath.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/")}`,
    {
      body: input.body,
      signal: AbortSignal.timeout(config.fetchTimeoutMs ?? 30_000),
      headers: { AccessKey: config.accessKey, ...input.headers },
      method: input.method,
    },
  );

  if (!input.expectedStatuses.includes(response.status)) {
    throw new Error(`Bunny storage request failed: ${response.status}.`);
  }

  return response;
}
