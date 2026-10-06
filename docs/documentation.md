# Documentation

Store documentation according to its purpose.

## Repository guides

Use `docs/` for current instructions and how-to guides for developing, operating,
or contributing to this repository.

## Research and findings

Store research, investigations, measurements, comparisons, and findings in a
Linear document.

- Attach the document to an issue when it supports one issue.
- Attach the document to a project when it supports several project issues.
- Attach the document to the Engineering team when it applies across projects.
- Link related issues, projects, pull requests, and source material from the
  document.

## Engineering decision records

When research leads to a durable engineering decision, summarize the accepted
decision in `decisions/<bucket>/` and link the Linear research document. Keep
evidence and exploratory notes in Linear instead of copying them into the
decision record.

Use one of these buckets:

| Bucket | Decisions about |
| --- | --- |
| `architecture` | System boundaries, interfaces, and design patterns |
| `data` | Data models, storage, retention, caching, and migrations |
| `delivery` | CI, validation, releases, and deployment |
| `developer-experience` | Tooling and contributor workflows |
| `platform` | Hosting, infrastructure, and managed service providers |
| `product` | Durable user-facing behavior and product policy |
| `security` | Authentication, authorization, privacy, and secrets |
| `operations` | Reliability, observability, backups, and incident handling |

Store architecture decision records in `decisions/architecture/`. An ADR is an
architecture-specific engineering decision record.

Do not create empty bucket directories. Create `decisions/` and the selected
bucket when adding its first record.

Prefix each decision-record filename with the lowercase Linear issue or project
identifier, followed by a lowercase kebab-case title. For example:
`decisions/delivery/eng-298-ci-validation-strategy.md`.

## Supporting assets

Put scripts, fixtures, or data required to reproduce a finding beside the code
they exercise. Link those assets from the Linear document and decision record.
