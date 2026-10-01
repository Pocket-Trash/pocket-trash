import { createGitHubDiscordNotifierEnv } from "./env.schema.js";

/** Validated notifier configuration loaded from the current process environment. */
export const githubDiscordNotifierEnv = createGitHubDiscordNotifierEnv({
  DISCORD_GITHUB_WEBHOOK_URL: process.env.DISCORD_GITHUB_WEBHOOK_URL,
  GITHUB_EVENT_NAME: process.env.GITHUB_EVENT_NAME,
  GITHUB_EVENT_PATH: process.env.GITHUB_EVENT_PATH,
  GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
  GITHUB_RUN_ID: process.env.GITHUB_RUN_ID,
  GITHUB_SERVER_URL: process.env.GITHUB_SERVER_URL,
  GITHUB_SHA: process.env.GITHUB_SHA,
});
