# Demo deployment runbook: GitHub Pages now, Cloudflare Pages later

**Status:** Public synthetic-code demo only. Private manga media, authentication, progress sync and imports are NOT implemented.  
**Owner approval:** Public source repository and sample live preview approved 18 November 2026.  
**Production data:** None. Never upload personal records or protected manga to the static host.

## Option A: Automatic public sample preview via GitHub Pages

The `.github/workflows/ci.yml` workflow runs Node 22 `npm ci`, TypeScript, unit tests, Vite build and Playwright Chromium tests. The gated `public-demo` job runs **only after all quality checks pass on a push to `master`** and publishes `dist/` to GitHub Pages using `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, and `actions/deploy-pages@v4`. It does not run on PRs, and it does not need credentials or private media.

Vite `--mode ghpages` sets the correct base path `/Taiyous-Manga-Library/`. The normal build still uses `/` for Cloudflare Pages.

1. Once the PR is approved and merged, check the `Verify Manga Library` workflow on `master` and the `Publish synthetic demo to GitHub Pages` job.
2. The Pages action attempts initial enablement. If it fails with a Pages source/permission error, the owner must open GitHub **Settings → Pages → Build and deployment → Source: GitHub Actions**, then rerun the workflow. Do **not** disable test gates.
3. Confirm that the URL from the deployment output serves the app on mobile and desktop, and that all assets load with the repository subpath.
4. To undo the public demo, disable Pages in repository settings; this does not touch private media or external apps.

**Warning:** GitHub Pages site is public. The fiction-only demo is safe to publish, but **never connect personal manga content or owner-only UI to this host without a separate audited server-side auth design**.

## Option B: Cloudflare Pages Git integration (owner dashboard action required)

Cloudflare Pages is the preferred long-term **independent app shell**, but this session does not have a connected Cloudflare account or deployment credentials. The owner must authorise a new Pages application in [Cloudflare dashboard](https://dash.cloudflare.com/).

In **Workers & Pages → Create → Pages → Import an existing Git repository**, authorise the GitHub repository `AdityaSreevatsaK/Taiyous-Manga-Library` for the Cloudflare account and configure:

| Setting | Value |
| --- | --- |
| Project | `taiyous-manga-library` (or another unclaimed project name) |
| Production branch | `master` |
| Framework | React (Vite), or None if unavailable |
| Root directory | `/` |
| Build command | `npm ci && npm run build` |
| Build output directory | `dist` |
| Node version | 22 (set `NODE_VERSION=22` if build image requires it) |

The deployed page must be verified in the Cloudflare dashboard, then its actual `pages.dev` URL confirmed. Do not guess the hostname: project names can be taken. `public/_headers` provides security headers on Cloudflare Pages; GitHub Pages does not process this file as response headers.

**Future integration:** Backend Functions, private authentication, private asset storage, offline controls, permissions and ownership checks each need separate approval, audits and backup/recovery verification. A public static demo is not suitable for real private manga datasets.

## Release, rollback and safety checks

- CI quality and browser tests must pass before merging to `master`.
- Check live pages for correct mobile controls, reader state and zero external media requests.
- Avoid release tokens, VITE_* secrets, storage credentials and real media on static hosts.
- GitHub Pages rollback: revert the merged code on `master`; automated tests precede subsequent publish.
- Cloudflare Pages rollback: use the dashboard's previous deployment restore/redeploy option after confirming its current capabilities.
- No permanent deletion or migration is performed by either deployment.
