# Current quality gates (18 November 2026)

The baseline on `master` passed 19 unit tests and 12 Playwright tests at widths 320/375/390/768/1280. Latest overall workflow failed in GitHub Pages publish configuration. PR A adds continuous vertical-scroll, bounded image window, 430/1024 widths, focus/landscape and broken image tests. **PR A tests are not confirmed passing until GitHub Actions executes them.**

Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. Review Playwright failure traces. Validate both viewport and fullscreen scrolling without false progress writes, as well as 320px safe areas and keyboard focus. Final real-device swipe and memory benchmarks remain manual acceptance.

---

# Test Strategy and Quality Gates

## Commands
`npm run typecheck`, `npm test`, `npm run build`. The initial workflow runs all three on pull requests and master; no browser E2E or deployed smoke exists yet. Do not claim they do.

## Testing layers
1. **Pure unit:** search, identity, sorting, status transformations, MangaEntry, MangaChapter, MangaProgress, invalid/empty inputs and Unicode names.
2. **Component:** keyboard and screen-reader labels, focus order, 320–390px overflow, 768px tablet and desktop layouts. Use deterministic fixtures with no private media.
3. **Repository adapter:** CRUD boundaries, lossless migrations, duplicate IDs, stale revisions, injected errors, cancellation and retries.
4. **Privacy/security:** redaction, invalid input, absent/expired session, forbidden mutations, path traversal, oversized payloads and unsafe URLs.
5. **Offline and sync:** cold offline launch after a controlled cache, browser eviction, two-device conflicting edits, tombstone protection, correct rehydration and recovery.
6. **Domain-specific:** Fixtures prove correct RTL/LTR page ordering, chapter transitions, resume on exact page, keyboard/touch operation and offline behaviour without exposing private image assets.

## Acceptance gates for a feature PR
Every new path has a positive, negative and boundary case. Tests fail on regressions and must not require external tokens. Assertions verify user-visible behaviour, not just DOM presence. Add a reproducible manual plan for gestures/real devices where automation is not possible.

## Release gates (future)
Successful locked install, typecheck, tests, build, vulnerability review, browser mobile/desktop checks, private endpoint auth tests, performance review, real-device sign-off and rollback verification. A green CI alone does not authorise deployment. Record the build SHA and scope.

## Risk register
Initial scaffolds intentionally omit persistence, authentication, image/video delivery, end-to-end tests, production CSP configuration and provider integrations. These omissions are documented, not hidden.


## Fixture reader branch test inventory (written, not executed)

`src/domain/validation.test.ts`: valid and duplicate series/chapter IDs, page formats and paths, malicious traversal/URL/SVG input, manifest limits, page-index bounds, rights evidence and archive-entry preflight.
`src/domain/reader.test.ts`: stable chapter sequence, forward/back chapter boundaries, corrupt/missing manifest rejection, physical RTL/LTR/vertical key/swipe mapping, one-page preloading and exact resume.
`src/domain/filters.test.ts`: alias search, status, tag, collection and sort semantics.
`src/data/fixtures.test.ts`: synthetic provenance, coherent page counts and local paths.
`src/App.test.tsx`: React server-rendered catalogue and honest unconnected-library empty state.

**These test files have been committed but could not run:** npm registry DNS is unavailable, and GitHub Actions has not started any job steps. The React markup tests are *not* interactive browser coverage. Browser verification plan is in `docs/DEVELOPMENT_REPORT_2026-11-18.md`; a future Playwright suite must exercise interactions at 320, 375, 390, 768, 1280 px, chapter transitions and failed image/offline flows. No test pass claim is authorised yet.

The separate `e2e/manga-reader.spec.ts` Playwright suite adds **unexecuted** responsive/browser interaction tests for source switching, filters, keyboard navigation, physical swipes, RTL/LTR/vertical selection, chapter boundaries, exact session resume, synthetic offline operation, corrupt canvas error and retry, and no non-local requests. Install browser binaries with `npx playwright install chromium`, then run `npm run test:e2e` once npm dependencies are available. CI has not reached runner steps.

The reader now requires a loaded active image before page navigation and commits progress only on `img.onload`. The browser corruption test asserts Next/Previous disabled, Retry remains on the same page, and returning to the series does **not** display Continue Reading. CI has two separate jobs, plus `workflow_dispatch`, and retains Playwright failure artefacts. These are committed checks, **not** confirmed passing results.
