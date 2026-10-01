import { readFile } from "node:fs/promises";
import { sendDiscordNotification } from "./discord.js";
import { githubDiscordNotifierEnv as env } from "./env.js";
import { formatGitHubNotification } from "./format.js";

/**
 * Reads the GitHub event, formats any supported notification, and posts it.
 *
 * @returns Process exit code after delivery or an intentional no-op.
 * @rejects When the event file, JSON payload, formatting, or delivery fails.
 */
async function main(): Promise<number> {
  const event = JSON.parse(
    await readFile(env.GITHUB_EVENT_PATH, "utf8"),
  ) as unknown;
  const notification = formatGitHubNotification(
    {
      eventName: env.GITHUB_EVENT_NAME,
      repository: env.GITHUB_REPOSITORY,
      runId: env.GITHUB_RUN_ID,
      serverUrl: env.GITHUB_SERVER_URL,
      sha: env.GITHUB_SHA,
    },
    event,
  );

  if (!notification) {
    console.log(
      `No Discord notification generated for ${env.GITHUB_EVENT_NAME}.`,
    );
    return 0;
  }

  await sendDiscordNotification(
    env.DISCORD_GITHUB_WEBHOOK_URL,
    notification.payload,
  );
  console.log(`Sent Discord notification for ${env.GITHUB_EVENT_NAME}.`);
  return 0;
}

process.exitCode = await main();
