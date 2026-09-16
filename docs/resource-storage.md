# Resource Storage

Pocket Trash stores downloadable resources in a dedicated Bunny Storage Zone
and serves public files through its linked Pull Zone.

## Bunny services

| Service | Value |
| --- | --- |
| Storage Zone | `pocket-trash-resources` |
| Storage tier | Standard |
| Primary region | New York (`NY`) |
| Pull Zone | `pocket-trash-resources` |
| CDN hostname | `pocket-trash-resources.b-cdn.net` |

Use the Storage Zone password, not the Bunny account API key, as
`RESOURCE_STORAGE_ACCESS_KEY`. Keep every `RESOURCE_*` value server-only.

## Object namespaces

| Environment | `RESOURCE_FOLDER_PREFIX` | Object path root |
| --- | --- | --- |
| Production | `files` | `pocket-trash-resources/files` |
| Local | `dev` | `pocket-trash-resources/dev` |
| Shared preview | `preview` | `pocket-trash-resources/preview` |
| Isolated preview | `preview/pr-<number>` | `pocket-trash-resources/preview/pr-<number>` |

The PR deploy workflow selects shared or isolated preview storage alongside the
database namespace. The close workflow deletes only the matching isolated PR
prefix.

## Upload limits

Version 1 accepts files up to 4 MiB. Allowed extension and MIME pairs are:

- `.stl`: `model/stl`, `application/sla`
- `.3mf`: `application/vnd.ms-package.3dmanufacturing-3dmodel+xml`
- `.step` and `.stp`: `model/step`, `application/step`
- `.pdf`: `application/pdf`
- `.txt`: `text/plain`
- `.zip`: `application/zip`, `application/x-zip-compressed`

The server generates object names. Upload callers provide file bytes, the
original filename, and the MIME type but cannot provide an object path.
