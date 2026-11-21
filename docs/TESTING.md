# Testing and release verification

## Current automated quality gates

### Main workflow: Verify Manga Library

.github/workflows/ci.yml runs on master pushes, pull requests and manual dispatch. It uses Node 22 and npm ci.

Quality job:
1. npm run typecheck
2. npm test (Vitest)
3. service-worker fingerprint tests
4. two-release offline transition tests
5. npm run build
6. scripts/check-bundle.mjs
7. bundle asset reporting

Browser job runs after quality:
- Installs pinned headless Chromium.
- Builds the production app.
- Runs E2E_PRODUCTION=1 npm run test:e2e against Vite preview.
- Retains Playwright traces/screenshots on failure.

### Cross-browser workflow

.github/workflows/cross-browser.yml builds the production app and runs e2e/cross-browser.spec.ts in Firefox and WebKit. This is a focused reader/navigation smoke suite, not a full parity suite in every browser.

### Live Cloudflare smoke

.github/workflows/live-cloudflare-smoke.yml builds the current master commit and checks:
- Public homepage and React shell.
- Expected built asset names are served.
- SPA deep links, including manga/chapter routes.
- Deployed service-worker release fingerprint.
- Required public security headers.
- Anonymous private API requests return private no-store JSON denial.
- OAuth login redirects to Hugging Face through a secure redirect.
- Built assets are non-empty.

This workflow verifies the public deployment and anonymous security boundary. It does not sign in as the owner or read private manga.

## Latest verified master evidence in the 21 November 2026 snapshot

All three runs passed for master SHA ff519fc175bb61e234bbdea278679e32afd97fe5:

- [Typecheck, unit tests, build and Chromium](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/actions/runs/44918275621)
- [Firefox and WebKit](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/actions/runs/44918275594)
- [Cloudflare live smoke](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/actions/runs/44918275658)

This is a dated evidence record. Check current GitHub Actions before making a new release claim.

## Important test suites

- src/domain: IDs, validation, routing, filters, reader ordering, progress, personal records, backup import/export, collections, advanced discovery, analytics and chart date calculations.
- src/data: private catalogue, cover cache, private media gateway, offline chapters and chapter preloader.
- functions/api/master.test.ts: protected metadata patch validation, immutable lineage, revisions and owner correction logic.
- src/data/privateLibrary.test.ts: catalogue response and private-library client behaviour.
- src/domain/mangaCloudGateway.test.ts and mangaPrivateMediaGateway.test.ts: legacy no-network port and private media identity validation helpers.
- e2e/manga-reader.spec.ts: reader journeys, progress, chapter controls, synthetic offline and responsive interactions.
- e2e/manga-master-parity.spec.ts: Master Controls, analytics metrics/events, owner edit gates and responsive dashboard parity.
- e2e/cross-browser.spec.ts: focused Firefox/WebKit route and reader checks.
- scripts/stamp-service-worker.test.mjs and scripts/sw-release-transitions.test.mjs: release fingerprint and two-version shell rollback.

Read the actual current test source before relying on the list; tests evolve with the implementation.

## Required acceptance for changes

- Domain changes: positive, invalid, boundary, duplicate-ID and legacy-data tests.
- API/security changes: anonymous, wrong-owner, expired session, invalid ID/path, wrong revision, invalid MIME/size/hash, upstream error and concurrency cases where relevant.
- Reader changes: exact page identity/resume, whole-chapter vertical scroll, chapter-only navigation, failed image handling and bounded image loading.
- Personal data changes: corruption preservation, stale writes, backup compatibility, explicit destructive confirmation and no unrelated record deletion.
- UI changes: accessible labels/focus, no horizontal overflow, 320/390/768/1280 px minimum and relevant split-screen/mobile widths.
- Service worker changes: complete staging, offline cold start, old verified shell retention and no deletion of chapter/user caches.
- Private integration changes: synthetic tests plus a disposable authorised dataset. Never expose live private media or credentials in public CI.

## Manual acceptance that automation cannot replace

- Owner sign-in and actual private cover/manifest/page rendering.
- Production Cloudflare secret and OAuth write-scope configuration.
- Real protected metadata correction and revision-conflict recovery on a disposable private dataset.
- Physical Android Chrome and iOS Safari behaviour.
- Low-memory 300–1,000-page image decode/scroll performance.
- Real browser storage eviction and restoration.

Record device, OS/browser, tested commit SHA, Cloudflare smoke URL, steps and result in docs/REAL_DEVICE_ACCEPTANCE.md. If not performed, say "Not tested". Firefox/WebKit automation is not proof of iOS Safari hardware behaviour.

## Test commands

    npm ci
    npm run typecheck
    npm test
    npm run build
    node scripts/check-bundle.mjs
    E2E_PRODUCTION=1 npm run test:e2e
    npx playwright test --config playwright.cross-browser.config.ts

Never remove a failing test or widen a bundle budget just to make CI green. Any budget change needs measured before/after output and a documented reason.
