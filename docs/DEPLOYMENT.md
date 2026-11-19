# Cloudflare Pages production deployment, 19 November 2026

**Live synthetic application:** https://taiyous-manga-library.pages.dev/
**Repository:** https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library
**Release branch:** `master`. The Cloudflare Pages Git integration automatically publishes commits from `master`. The previous GitHub Pages publication job was removed and is **not** a production route.

The owner permits non-destructive merges and subsequent deployments unless explicitly stopped. Merge only after the mandatory GitHub Actions quality and browser checks succeed. Then verify the **actual** deployed bundle via [`live-cloudflare-smoke.yml`](../.github/workflows/live-cloudflare-smoke.yml). A green PR job is not deployment verification.

## Cloudflare configuration

| Setting | Value |
| --- | --- |
| Framework | React/Vite |
| Production branch | `master` |
| Build | `npm ci && npm run build` |
| Output | `dist` |
| Node | 22 |
| Live host | `https://taiyous-manga-library.pages.dev/` |

The public bundle includes **only fictional sample manga pages**. There is no authenticated dataset integration, no private provider secrets, no permanent owner deletion and no automatic multi-device sync. Never configure HF secrets as `VITE_*` environment values, include them in Pages public files or commit private media.

## Release and rollback

1. Create a focused feature branch from latest `master`, run `npm ci`, typecheck, tests, production build, Playwright and bundle budgets.
2. Create a PR, fix all failing checks, and merge only a green head SHA.
3. Verify the master CI and Cloudflare live smoke job, deep-linked routes, page assets, theme logo and service-worker release fingerprint.
4. If deployed smoke fails, diagnose Cloudflare build/deployment before asserting that release is live. Roll back to last known-good Cloudflare deployment or revert the PR, without clearing device-local progress or downloaded media.
5. Do not delete private data, rotate secrets or reconfigure owner account permissions as part of routine UI release.

Owner dashboard action may still be required for enforcing protected branch PR checks, production environment gates and server secret setup; the GitHub integration cannot read master protection settings.

## Historical GitHub Pages plan, retained for context

Everything below describes the **superseded** 18 November deployment proposal, including a no-longer-configured GitHub Pages publisher. Do not follow it as current procedure.

---

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
