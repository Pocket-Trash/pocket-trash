# Vercel

`apps/web` deploys to Vercel. Production web deploys are owned by the
tag-triggered GitHub release workflow, not by automatic Vercel deploys from
`main`.

## Production Deploys

The `Deploy` workflow deploys production web on pushed `v*` tags:

1. Validates `@app/web`.
2. Pulls the Vercel production environment.
3. Builds with `vercel build --prod`.
4. Deploys with `vercel deploy --prebuilt --prod`.
5. Smoke-tests the resulting production deployment URL.

## Production Domain Gating

`apps/web/vercel.json` disables automatic Vercel Git deployments from `main`:

```json
{
  "git": {
    "deploymentEnabled": {
      "main": false
    }
  }
}
```

Confirm the same behavior in Vercel:

1. Go to the Vercel Dashboard and select the `apps/web` project.
2. Open Settings in the sidebar.
3. Go to Environments -> Production.
4. Under Branch Tracking, disable the Auto-assign Custom Production Domains
   toggle.
5. If the Vercel project root is not `apps/web`, move the same
   `git.deploymentEnabled` config to the configured Vercel root or disable
   automatic production domain assignment in the dashboard.

Branch previews should remain enabled through Vercel's Git integration.

The preview workflow's API helper bounds each connection to 15 seconds and each
request to 60 seconds. GET requests retry transient failures up to four times
within a 180-second retry window. Writes, including deployment creation, are
sent once so an ambiguous response cannot create duplicate deployments.
