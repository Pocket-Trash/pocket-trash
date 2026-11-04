# Retain selected CI and local PR validation

Status: accepted for the completed rollout; retain the current validation policy.

The [post-rollout measurement](https://linear.app/pocket-trash/document/eng-380-post-rollout-ci-cost-and-validation-yield-98e1588b1fac)
for [ENG-380](https://linear.app/pocket-trash/issue/ENG-380/measure-post-rollout-ci-cost-and-validation-yield)
observed 39.75 runner job-minutes per code-changing PR across 99 qualifying PRs
in the fixed October 8–21, 2026 window. This meets the agreed threshold of 40.5,
a 40% reduction from the 67.5 baseline. The observed reduction is 41.1%.
Metadata-only events produced no full code CI reruns in the included cohort.

Keep strict change classification, metadata-only validation for metadata edits,
selected `validate:pr` checks before publication, and the lightweight pre-commit
hook. This measurement does not justify widening default CI.

The Linear report owns the findings and exclusions. The
[sanitized evidence and offline replay](../../scripts/ci-cost/README.txt) live
beside the CI tooling. Run `python3 scripts/ci-cost/reproduce.py` from the
repository root to verify the totals and snapshot-order invariance.
Its local validation results are a partial recovered sample, not complete
rollout telemetry or a count of proven avoided CI failures. Before the next
measurement, capture structured local validation receipts and distinguish code
failures from environment and precondition failures. The runner target passes
by only 0.75 minutes per PR, so compare another complete fixed window before
assuming the reduction will persist across different feature mixes.
