# Resource Storage

Pocket Trash stores downloadable resources in the shared Bunny Storage Zone and
serves protected files through its linked Pull Zone.

## Bunny services

| Service | Value |
| --- | --- |
| Storage Zone | `pocket-trash-storage` |
| Storage tier | Standard |
| Primary region | New York (`NY`) |
| Pull Zone | `pocket-trash` |
| CDN hostname | `cdn.pocket-trash.app` |

Use the Storage Zone password, not the Bunny account API key, as
`RESOURCE_STORAGE_ACCESS_KEY`. Keep every `RESOURCE_*` value server-only.

## Object namespaces

| Environment | `RESOURCE_FOLDER_PREFIX` | Object path root |
| --- | --- | --- |
| Production | `resources/files` | `resources/files` |
| Local | `resources/dev` | `resources/dev` |
| Shared preview | `resources/preview` | `resources/preview` |
| Isolated preview | `resources/preview/pr-<number>` | `resources/preview/pr-<number>` |

The PR deploy workflow selects shared or isolated preview storage alongside the
database namespace. The close workflow deletes only the matching isolated PR
prefix.

## Upload limits

Each version accepts 1–10 files up to 4 MiB each. Filenames must be unique
within a version, case-insensitively. Allowed extension and MIME pairs are:

- `.stl`: `model/stl`, `application/sla`, `application/octet-stream`
- `.3mf`: `application/vnd.ms-package.3dmanufacturing-3dmodel+xml`
- `.step` and `.stp`: `model/step`, `application/step`
- `.pdf`: `application/pdf`
- `.txt`: `text/plain`
- `.zip`: `application/zip`, `application/x-zip-compressed`

The server generates object names. Upload callers provide file bytes, the
original filename, and the MIME type but cannot provide an object path.
