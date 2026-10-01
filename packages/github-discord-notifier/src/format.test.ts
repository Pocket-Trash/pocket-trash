import { describe, expect, it } from "vitest";
import { type FormatContext, formatGitHubNotification } from "./format.js";

/** GitHub repository and workflow metadata shared by formatter tests. */
const context = {
  eventName: "pull_request",
  repository: "BVG-Digital/machinedpens.info",
  runId: "123",
  serverUrl: "https://github.com",
  sha: "abc123",
} satisfies FormatContext;

describe("formatGitHubNotification", () => {
  it("formats opened pull requests", () => {
    const notification = formatGitHubNotification(context, {
      action: "opened",
      sender: { login: "roy" },
      pull_request: pullRequest({ number: 42 }),
    });

    expect(notification?.payload.embeds[0]).toMatchObject({
      title: "[Pull Request] #42 Add notifier",
      description: "roy opened pull request #42.",
      color: 0x2563eb,
      url: "https://github.com/BVG-Digital/machinedpens.info/pull/42",
    });
    expect(notification?.payload.components[0].components[0]).toMatchObject({
      label: "Open in GitHub",
      style: 5,
      url: "https://github.com/BVG-Digital/machinedpens.info/pull/42",
    });
  });

  it("formats synchronized pull requests as new commit notifications", () => {
    const notification = formatGitHubNotification(context, {
      action: "synchronize",
      sender: { login: "roy" },
      pull_request: pullRequest({ number: 43 }),
    });

    expect(notification?.payload.embeds[0]).toMatchObject({
      title: "[Pull Request] #43 Add notifier",
      description: "roy pushed new commits to pull request #43.",
      color: 0x2563eb,
    });
  });

  it("formats review requests", () => {
    const notification = formatGitHubNotification(context, {
      action: "review_requested",
      requested_reviewer: { login: "reviewer" },
      sender: { login: "roy" },
      pull_request: pullRequest({ number: 44 }),
    });

    expect(notification?.payload.embeds[0].fields).toContainEqual({
      name: "Reviewer",
      value: "reviewer",
      inline: true,
    });
  });

  it("formats merged pull requests in the merge group", () => {
    const notification = formatGitHubNotification(context, {
      action: "closed",
      sender: { login: "roy" },
      pull_request: pullRequest({ merged: true, number: 45 }),
    });

    expect(notification?.payload.embeds[0]).toMatchObject({
      title: "[Merge] #45 Add notifier",
      description: "roy merged pull request #45.",
      color: 0x16a34a,
    });
  });

  it("formats closed unmerged pull requests in gray", () => {
    const notification = formatGitHubNotification(context, {
      action: "closed",
      sender: { login: "roy" },
      pull_request: pullRequest({ merged: false, number: 46 }),
    });

    expect(notification?.payload.embeds[0]).toMatchObject({
      title: "[Merge] #46 Add notifier",
      description: "roy closed without merging pull request #46.",
      color: 0x6b7280,
    });
  });

  it("formats approved reviews in green", () => {
    const notification = formatGitHubNotification(
      { ...context, eventName: "pull_request_review" },
      {
        action: "submitted",
        sender: { login: "reviewer" },
        pull_request: pullRequest({ number: 47 }),
        review: {
          html_url:
            "https://github.com/BVG-Digital/machinedpens.info/pull/47#pullrequestreview-1",
          state: "approved",
        },
      },
    );

    expect(notification?.payload.embeds[0]).toMatchObject({
      title: "[Review] #47 Add notifier",
      description: "reviewer approved changes on pull request #47.",
      color: 0x16a34a,
    });
  });

  it("formats changes requested reviews in red", () => {
    const notification = formatGitHubNotification(
      { ...context, eventName: "pull_request_review" },
      {
        action: "submitted",
        sender: { login: "reviewer" },
        pull_request: pullRequest({ number: 48 }),
        review: { state: "changes_requested" },
      },
    );

    expect(notification?.payload.embeds[0]).toMatchObject({
      description: "reviewer requested changes on pull request #48.",
      color: 0xdc2626,
    });
  });

  it("formats dismissed reviews in amber", () => {
    const notification = formatGitHubNotification(
      { ...context, eventName: "pull_request_review" },
      {
        action: "dismissed",
        sender: { login: "maintainer" },
        pull_request: pullRequest({ number: 49 }),
        review: { state: "commented" },
      },
    );

    expect(notification?.payload.embeds[0]).toMatchObject({
      description: "maintainer dismissed a review on pull request #49.",
      color: 0xf59e0b,
    });
  });

  it("formats failed workflow runs in red", () => {
    const notification = formatGitHubNotification(
      { ...context, eventName: "workflow_run" },
      {
        workflow_run: {
          actor: { login: "roy" },
          conclusion: "failure",
          html_url:
            "https://github.com/BVG-Digital/machinedpens.info/actions/runs/1",
          name: "CI",
          status: "completed",
        },
      },
    );

    expect(notification?.payload.embeds[0]).toMatchObject({
      title: "[Checks] CI failure",
      description: "CI completed with conclusion: failure.",
      color: 0xdc2626,
    });
  });

  it("skips successful workflow runs", () => {
    const notification = formatGitHubNotification(
      { ...context, eventName: "workflow_run" },
      {
        workflow_run: {
          conclusion: "success",
          html_url:
            "https://github.com/BVG-Digital/machinedpens.info/actions/runs/1",
          name: "CI",
          status: "completed",
        },
      },
    );

    expect(notification).toBeUndefined();
  });

  it("formats main pushes", () => {
    const notification = formatGitHubNotification(
      { ...context, eventName: "push" },
      {
        compare:
          "https://github.com/BVG-Digital/machinedpens.info/compare/a...b",
        commits: [{ id: "1" }, { id: "2" }],
        ref: "refs/heads/main",
        sender: { login: "roy" },
      },
    );

    expect(notification?.payload.embeds[0]).toMatchObject({
      title: "[Main] New commit on main",
      description: "roy pushed 2 commits to main.",
      color: 0x2563eb,
    });
  });

  it("uses safe Discord payload defaults", () => {
    const notification = formatGitHubNotification(context, {
      action: "opened",
      sender: { login: "@everyone" },
      pull_request: pullRequest({ number: 50 }),
    });

    expect(notification?.payload.allowed_mentions).toEqual({ parse: [] });
    expect(notification?.payload.embeds[0].url).toBe(
      "https://github.com/BVG-Digital/machinedpens.info/pull/50",
    );
    expect(notification?.payload.components[0].components[0].url).toBe(
      "https://github.com/BVG-Digital/machinedpens.info/pull/50",
    );
  });
});

/**
 * Builds the minimal pull-request payload used by formatter tests.
 *
 * @param input - Pull-request number and optional merged state.
 * @returns GitHub-style pull-request fields for one test event.
 */
function pullRequest(input: {
  /** Whether GitHub reports the pull request as merged. */
  merged?: boolean;
  /** Pull-request number. */
  number: number;
}) {
  return {
    base: { ref: "main" },
    head: { ref: "feature/discord" },
    html_url: `https://github.com/BVG-Digital/machinedpens.info/pull/${input.number}`,
    merged: input.merged ?? false,
    number: input.number,
    title: "Add notifier",
  };
}
