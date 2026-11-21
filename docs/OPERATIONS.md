# Development and operations

## Current environment

- Runtime: Node.js 22 or newer.
- Package manager: npm with committed package-lock.json.
- App: React 18, TypeScript strict mode, Vite.
- Tests: Vitest and Playwright.
- Hosting: Cloudflare Pages, master branch, output directory dist.
- Server routes: Cloudflare Pages Functions under functions/api.
- Private source: Hugging Face dataset AdityaSreevatsaK/Taiyous-Manga.
- No database service or shared application backend is used.

## Local setup

Clone the repository, then run:

    npm ci
    npm run dev

The Vite development server binds to 127.0.0.1. The app can be exercised with the synthetic sample without private credentials. Private OAuth/API routes are production-only and require the Cloudflare environment; a local Vite server does not prove those routes work.

## Required quality commands

    npm ci
    npm run typecheck
    npm test
    npm run build
    node scripts/check-bundle.mjs

Production-build Chromium browser tests:

    npm run build
    E2E_PRODUCTION=1 npm run test:e2e

PowerShell:

    npm run build
    $env:E2E_PRODUCTION='1'
    npm run test:e2e

Firefox and WebKit smoke:

    npm run build
    npx playwright install --with-deps firefox webkit
    npx playwright test --config playwright.cross-browser.config.ts

Install browser engines only when needed. Tests must use synthetic fixtures and must not require private HF tokens or real manga assets.

## Configuration

The public .env.example contains only the optional VITE_HUB_URL placeholder. VITE_* values are compiled into the browser and must never contain secrets.

Cloudflare Pages Functions runtime variables/secrets are configured in Cloudflare, not committed to this repository:

- HF_REPO_ID
- HF_OWNER_USERNAME
- HF_CLIENT_ID
- HF_CLIENT_SECRET (secret)
- SESSION_SECRET (secret, base64-encoded 32 random bytes)
- TAIYOU_OWNER_PASSPHRASE (Production secret for protected Master corrections)

Do not print, export or copy actual secret values into issue comments, logs, test output, handovers or docs. OAuth callback is https://taiyous-manga-library.pages.dev/api/auth/callback. Normal read login and optional write login use separate scopes.

## Branch and PR workflow

1. Inspect local Git status and current master before editing.
2. Create a short-lived branch from the latest master.
3. Keep changes scoped and add tests.
4. Update the current documentation and status snapshot.
5. Open a PR with problem, implementation, tests, compatibility, security impact and rollback.
6. Merge only when the exact final PR head SHA has required green quality and cross-browser checks.
7. After merge, wait for and verify the Live Cloudflare smoke on the exact master SHA.

The owner permits routine non-destructive green PR merges and deployment without another approval. Production secrets, destructive private data operations and changes to OAuth permissions still require explicit approval.

## GitHub Actions

- ci.yml: npm ci, typecheck, Vitest, service-worker tests, production build, bundle budgets and Chromium browser tests.
- cross-browser.yml: production build plus Firefox and WebKit reader/navigation smoke.
- live-cloudflare-smoke.yml: builds master and checks served asset names, SPA routes, service-worker fingerprint, security headers, anonymous private API denial and OAuth redirect.

A successful CI run is not the same as a Cloudflare deployment. A successful live smoke is not an owner-authenticated private media acceptance test.

## Data operations and ownership

This repository does not upload or delete manga originals. The separate Manga Storage Controller owns media ingestion, backups, catalogue migration and permanent media deletion. The Reader can refresh the catalogue and perform a narrow protected source metadata correction only.

Do not change the private HF dataset or Controller from this repository task. Do not add live media to public tests. For owner corrections, use the protected Master flow and test revision handling on a disposable dataset first.

## Rollback

For app code, revert the relevant PR or redeploy the previous verified Cloudflare Pages release. The service worker retains two complete verified shell releases. The shell cache is separate from synthetic chapter CacheStorage and private cover IndexedDB.

Do not clear localStorage, private cover cache, synthetic offline chapter cache or private HF data as a generic rollback step. Any data migration must have its own owner-approved backup and recovery plan.

## Operational checks

- Verify current master SHA and Cloudflare live smoke after release.
- Verify private OAuth/cover/chapter access as the owner when relevant.
- Check anonymous requests remain denied.
- Check no HF tokens/private URLs leak into browser requests or public assets.
- Check responsive layouts, keyboard focus and error/offline states.
- Review Dependabot changes one at a time with full CI, especially major React/Vite updates.
