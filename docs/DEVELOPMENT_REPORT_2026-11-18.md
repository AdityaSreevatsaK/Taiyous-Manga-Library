# Development and verification report: Manga fixture reader

**Date:** 18 November 2026  
**Branch:** `feature/local-manga-catalogue-reader`  
**Base:** `master` at `a0eb1e602469c0820475c0b450cdaed8ee62115d`  
**Environment:** Node.js 22.16.0, npm 10.9.2, no configured outbound DNS or dependency cache.

## Implementation in this branch

- Opaque series/chapter/page IDs, runtime validation for series, chapters, progress, manifests, rights and archive-entry metadata.
- Untrusted relative asset path rejection including traversal, foreign URLs, MIME/extension mismatches, script-bearing SVG and oversized dimensions.
- Fictional fixture catalogue with search, Unicode/aliases, tag/status/collection filters, sort, series details, volume/chapter selection and honest empty state.
- Browser-generated original abstract PNG pages, one visible page and at most one immediate neighbour in the in-memory URL cache. No fetch to media providers or cloud services.
- RTL/LTR physical navigation, vertical page-step mode, swipe and keyboard logic, chapter-boundary handling, and exact page progress preserved **within this React session only**.
- Offline device indication. Synthetic pages work without connectivity; private offline download/caching is **not implemented**.
- Unit tests for validation, malformed files, archive metadata, ordering, navigation, missing pages, bounds, exact resume and catalogue filters. Server-rendered semantic catalogue tests added.
- Proposed source-rights/private-adapter ADR and Shared Core RFC (no cross-repo modifications).

## Quality checks, precisely stated

### GitHub Actions on original master

The latest original workflow run [44256824021](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/actions/runs/44256824021) ended in `failure` after approximately two seconds. Job `quality` exposes **no executed steps and no logs**. GitHub reports two annotations on the check, but the current connection does not support reading the check-annotation endpoint. No evidence indicates a source test ran. The exact runner, billing or account-level cause remains unverified.

### Local execution attempted

- `node --version`: **v22.16.0**.
- `npm --version`: **10.9.2**.
- `npm install --offline --no-audit --no-fund`: **blocked** with `ENOTCACHED`; `@types/react` is not cached.
- `npm install --no-audit --no-fund --fetch-retries=0 --fetch-timeout=3000`: **blocked** with `EAI_AGAIN` due to DNS resolution of `registry.npmjs.org`.
- An unrelated minimal empty local lockfile created by the first setup attempt was discarded. No `package-lock.json` has been committed to GitHub.
- `npm run typecheck`: **not a meaningful source check**. Dependencies and project source were unavailable in the local sandbox, so the global TypeScript CLI showed usage information. It is not a compilation result.
- `npm test`: **not run**; `vitest: not found`.
- `npm run build`: **not run**; Vite/React dependencies unavailable.

The source was committed through the connected GitHub API; npm packages and a lockfile were **not generated**. Do **not** claim green typecheck, tests or build. Do not switch CI to `npm ci` until a genuine lockfile is created with the intended dependencies and reviewed. The original CI continues using `npm install` until that happens. Browser automated tests and viewport checks remain unrun.

## Reproduction steps on an online machine

```powershell
git switch feature/local-manga-catalogue-reader
node --version
npm install --no-audit --no-fund
npm run typecheck
npm test
npm run build
npm run dev
```

Commit the generated `package-lock.json` and switch workflow install to `npm ci` in a follow-up commit on this branch. Confirm checks actually enter their steps, then measure bundle size from `dist/assets`. Keep network requests disabled or restricted to localhost in browser verification.

## Browser manual acceptance matrix (NOT yet run)

Viewports: **320, 375, 390, 768, 1280 px**. At each size verify shelf, card labels, filter controls, no horizontal overflow, details, chapter list and reader navigation. With keyboard: Tab through all controls, Enter to select a series, focus the reader and press arrows (RTL: Left=next, LTR: Right=next, vertical: Down=next), return to details, resume exact page. On touch: swipe in both directions and confirm chapter transitions. Disable network and check synthetic pages still render; select the unconnected library and confirm truthful empty state. Corrupt a fixture page deliberately and verify an error with retry rather than an automatic skip.

## Security and data review

There is **no** authentication, source integration, private catalogue, background download, permanent deletion, storage adapter or automatic deployment. The only page image sources are generated with canvas at runtime. No private data or tokens were added to Git. Personal annotation and sync are deliberately deferred. The source-rights and private adapter ADR is proposed, not authorised.

## Risks and next steps

1. Restore GitHub Actions runner execution and inspect job annotations in account Settings/Actions/Billing. It could be an account-level restriction, but that is not yet proven.
2. Run online npm install and all three quality commands, fix actual errors, then commit the authentic lockfile and change CI to `npm ci`.
3. Add Playwright or comparable responsive interaction tests once the dependency chain is available; the current server-rendered tests do not replace a browser run.
4. Verify a small-screen reader, real-device swipe focus and memory usage. Current vertical mode changes pages, **not** continuous long-strip scrolling.
5. Approve source rights, storage and authentication choices before any actual manga is uploaded.

## Playwright tests added after the initial report

A real-browser test entry point (`npm run test:e2e`) and `playwright.config.ts` were committed with an explicit `@playwright/test` dev dependency. The suite covers 320/375/390/768/1280px, filters, sample/private empty states, keyboard and touch navigation, chapter boundaries, exact resume, offline network isolation and corrupt image generation/retry. **These tests remain unexecuted** due to missing dependencies, browser binary and failed pre-step Actions scheduling. Run `npx playwright install chromium` before `npm run test:e2e` on an online machine.

## Follow-up on 18 November, after owner-reported visibility change

The connected GitHub repository API **still reports `visibility: private`**. Fresh PR Actions run [44313408708](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/actions/runs/44313408708) recorded the quality job as failure before runner steps, while dependent browser tests were skipped. The rerun of [44280940971](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/actions/runs/44280940971) similarly failed with no steps. This is a runner/account/repository visibility diagnostic, **not** a TypeScript/Vitest/Playwright failure. The owner-reported visibility change is not independently confirmed by the authenticated repository metadata; do not claim it is publicly accessible.

The feature branch now adds an explicit manual trigger plus separate quality/browser GitHub Actions jobs, and automatically prefers `npm ci` when a real lockfile exists. Until a genuine lockfile can be installed and committed, CI bootstraps with `npm install`. Chromium checks run only after a successful quality job, with browser failure artefacts retained for seven days. Reader progress is now written only after the relevant image loads, and failed pages cannot be skipped by buttons, swipes or keyboard.

The local reader additionally offers a bounded, one-based **Go to page** selector while retaining zero-based internal progress. A dedicated browser test checks page 5 resume and switching chapters. The new selector and browser test are committed but unverified.
