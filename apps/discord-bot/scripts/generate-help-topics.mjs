import { readFileSync, writeFileSync } from "node:fs";
import { readEnglishHelpTopics } from "../src/help-topics-source.ts";

/** Tracked metadata compiled into the bot; no MDX loading at runtime. */
const destination = new URL("../src/help-topics.generated.ts", import.meta.url);
/** Validated source metadata from the installed localization package. */
const topics = readEnglishHelpTopics();
/** Deterministic TypeScript module with a literal slug union. */
const output = `/** Generated from packaged English help MDX; run pnpm generate:help. */\nexport const helpTopics = [\n${topics.map((topic) => `  {\n    slug: ${JSON.stringify(topic.slug)},\n    title: ${JSON.stringify(topic.title)},\n  },`).join("\n")}\n] as const;\n\n/** Slugs offered by the installed English help documents. */\nexport type HelpTopicSlug = (typeof helpTopics)[number]["slug"];\n`;
if (process.argv.includes("--check")) {
  if (readFileSync(destination, "utf8") !== output)
    throw new Error(
      "Stale help topics: run pnpm --filter @app/discord-bot generate:help and commit the result.",
    );
} else {
  writeFileSync(destination, output);
}
