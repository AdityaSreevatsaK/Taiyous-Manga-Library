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
- `npm install --offline --no-audit --no-fund`: **blocked** with `ENOTCACHED` because npm registry packages are not cached (first missing package: `@types/react`). The environment cannot resolve github.com and has no npm registry access.
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
