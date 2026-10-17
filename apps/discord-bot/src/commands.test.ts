import { Routes } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import { registerGuildCommands } from "./commands.js";

describe("guild command registration", () => {
  it("uses the configured application and guild route", async () => {
    const put = vi.fn().mockResolvedValue([]);
    await registerGuildCommands(
      { put },
      "123456789012345678",
      "223456789012345678",
      [{ name: "help-link" }],
    );
    expect(put).toHaveBeenCalledWith(
      Routes.applicationGuildCommands(
        "123456789012345678",
        "223456789012345678",
      ),
      { body: [{ name: "help-link" }] },
    );
  });
});
