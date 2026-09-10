# One Ember on Vercel

The project deploys as a static Vercel site. Connect the GitHub repository to a
new Vercel project with the repository root as its Root Directory; the checked
in `vercel.json` supplies the build and output settings. No token, project id,
or `.vercel` directory belongs in Git.

Every GitHub branch receives a Vercel preview. `main` is the production branch.
The project root rewrites to `/film/`, the fourteen-beat master film.

## What the build publishes

Run this before connecting or after changing delivery code:

```powershell
.venv\Scripts\python.exe data\check_vercel_static.py
```

It creates `.vercel/output/static` and verifies it. The artifact includes only
the public runtime pages and data; it excludes raw ETOPO inputs, local Python
environments, browser screenshots, audit tooling and source-control metadata.
The verifier also rejects an artifact at or above 100,000,000 bytes, keeping
this release surface within the documented Hobby static-upload figure.

Terrain-RGB files are copied to `/terrain/<name>.<sha256>.png|webp`. These are
the only resources configured as immutable for a year. A changed source byte
changes its URL, so a new deployment cannot reuse an old elevation field.
`slice/data/terrain_delivery.js` is revalidated instead: it names the current
immutable files for the progressive terrain loader.

## First deployment

1. Push the repository to GitHub.
2. In Vercel, import that repository and leave deployment on the default Git
   integration. Confirm the preview URL opens the master film at `/`.
3. On the preview, inspect a terrain object response. Its `Cache-Control` must
   be `public, max-age=31536000, immutable`; the delivery-map response must
   revalidate rather than be immutable.
4. Use the preview for the visible-window, cold-cache Slow 4G trace described
   in `ASSET_CONTRACT.md`. Headless verification does not supply that evidence.
5. When a final hostname is selected, add it in Vercel and create the exact DNS
   record Vercel asks for in Cloudflare. Start DNS-only so Vercel can provision
   TLS and its cache headers remain directly observable.

There is intentionally no service worker yet. A stale cached historical/data
release is worse than a repeat visit that has to validate its small map file;
Phase 4 does not claim offline operation.
