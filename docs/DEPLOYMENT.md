# Production deployment

**Canonical production app:** https://taiyous-manga-library.pages.dev/  
**Host:** Cloudflare Pages with Pages Functions  
**Production branch:** master  
**Build:** npm ci && npm run build  
**Output:** dist  
**Runtime:** Node.js 22

## Deployment model

Cloudflare Pages Git integration deploys master. The application is a Vite React SPA; the functions/ directory provides same-origin private API routes. GitHub Pages is not the production host.

The public build contains application code, approved brand assets and synthetic demonstration data. Private catalogue metadata and original manga media are fetched through owner-authenticated Pages Functions. No private HF token, private dataset file, original manga page or owner passphrase belongs in dist or Git.

## Release process

1. Inspect current master, local Git status, open PRs and active checks.
2. Make changes on a short-lived branch and run npm ci, typecheck, Vitest, production build, bundle checks and relevant browser tests.
3. Open a PR. Merge only when the required quality and cross-browser checks pass on the exact final PR head SHA.
4. The owner permits routine non-destructive green PR merges and subsequent deployments without another approval. Do not merge a stale, cancelled or partial check.
5. Cloudflare automatically deploys the new master commit.
6. Verify the post-merge Live Cloudflare smoke workflow for that exact master SHA. It checks served asset names, SPA routes, service-worker fingerprint, security headers, anonymous private API denial, OAuth redirect and non-empty assets.
7. Report merge and deployment separately. A merged PR is not proof that Cloudflare deployed it.

## Cloudflare Pages settings

| Setting | Value |
|---|---|
| Production branch | master |
| Framework/build | Vite |
| Build command | npm ci && npm run build |
| Output directory | dist |
| Node.js | 22 |
| Production URL | https://taiyous-manga-library.pages.dev/ |
| OAuth callback | https://taiyous-manga-library.pages.dev/api/auth/callback |

## Pages Functions runtime configuration

Set the following in Cloudflare Pages runtime configuration. Never commit their values.

| Name | Purpose | Secret |
|---|---|---|
| HF_REPO_ID | Exact private dataset ID AdityaSreevatsaK/Taiyous-Manga | No |
| HF_OWNER_USERNAME | Exact owner identity | No |
| HF_CLIENT_ID | Dedicated confidential HF OAuth app ID | No |
| HF_CLIENT_SECRET | Confidential OAuth client secret | Yes |
| SESSION_SECRET | 32 cryptographically random bytes, base64 encoded | Yes |
| TAIYOU_OWNER_PASSPHRASE | Separate Master source-correction passphrase, 16–128 characters | Yes |

Normal OAuth login requests openid, profile and read-repos. The separate write login requests write-repos as well. The OAuth application must allow the exact callback above. Do not use VITE_* variables for any secret.

## Private data and owner acceptance

The private catalogue is read through GET /api/library. Private covers, manifests and pages are served through /api/media/* after owner authentication and validation. The browser never receives the HF access token or private HF URL.

Verified covers can be retained in bounded IndexedDB storage for faster repeat display and are cleared on logout. Private chapter pages are not downloaded for offline reading. The synthetic demo has its own explicit offline chapter flow.

The protected Master route can correct only title, creators and publicationStatus. It requires the owner passphrase grant and write-authorised HF session. Media upload, migration and deletion remain with the Storage Controller.

The automated live smoke is anonymous. It cannot prove the owner's OAuth login, actual private media rendering, the production owner secret or a real HF metadata commit. For those, follow docs/HF_READONLY_CONNECTION.md and record a genuine acceptance result.

## Current verified release evidence

At the 21 November 2026 documentation snapshot, master SHA ff519fc175bb61e234bbdea278679e32afd97fe5 had passing:
- [Quality and Chromium](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/actions/runs/44918275621)
- [Firefox/WebKit](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/actions/runs/44918275594)
- [Cloudflare live smoke](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/actions/runs/44918275658)

Check the current branch/SHA and latest runs before reusing these links as release evidence.

## Rollback

Revert the code change or redeploy the previous verified Cloudflare Pages build. The service worker keeps two complete verified shell releases. Do not clear user localStorage, private cover IndexedDB, synthetic chapter CacheStorage or private HF data as a generic rollback step. Dataset recovery is the Storage Controller's responsibility and requires its own verified backup/revision procedure.
