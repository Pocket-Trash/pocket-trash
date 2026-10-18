import { ContainerBuilder, MessageFlags } from "discord.js";
import { describe, expect, it } from "vitest";
import { renderDiscordNotification } from "./renderer.js";

describe("Discord notification renderer", () => {
  it("renders a bounded card with an accent bar and multiple link actions", () => {
    const message = renderDiscordNotification({
      actions: [
        {
          label: "Open PR",
          url: "https://github.com/Pocket-Trash/pocket-trash/pull/412",
        },
        {
          label: "View checks",
          url: "https://github.com/Pocket-Trash/pocket-trash/pull/412/checks",
        },
      ],
      description:
        "Review is requested before the existing workflow is removed.",
      occurredAt: new Date("2026-10-17T23:00:00.000Z"),
      provenance: "opened by royanger",
      source: "GitHub",
      status: "Pull request ready for review",
      tags: ["Pocket-Trash/pocket-trash", "#412"],
      title: "Configure Discord resource validation",
      titleUrl: "https://github.com/Pocket-Trash/pocket-trash/pull/412",
      tone: "success",
    });

    expect(message.allowedMentions).toEqual({ parse: [] });
    expect(message.flags).toBe(MessageFlags.IsComponentsV2);
    const [card] = message.components ?? [];
    expect(card).toBeInstanceOf(ContainerBuilder);
    if (!(card instanceof ContainerBuilder)) throw new Error("Missing card");
    expect(card.toJSON()).toMatchObject({
      accent_color: 2_991_182,
      components: [
        {
          content: "-# GitHub\n## Pull request ready for review",
          type: 10,
        },
        {
          content:
            "### [Configure Discord resource validation](https://github.com/Pocket-Trash/pocket-trash/pull/412)\n\nReview is requested before the existing workflow is removed.\n\n`Pocket-Trash/pocket-trash` · `#412`\n\n-# opened by royanger · <t:1792278000:R>",
          type: 10,
        },
        {
          components: [
            {
              label: "Open PR",
              style: 5,
              type: 2,
              url: "https://github.com/Pocket-Trash/pocket-trash/pull/412",
            },
            {
              label: "View checks",
              style: 5,
              type: 2,
              url: "https://github.com/Pocket-Trash/pocket-trash/pull/412/checks",
            },
          ],
          type: 1,
        },
      ],
      type: 17,
    });
  });

  it("renders diagnostics without a status dot or action row", () => {
    const message = renderDiscordNotification({
      description: "The trusted fallback payload did not match its schema.",
      diagnostics: ["Expected deployment.environment to be a string."],
      occurredAt: new Date("2026-10-17T23:00:00.000Z"),
      provenance: "message 1560912345678901234",
      source: "Discord bot",
      status: "Axiom intake payload rejected",
      tags: ["production", "parser health"],
      title: "Required deployment environment was missing",
      tone: "warning",
    });

    const [card] = message.components ?? [];
    if (!(card instanceof ContainerBuilder)) throw new Error("Missing card");
    const rendered = card.toJSON();
    expect(rendered.components).toHaveLength(2);
    expect(JSON.stringify(rendered)).not.toMatch(/[🟢🟠🔴]/u);
    expect(rendered.components[1]).toMatchObject({
      content: expect.stringContaining(
        "> Expected deployment.environment to be a string.",
      ),
    });
  });

  it("rejects invalid dates and more than five actions", () => {
    const base = {
      description: "Description",
      occurredAt: new Date("2026-10-17T23:00:00.000Z"),
      provenance: "source",
      source: "GitHub",
      status: "Status",
      tags: [],
      title: "Title",
      tone: "info" as const,
    };

    expect(() =>
      renderDiscordNotification({
        ...base,
        actions: Array.from({ length: 6 }, (_, index) => ({
          label: `Action ${index}`,
          url: "https://example.com",
        })),
      }),
    ).toThrow("at most five actions");
    expect(() =>
      renderDiscordNotification({ ...base, occurredAt: new Date("invalid") }),
    ).toThrow("occurrence time is invalid");
  });
});
