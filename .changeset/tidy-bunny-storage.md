---
"@app/api": minor
"@app/web": minor
"@app/scraper": minor
"@package/database": minor
"@package/services": minor
"@package/storage": minor
"@package/logger": minor
"@package/eslint": minor
---

Unify uploads and safe cleanup through shared storage sessions, preserve originals up to 25 MiB, and optimize image delivery with Bunny Dynamic Images.

Require an explicit valid scraper image folder prefix at startup and remove the production namespace fallback.

Log storage mutations and cleanup retries, queue physical deletion after database commit, and consolidate storage configuration and app import boundaries.
