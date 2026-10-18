# PR reviewer setup

This guide covers adoption of [Pocket-Trash/pr-review-tool](https://github.com/Pocket-Trash/pr-review-tool).
Rollout requires the project owner's provider, model, and failover decision from
[ENG-529](https://linear.app/pocket-trash/issue/ENG-529), followed by the live
verification in [ENG-532](https://linear.app/pocket-trash/issue/ENG-532).
The caller workflow and trusted configuration must be added after that decision.

## GitHub App

Create the **Pocket Trash PR Review** App and verify its actual slug. The planned
slug is `pockettrash`; pass the verified slug to the caller if GitHub assigns a
different one. Install the App on the Pocket Trash organization with access
limited to approved repositories, initially `Pocket-Trash/pocket-trash`.

Grant only these repository permissions:

| Permission | Access |
| --- | --- |
| Metadata | Read |
| Contents | Read |
| Pull requests | Read |
| Checks | Write |
| Issues | Write |

Actions schedules the reviewer; the App supplies the publication identity. The
App does not need contributor code, workflow write access, or organization-wide
administration permissions.

## Organization credentials

Use organization Actions secrets and variables restricted to the approved
consumer repositories. Use these caller-facing names when adding the workflow:

| Name | Kind | Purpose |
| --- | --- | --- |
| `PR_REVIEW_APP_ID` | Variable | App ID passed as `app-id` |
| `PR_REVIEW_APP_SLUG` | Variable | Verified slug passed as `app-slug` |
| `PR_REVIEW_APP_PRIVATE_KEY` | Secret | Private key passed as `APP_PRIVATE_KEY` |
| `CHEAPER_INFERENCE_API_KEY` | Secret | Dedicated approved CheaperInference key |

The current reusable workflow accepts CheaperInference for automatic reviews.
OpenRouter is available in the evaluation runner; a production decision requiring
OpenRouter must first be implemented in the reusable workflow's credential and
routing contract. Pass only the selected provider credential to model execution.

The preview Infisical path `/tools/github/pr-review-tool` supplies local evaluation
credentials; it does not automatically populate organization Actions secrets.
Never place provider keys or the App private key in the repository configuration.

## Caller and trusted configuration

Pin `.github/workflows/review.yml` from the tool repository to the full, reviewed
40-character commit SHA containing the approved route and required fixes.
Replace `FULL_REVIEWED_COMMIT_SHA` before committing this caller example:

```yaml
name: PR review
on:
  pull_request_target:
    types: [opened, synchronize, ready_for_review]
  issue_comment:
    types: [created]
permissions:
  actions: read
  contents: read
  pull-requests: read
jobs:
  review:
    uses: Pocket-Trash/pr-review-tool/.github/workflows/review.yml@FULL_REVIEWED_COMMIT_SHA
    with:
      app-id: ${{ vars.PR_REVIEW_APP_ID }}
      app-slug: ${{ vars.PR_REVIEW_APP_SLUG }}
    secrets:
      APP_PRIVATE_KEY: ${{ secrets.PR_REVIEW_APP_PRIVATE_KEY }}
      CHEAPER_INFERENCE_API_KEY: ${{ secrets.CHEAPER_INFERENCE_API_KEY }}
```

Keep the trusted `.github/pr-review.json` on the base branch. It supplies the
approved provider and exact model ID, review prompt, selected skills,
`generatedFiles`, and `limits`. Use the tool's validated configuration fixture
as the schema reference. Preserve these generated-file exclusions:

```json
["pnpm-lock.yaml", "**/drizzle/meta/**", "**/drizzle/**/snapshot.json"]
```

The tool's `skills/manifest.json` pins the skills CLI, source commits, and skill
names. Updating a consumer's workflow SHA also selects that reviewed manifest.
The coordinator and writing skills are always selected; technical specialists
are selected from file paths, package ownership, and dependencies.

## Limits and trust boundary

The reviewer reads PR metadata, diffs, and source through GitHub APIs as data.
It does not check out or execute contributor code. OpenCode permits only reads,
glob, grep, and selected skills. Analysis receives the selected model key;
publication receives a short-lived, repository-scoped App token separately.

Generated files are omitted before calculating limits and listed as coverage
gaps. Individual files over 512 KiB are omitted. Remaining reviewable diffs over
100 files, 1 MiB, or 20,000 changed lines receive a neutral result before model
execution. Each model invocation is limited to 15 minutes. Published comments
are limited to 60,000 characters. Sanitized artifacts are capped at 1 MiB and
retained for 90 days; they exclude source and diff contents.

## Verify adoption

1. Open a non-draft fork PR against the base branch containing the caller and
   trusted configuration. Confirm the App creates one review comment and a
   check on the exact PR head SHA. Inspect the run to confirm contributor code
   was never executed.
2. Push a new commit. Confirm the previous run is superseded and the existing
   comment updates to the new SHA.
3. Post the exact command `!pockettrash review` as a collaborator with effective
   `write`, `maintain`, or `admin` access. Confirm a same-SHA rerun updates the
   existing result without adding another comment.
4. Confirm draft updates, ordinary comments, unauthorized commands, and
   reopen-only events do not start model execution.

Reviews are advisory: findings do not fail the check. A completed, validated,
published review succeeds; supported context-limit skips are neutral;
operational failures fail. After verifying the live App check's actual name,
the repository owner can add it to a ruleset if operational review success is
required for merging.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| App authentication fails | App ID, private key, selected-repository installation, and requested permissions |
| Publication identity fails | Verified App slug matches `app-slug` |
| Model authentication fails | Organization secret is shared with this consumer and matches the selected route |
| No automatic run | PR is open and non-draft; event is opened, synchronize, or ready_for_review |
| Manual command is ignored | Exact command on a PR; commenter's effective repository permission is sufficient |
| Review has coverage gaps | Generated/oversized files, context limits, or unavailable specialist evidence |
| Old result is not published | A newer head or authorized run superseded it |
| Provider or model fails evaluation | Review the committed ledger and runner version; obtain the owner's route decision before rollout |
