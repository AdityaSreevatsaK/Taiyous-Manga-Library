# Reader reliability milestones, 18 November 2026

All milestones are implemented on **stacked draft PRs**, not merged or deployed to production.

- **PR A #10:** responsive reader, genuine continuous vertical mode, bounded images and focus view. 19/19 unit, 17/17 Chromium tests passed.
- **PR B #11:** stable URLs, native hyperlinks, direct chapters/pages, Back/Forward. 23/23 unit, 22/22 Chromium tests passed.
- **PR C #12:** isolated persisted exact progress, reader mode, fit/theme and scroll anchors. 29/29 unit, 27/27 Chromium tests passed.
- **PR D #13:** verified synthetic chapter downloads, offline shell, cold launch, corruption detection, safe deletion. 29/29 unit, 32/32 production-browser tests passed.
- **PR E #14:** final audit, quota/cancellation/update regression tests, 44px touch targets, bundle budgets, redundant GitHub Pages removal. **Verified:** 34/34 unit, 37/37 production-browser tests passed. Still draft/unmerged.
- **Remaining after PR E:** owner-approved Cloudflare deployment and live smoke, real-device mobile tests, and separately reviewed private media/auth storage. No real manga data uploaded.

---

# Manga Roadmap and Definition of Done

## Phase 0: safe foundation (current)
- [x] Repository created private, with `master`.
- [x] TypeScript/React/Vite scaffold and responsive, honest no-data UI.
- [x] Domain model and local search tests.
- [x] CI typecheck/test/build workflow defined (runner execution still unverified; no deploy).
- [x] Agent, architecture, security, contracts and operations documentation.
- [ ] Generate and commit `package-lock.json`; move CI to `npm ci`.
- [ ] Run a full local/CI acceptance pass and record the SHA.

## Phase 1: read-only useful catalogue
- [ ] Approve stable identity rules, runtime parser and documented schema migrations.
- [ ] Build local fixture-powered catalogue, detail view and status/rating/tag filters.
- [ ] Add responsive and accessibility tests; persist nothing sensitive yet.
- [ ] A read-only local catalogue with an explicit no-data state, a chapter manifest validator, and a page reader prototype using generated/owned fixture images.
- [ ] Demonstrate no accidental network calls to protected providers.

## Phase 2: private personal data
- [ ] Select private persistence backend and per-app authentication after a security ADR.
- [ ] Add input validation and per-record revision-guarded writes.
- [ ] Local read/write, backup, import/export and explicit conflict handling.
- [ ] Proper empty/loading/offline/error states with recovery.

## Phase 3: domain experience
- [ ] Panel and page ordering, right-to-left versus left-to-right reading, vertical scrolling, chapter/volume structure, image dimensions, page preload limits and full-screen touch navigation.
- [ ] Fixtures prove correct RTL/LTR page ordering, chapter transitions, resume on exact page, keyboard/touch operation and offline behaviour without exposing private image assets.
- [ ] Verify phone/PC performance and storage quotas.

## Phase 4: ecosystem integration
- [ ] Evaluate stable Shared Core exports and version/pin if objectively useful.
- [ ] Configure verified Personal Hub link; app still works independently.
- [ ] Consider opt-in cross-media tagging/search only with an approved privacy model.

## Phase 5: controlled production
- [ ] Separate staging and production origins, secure server secrets and manual deploy approval.
- [ ] Full E2E, privacy, offline, backup restore, security and performance release gates.
- [ ] Owner signs off on any public visibility or deployment.

## Out of scope until separately approved
No unlicensed manga downloads, paywall bypass, scraping of protected sites, reader requests to arbitrary URLs, or remote image proxying without SSRF protection. No unreviewed bulk migrations, unlicensed content acquisition or automatic deployment. The scaffold must not be marketed as a complete reader/tracker.


## Implementation-in-progress checkpoint (18 November 2026)

On `feature/local-manga-catalogue-reader`, **implemented but not yet validated or merged**: runtime identity/manifest/progress parsers, archive-entry preflight, local synthetic catalogue with filters and details, generated image page reader, RTL/LTR/vertical page stepping, exact in-session page resume, synthetic offline operation, and pure unit/SSR markup regression tests. Do not mark the corresponding Phase 1/3 acceptance gates complete until online typecheck, tests, production build and browser/mobile evidence exist.

**Still blocked:** authentic `package-lock.json` creation and `npm ci` switch (npm DNS inaccessible), unstarted GitHub Actions jobs, browser interaction/320–1280 px checks and real-device memory measurement. **Still unapproved:** real media import, private provider, auth, persistent offline cache and Cloudflare deployment. Proposed rights/storage ADR: `docs/adr/006-manga-rights-and-private-asset-adapter.md`.
