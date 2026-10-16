import { describe, expect, it, vi } from "vitest";
import { authorizeInteraction } from "./authorization.js";

describe("interaction authorization", () => {
  it("allows a configured role and refuses everyone else ephemerally", async () => {
    const reply = vi.fn();
    expect(
      await authorizeInteraction({ memberRoleIds: ["owner"], reply }, [
        "owner",
      ]),
    ).toBe(true);
    expect(reply).not.toHaveBeenCalled();

    expect(
      await authorizeInteraction({ memberRoleIds: ["member"], reply }, [
        "owner",
      ]),
    ).toBe(false);
    expect(reply).toHaveBeenCalledWith({
      content: "Request denied.",
      ephemeral: true,
    });
  });
});
