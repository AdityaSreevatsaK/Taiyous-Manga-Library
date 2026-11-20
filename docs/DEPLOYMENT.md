# Manga Library production deployment

**Current as of 20 November 2026:** [taiyous-manga-library.pages.dev](https://taiyous-manga-library.pages.dev/) is the canonical live Cloudflare Pages application. `master` deploys automatically through Cloudflare's Git integration. GitHub Pages is not used for production.

## Build and hosting

| Setting | Value |
| --- | --- |
| Production branch | `master` |
| Platform | Cloudflare Pages with Pages Functions |
| Framework | React / Vite |
| Build command | `npm ci && npm run build` |
| Output directory | `dist` |
| Node.js | 22 |
| Live host | `https://taiyous-manga-library.pages.dev/` |

The static application contains only original demonstration art, styles and client-side code. Private catalogue metadata, authorised original manga covers and chapter pages are delivered only through same-origin owner-authenticated Pages Functions. The private Hugging Face dataset and provider tokens are never embedded in `dist/` or committed to GitHub.

## Release process

1. Create a feature branch from the latest `master`, keep data writes and secret configuration outside routine UI releases.
2. Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build` and production-browser tests. GitHub Actions also enforces compressed asset-size budgets, Chromium and Firefox/WebKit coverage.
3. Merge a PR **only after both mandatory test workflows pass on its actual head SHA**. The owner permits routine non-destructive merges without separate approval.
4. Cloudflare's production Git integration deploys the `master` commit automatically.
5. Verify the post-merge [Live Cloudflare smoke workflow](../.github/workflows/live-cloudflare-smoke.yml). It checks the exact asset hashes, SPA deep links, service-worker version, public headers, OAuth redirect and rejection of unauthenticated private reads. A green PR alone does not confirm deployment.
6. If a deployment fails, diagnose or revert its commit, and restore the last known-good Cloudflare deployment if necessary. Never clear personal browser storage or private HF data as part of rollback.

## Owner-authenticated acceptance

The live smoke workflow cannot access the user's OAuth session and does not prove that real covers or pages render to the owner. For a signed-in release check, open a known private manga and confirm that the original cover loads, a chapter opens, page images display correctly, progress is retained, and no private HF URLs or access tokens appear in the browser network panel.

Private media remain online-only. The **sample** reader supports its separate opt-in offline flow. Automatic cross-device personal progress synchronisation, private chapter offline downloads, and browser-side private dataset writes are not implemented.

## Security

- Hugging Face OAuth uses owner-only authentication with a confidential server-side client and an encrypted HttpOnly session.
- Each private request verifies owner permissions and current private dataset revision; image responses are no-store, validated against MIME, exact byte length and SHA-256.
- The latency optimisation caches only bounded, revision-keyed *validated metadata*, never bearer tokens, image bytes, owner sessions or responses.
- Never use `VITE_*` variables for secrets. Do not commit actual manga covers, pages, token values or owner-only catalogue files.
- In Cloudflare, a production Pages Functions secret/configuration change must be handled independently of routine repository merges; destructive dataset actions require explicit approval.

**Latest confirmed release:** UI/cover/permalinks PR #47 and catalogue latency PR #48 merged on 20 November 2026. Both latest post-merge Cloudflare smoke workflows passed. This does not substitute for the owner-authenticated media check above.
