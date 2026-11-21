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

Private media remain online-only. The **sample** reader supports its separate opt-in offline flow. Automatic cross-device personal progress synchronisation, private chapter offline downloads, and general browser-side private dataset writes are not implemented. Protected publication metadata corrections are documented below.

## Security

- Hugging Face OAuth uses owner-only authentication with a confidential server-side client and an encrypted HttpOnly session.
- Each private request verifies owner permissions and current private dataset revision; image responses are no-store, validated against MIME, exact byte length and SHA-256.
- The latency optimisation caches only bounded, revision-keyed *validated metadata*, never bearer tokens, image bytes, owner sessions or responses.
- Never use `VITE_*` variables for secrets. Do not commit actual manga covers, pages, token values or owner-only catalogue files.
- In Cloudflare, a production Pages Functions secret/configuration change must be handled independently of routine repository merges; destructive dataset actions require explicit approval.

**Latest confirmed release:** UI/cover/permalinks PR #47 and catalogue latency PR #48 merged on 20 November 2026. Both latest post-merge Cloudflare smoke workflows passed. This does not substitute for the owner-authenticated media check above.


## Protected Manga Master Controls, 21 November 2026

Configure Cloudflare Pages **Production Secret** `TAIYOU_OWNER_PASSPHRASE` to a strong distinct 16-128 character passphrase. Do not put this value in GitHub, public source, build variables or `VITE_*`. Owner source metadata edits use an opt-in Hugging Face OAuth flow `/api/auth/login-write` with `openid profile read-repos write-repos`, which the registered OAuth client must permit. The normal read-only login is unaffected. After login, unlock with the independent owner passphrase. A short-lived AES-GCM HttpOnly SameSite=Strict owner grant, bound to the current HF owner session, expires in 10 minutes. Only owner-authorised corrections of title, creators and source publication status can be committed to the private HF catalogue, with a parent revision guard, whole-catalogue validation and preserved manga/chapter/page IDs and legacy public slug. Uploads and private manga deletion remain in the Storage Controller. Analytics and device-local edits need no passphrase.

Test source corrections against a disposable private dataset with owner authentication and a verified backup before relying on live writes. Source editor visibility alone does not prove that the secret, OAuth scopes or provider commit API are configured. Live browser acceptance needs owner sign-in and protected images.
