import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

it("checks every synthetic attachment without credentials or inference calls", () => {
  const output = execFileSync(
    process.execPath,
    [new URL("./evaluate-summary.mjs", import.meta.url).pathname, "--check"],
    {
      encoding: "utf8",
      env: { ...process.env, CHEAPERINFERENCE_API_KEY: "" },
    },
  );
  expect(output).toContain("All five synthetic fixtures");
});
