import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHelpLinkCommand } from "./help-link.js";
import { helpTopics } from "./help-topics.generated.js";
import { readEnglishHelpTopics } from "./help-topics-source.js";
import { createInteractionRegistry } from "./registries.js";

/** Environment-specific staff role identities. */
const roles = {
  ownerRoleId: "1522834871649829079",
  moderatorRoleId: "1560130642623074334",
};
/** Valid member identity used for explicit mention tests. */
const member = "123456789012345678";
/** Disposable help-source fixture directories removed after each test. */
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("staff help-link command", () => {
  it("matches generated choices to every packaged English help document", () => {
    expect(readEnglishHelpTopics()).toEqual(helpTopics);
    const command = createHelpLinkCommand(roles);
    expect(command.definition.name).toBe("help-link");
    expect(command.definition.options?.[0]).toMatchObject({
      name: "topic",
      required: true,
      choices: helpTopics.map((topic) => ({
        name: topic.title,
        value: topic.slug,
      })),
    });
    expect(command.definition.options?.[1]).toMatchObject({
      name: "user",
      type: 6,
    });
  });

  it.each([
    roles.ownerRoleId,
    roles.moderatorRoleId,
  ])("allows configured staff role %s and posts an English public link", async (roleId) => {
    const reply = vi.fn();
    const command = createHelpLinkCommand(roles);
    await createInteractionRegistry([command.handler]).dispatch("help-link", {
      memberRoleIds: [roleId],
      commandOptions: { topic: "how-to-use-markdown", userId: null },
      reply,
    });
    expect(reply).toHaveBeenCalledWith({
      content:
        "How to Use Markdown\nhttps://pocket-trash.app/help/how-to-use-markdown",
      ephemeral: false,
      allowedMentions: { parse: [], users: [] },
    });
  });

  it("mentions only the explicitly selected member", async () => {
    const reply = vi.fn();
    await createHelpLinkCommand(roles).handler.execute({
      memberRoleIds: [roles.ownerRoleId],
      commandOptions: { topic: "how-to-use-markdown", userId: member },
      reply,
    });
    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: `<@${member}>\nHow to Use Markdown\nhttps://pocket-trash.app/help/how-to-use-markdown`,
        allowedMentions: { parse: [], users: [member] },
      }),
    );
  });

  it("denies non-staff before executing a public response", async () => {
    const reply = vi.fn();
    const command = createHelpLinkCommand(roles);
    await createInteractionRegistry([command.handler]).dispatch("help-link", {
      memberRoleIds: ["member"],
      commandOptions: { topic: "how-to-use-markdown", userId: member },
      reply,
    });
    expect(reply).toHaveBeenCalledExactlyOnceWith({
      content: "Request denied.",
      ephemeral: true,
    });
  });

  it.each([
    "stale-topic",
    "../secrets",
  ])("rejects stale or invalid topic %s ephemerally", async (topic) => {
    const reply = vi.fn();
    await createHelpLinkCommand(roles).handler.execute({
      memberRoleIds: [roles.ownerRoleId],
      commandOptions: { topic, userId: null },
      reply,
    });
    expect(reply).toHaveBeenCalledWith({
      content: "Something went wrong.",
      ephemeral: true,
    });
  });

  it("rejects empty or duplicate compiled metadata before registering", () => {
    expect(() => createHelpLinkCommand({ ...roles, topics: [] })).toThrow();
    expect(() =>
      createHelpLinkCommand({
        ...roles,
        topics: [
          { slug: "one", title: "One" },
          { slug: "one", title: "Two" },
        ],
      }),
    ).toThrow("Duplicate");
  });

  it.each([
    "missing-title",
    "missing-date",
    "empty-body",
    "unsafe-slug",
    "too-many",
  ])("fails source generation for %s", (kind) => {
    const directory = mkdtempSync(join(tmpdir(), "discord-help-"));
    directories.push(directory);
    const source = `---\n${kind === "missing-title" ? "" : "title: Test\n"}${kind === "missing-date" ? "" : "datePublished: 2026-10-01\n"}category: Writing\n---\n${kind === "empty-body" ? "" : "Help content"}`;
    writeFileSync(
      join(directory, kind === "unsafe-slug" ? "Unsafe.mdx" : "topic.mdx"),
      source,
    );
    if (kind === "too-many")
      for (let index = 0; index < 25; index++)
        writeFileSync(join(directory, `topic-${index}.mdx`), source);
    expect(() => readEnglishHelpTopics(directory)).toThrow();
  });
});
