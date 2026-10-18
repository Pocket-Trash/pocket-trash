import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

it("validates frozen synthetic classification labels without credentials or inference", () => {
  const output = execFileSync(
    process.execPath,
    [
      new URL("./evaluate-classification.mjs", import.meta.url).pathname,
      "--check",
    ],
    {
      encoding: "utf8",
      env: { ...process.env, CHEAPERINFERENCE_API_KEY: "" },
    },
  );
  expect(output).toContain("All 20 synthetic classification fixtures");
});

it("stops on a non-ZDR receipt without a retry or real network access", () => {
  const mockNetwork = `let calls = 0;
    globalThis.fetch = async () => {
      if (++calls > 2) throw new Error("Unexpected retry");
      return new Response(JSON.stringify(calls === 1
        ? { data: [{ id: "jev-1.13", supported_endpoints: ["/v1/decisions"], pricing: { input_per_million: "0.0315", zero_data_retention: true } }] }
        : { billing: { status: "settled", zero_data_retention: false, billed_cost_usd: "0.00001" } }
      ), { status: 200 });
    };`;
  expect(() =>
    execFileSync(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(mockNetwork)}`,
        new URL("./evaluate-classification.mjs", import.meta.url).pathname,
        "--live",
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, CHEAPERINFERENCE_API_KEY: "synthetic-test-key" },
      },
    ),
  ).toThrow("ZDR receipt missing or false; stop.");
});
