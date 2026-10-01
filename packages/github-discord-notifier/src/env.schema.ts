import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/** Raw process values accepted by the GitHub Discord notifier environment parser. */
export type GitHubDiscordNotifierRuntimeEnv = {
  /** Discord webhook endpoint used to deliver the notification. */
  DISCORD_GITHUB_WEBHOOK_URL?: string;
  /** GitHub webhook event name. */
  GITHUB_EVENT_NAME?: string;
  /** Path to the GitHub event payload file. */
  GITHUB_EVENT_PATH?: string;
  /** GitHub repository in `owner/name` form. */
  GITHUB_REPOSITORY?: string;
  /** Optional GitHub Actions run identifier. */
  GITHUB_RUN_ID?: string;
  /** Optional GitHub server origin. */
  GITHUB_SERVER_URL?: string;
  /** Optional commit SHA associated with the event. */
  GITHUB_SHA?: string;
};

/**
 * Validates runtime values required to format and deliver a GitHub notification.
 *
 * @param runtimeEnv - Raw environment values without secret logging or coercion.
 * @returns Validated notifier environment with the public GitHub origin as default.
 * @throws When a required value is absent or a configured URL is invalid.
 */
export function createGitHubDiscordNotifierEnv(
  runtimeEnv: GitHubDiscordNotifierRuntimeEnv,
) {
  return createEnv({
    emptyStringAsUndefined: true,
    isServer: true,
    runtimeEnvStrict: {
      DISCORD_GITHUB_WEBHOOK_URL: runtimeEnv.DISCORD_GITHUB_WEBHOOK_URL,
      GITHUB_EVENT_NAME: runtimeEnv.GITHUB_EVENT_NAME,
      GITHUB_EVENT_PATH: runtimeEnv.GITHUB_EVENT_PATH,
      GITHUB_REPOSITORY: runtimeEnv.GITHUB_REPOSITORY,
      GITHUB_RUN_ID: runtimeEnv.GITHUB_RUN_ID,
      GITHUB_SERVER_URL: runtimeEnv.GITHUB_SERVER_URL,
      GITHUB_SHA: runtimeEnv.GITHUB_SHA,
    },
    server: {
      DISCORD_GITHUB_WEBHOOK_URL: z.string().min(1).url(),
      GITHUB_EVENT_NAME: z.string().min(1),
      GITHUB_EVENT_PATH: z.string().min(1),
      GITHUB_REPOSITORY: z.string().min(1),
      GITHUB_RUN_ID: z.string().min(1).optional(),
      GITHUB_SERVER_URL: z.string().min(1).url().default("https://github.com"),
      GITHUB_SHA: z.string().min(1).optional(),
    },
  });
}
