import { describe, expect, it, vi } from "vitest";
import {
  type AxiomManagementFetch,
  type AxiomManagementResponse,
  axiomMapFields,
  checkAxiomMapFields,
  ensureAxiomMapFields,
} from "./axiom.js";

/** Dataset-management configuration used by unit tests. */
const config = { dataset: "preview logs", token: "management-secret" };

/**
 * Creates a minimal Axiom management response.
 *
 * @param body - JSON response body.
 * @param status - HTTP response status.
 * @returns Fake fetch response.
 */
function response(body: unknown, status = 200): AxiomManagementResponse {
  return {
    /**
     * Parses the fake response.
     *
     * @returns The configured fake response body.
     */
    json: async () => body,
    ok: status >= 200 && status < 300,
    status,
  };
}

describe("Axiom map fields", () => {
  it("checks the exact package-owned requirement without mutations", async () => {
    const fetcher = vi
      .fn<AxiomManagementFetch>()
      .mockResolvedValue(response([...axiomMapFields, "anotherMap"]));

    await expect(checkAxiomMapFields(config, fetcher)).resolves.toEqual([
      ...axiomMapFields,
      "anotherMap",
    ]);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.axiom.co/v2/datasets/preview%20logs/mapfields",
      {
        headers: { Authorization: "Bearer management-secret" },
        method: "GET",
      },
    );
  });

  it("reports every missing field without making changes", async () => {
    const fetcher = vi
      .fn<AxiomManagementFetch>()
      .mockResolvedValue(response(["attributes", "error"]));

    await expect(checkAxiomMapFields(config, fetcher)).rejects.toThrow(
      "Missing required Axiom map fields for preview logs: context, rawPayload.",
    );
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("rejects malformed list responses", async () => {
    const fetcher = vi
      .fn<AxiomManagementFetch>()
      .mockResolvedValue(response([{ name: "attributes" }]));

    await expect(checkAxiomMapFields(config, fetcher)).rejects.toThrow(
      "Axiom map field lookup returned an unexpected response.",
    );
  });

  it("keeps authorization failures free of credentials and response bodies", async () => {
    const fetcher = vi
      .fn<AxiomManagementFetch>()
      .mockResolvedValue(response({ secret: "provider-body" }, 401));

    const error = await checkAxiomMapFields(config, fetcher).catch(
      (caught: unknown) => caught,
    );
    expect(error).toEqual(new Error("Axiom map field lookup failed with 401."));
    expect(String(error)).not.toContain(config.token);
    expect(String(error)).not.toContain("provider-body");
  });

  it("creates only missing fields and verifies the result", async () => {
    const fetcher = vi
      .fn<AxiomManagementFetch>()
      .mockResolvedValueOnce(response(["attributes", "context"]))
      .mockResolvedValueOnce(response(undefined, 204))
      .mockResolvedValueOnce(response(undefined, 204))
      .mockResolvedValueOnce(response([...axiomMapFields]));

    await expect(ensureAxiomMapFields(config, fetcher)).resolves.toEqual([
      ...axiomMapFields,
    ]);
    expect(fetcher.mock.calls.slice(1, 3)).toEqual([
      [
        "https://api.axiom.co/v2/datasets/preview%20logs/mapfields",
        {
          body: JSON.stringify({ name: "error" }),
          headers: {
            Authorization: "Bearer management-secret",
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      ],
      [
        "https://api.axiom.co/v2/datasets/preview%20logs/mapfields",
        {
          body: JSON.stringify({ name: "rawPayload" }),
          headers: {
            Authorization: "Bearer management-secret",
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      ],
    ]);
  });

  it("fails safely when creation or post-create verification fails", async () => {
    const createFailure = vi
      .fn<AxiomManagementFetch>()
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ secret: "provider-body" }, 500));
    await expect(ensureAxiomMapFields(config, createFailure)).rejects.toThrow(
      "Axiom map field creation failed for attributes with 500.",
    );

    const verificationFailure = vi
      .fn<AxiomManagementFetch>()
      .mockResolvedValueOnce(response(["attributes", "context", "error"]))
      .mockResolvedValueOnce(response(undefined, 204))
      .mockResolvedValueOnce(response(["attributes", "context", "error"]));
    await expect(
      ensureAxiomMapFields(config, verificationFailure),
    ).rejects.toThrow(
      "Missing required Axiom map fields for preview logs: rawPayload.",
    );
  });

  it("is idempotent across repeated ensure runs", async () => {
    const fields = new Set<string>();
    /**
     * Simulates persistent Axiom map-field state.
     *
     * @param _url - Ignored request URL.
     * @param init - Optional request details.
     * @returns A fake list or creation response.
     */
    const implementation: AxiomManagementFetch = async (_url, init) => {
      if (init?.method === "POST") {
        const body: unknown = JSON.parse(init.body ?? "{}");
        if (
          body &&
          typeof body === "object" &&
          "name" in body &&
          typeof body.name === "string"
        ) {
          fields.add(body.name);
        }
        return response(undefined, 204);
      }
      return response([...fields]);
    };
    const fetcher = vi.fn(implementation);

    await ensureAxiomMapFields(config, fetcher);
    await ensureAxiomMapFields(config, fetcher);

    expect(
      fetcher.mock.calls.filter(([, init]) => init?.method === "POST"),
    ).toHaveLength(axiomMapFields.length);
  });
});
