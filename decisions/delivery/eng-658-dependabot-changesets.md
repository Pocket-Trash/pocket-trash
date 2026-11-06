# Dependabot Changeset pilot

Version updates start paused (`open-pull-requests-limit: 0`). The temporary
candidate is the root `yaml` declaration: it is outside ENG-663–667 ownership,
and mature 2.9.1 can raise the current ^2.9.0 minimum using `increase`.
Compatible updates form one group; majors stay separate for human assessment.
The schedule is Monday 04:00 America/Toronto with seven-day cooldown.
Explicit `target-branch: main` keeps these version-update settings separate from
security-update configuration under GitHub's documented target-branch behavior.
Existing audits, alert settings and security PR controls are unchanged.

The writer runs trusted base code under `pull_request_target`. It reads actual
PR identity, repositories, head, changed files and manifests through GitHub APIs.
It never checks out, installs or executes the PR head. It accepts dependency-only
stable patch/minor changes in known manifests, preserves valid human Changesets,
and leaves unknown, major and lock-only cases for assessment. Root tooling maps
to the actual apps; package-local updates map to their known package.

The only generated path is `.changeset/dependabot-<PR>.md`, with patch impact.
Commits use `[dependabot skip]`; an unchanged marker is a no-op. Bot refreshes
can regenerate a stale marker. Per-PR concurrency and a non-forcing Git ref
update parented to the inspected head prevent overwriting a changed branch.
Unexpected files, unrelated human commits and API failures stop the writer.

## Activation and proof

1. Merge this paused foundation after review. The trusted workflow must exist
   on the PR base before it can be exercised as designed.
2. Provision repository-scoped Dependabot secrets `FONTAWESOME_PACKAGE_TOKEN`,
   `INFISICAL_GITHUB_IDENTITY_ID`, `INFISICAL_PROJECT_SLUG`, `INFISICAL_DOMAIN`
   and `INFISICAL_OIDC_AUDIENCE` from the existing configuration. Font Awesome
   is scoped to npm.fontawesome.com. Existing CI retains read tokens and its
   explicit per-job OIDC permissions; the writer receives no Infisical secrets.
3. Temporarily set the cap to 1 for YAML only. Verify the real bot PR, generated
   marker and final amended SHA. Observe GitHub's actual approval/run behavior;
   a maintainer may need to approve CI. GITHUB_TOKEN writes can suppress new
   workflow events, so missing checks are a blocker, not a passing result.
4. Require normal checks on the final head. Test bot refresh/idempotency and
   human-impact handling for a major fixture. Do not auto-approve, automerge,
   mark checks passed, broaden privileges or switch to a release App key.
5. Record the proven immutable writer/workflow revision and package mapping in
   the project audit before ENG-659–662 consume the contract. After successful
   pilot qualification, test the planned cap 10, then restore paused broad
   version updates until ENG-668 enables full maintenance after refresh merges.

A failed pilot rolls back only the new version-update automation to cap 0.
Retain security alerts, audits and merge gates. No release, production deployment
or reviewer promotion belongs to this workflow.

The real pilot and immutable contract remain unproven until the merged-base
run and final-head checks succeed. This foundation does not complete ENG-658.

Sources: [project audit](https://linear.app/pocket-trash/document/dependency-policy-audit-current-78edd78bd2e9),
[GitHub Dependabot options](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference).
