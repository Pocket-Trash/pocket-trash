import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { z } from "zod";

/** Validated build-time help choice. */
const helpTopicSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
    .max(100),
  title: z.string().trim().min(1).max(100),
});
/** Source document fields required by the published help route. */
const helpFrontmatterSchema = z.object({
  title: z.string().trim().min(1).max(100),
  category: z.string().min(1),
  datePublished: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
});
/** One English help topic available to Discord. */
export type HelpTopic = z.infer<typeof helpTopicSchema>;

/**
 * Reads packaged English MDX metadata and rejects unusable Discord choices.
 *
 * @param directory - Optional fixture directory instead of the installed package.
 * @returns Deterministic, validated slug/title choices.
 * @throws When documents, metadata, or Discord choice limits are invalid.
 */
export function readEnglishHelpTopics(
  directory = join(
    dirname(fileURLToPath(import.meta.resolve("@pocket-trash/localizations"))),
    "../help/en-US",
  ),
): HelpTopic[] {
  const topics = readdirSync(directory)
    .filter((name) => name.endsWith(".mdx") && name !== "index.mdx")
    .sort()
    .map((name) => {
      const source = readFileSync(join(directory, name), "utf8");
      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/u.exec(
        source,
      );
      if (!frontmatter?.[1] || !frontmatter[2]?.trim())
        throw new Error(`Invalid help document: ${name}`);
      const metadata = helpFrontmatterSchema.parse(parse(frontmatter[1]));
      return helpTopicSchema.parse({
        slug: name.slice(0, -4),
        title: metadata.title,
      });
    });
  return z.array(helpTopicSchema).min(1).max(25).parse(topics);
}
