# Manga Library: current roadmap, 19 November 2026

**Development checkpoint:** PRs #32–#35 merged on `master`. CI passed for each feature. The live Cloudflare page and physical Android/iOS devices have not been independently reverified against the latest four merges in this handover. Earlier live smoke results remain valid historical evidence. The original scaffold planning text below is retained solely for historical evidence.

| Phase | State | Evidence / next acceptance |
| --- | --- | --- |
| A. Release reliability | Implemented in code | Release fingerprints, ready-marked two-version offline cache rollback (#32) and automatic smoke checks; recheck the latest live deployment |
| B. Branding, navigation and themes | Implemented | Eight sections, responsive mobile More, approved Sun artwork and six themes, Sepia default, PR #23 |
| C. Catalogue and details | Implemented for synthetic data | Status ribbons, chapter search, personal rating/notes, local filters, PR #24 |
| D. Local organisation and backups | Implemented | Reading shelves, personal tags, arbitrary nested collections, confirmation, safe v2 backup and legacy import, PRs #25 to #27 |
| E. Search, analytics and browser parity | Implemented for synthetic/local data | Advanced Search, evidence-based analytics, Firefox/WebKit smoke alongside full Chromium, PRs #28 to #29 |
| E. Deep performance and device assurance | Partially implemented | 1,000-page deterministic geometry and bounded image window (#33), two-release offline simulator (#32); real 300–1,000-page image decode/memory testing and Android/iOS hardware remain pending |
| F. Private originals and sync | Not connected | Fail-closed typed security contracts (#30) exist, but per-app OAuth, object-level access, owner-cleared rights, secure HF credentials, server-side revisions and disposable test dataset remain prerequisites |

The live application is a **fictional synthetic demo only**. No real manga data, authenticated Hugging Face image delivery or automatic multi-device progress synchronisation exists. Never publish private originals, credentials or annotations in GitHub or Cloudflare public files.

**Current release procedure:** short-lived branch -> PR -> typecheck, unit, build, bundle and browser checks -> merge green PR -> Cloudflare automatic deploy -> verify live Cloudflare smoke. Owner permits routine green non-destructive merges without another approval.

## Delivered since the independent UI audit

- [PR #32](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/pull/32): service-worker ready cache, two-version verified rollback and CI safety tests.
- [PR #33](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/pull/33): logarithmic long-chapter geometry tracking with synthetic 1,000-page coverage. Not a measured physical memory benchmark.
- [PR #34](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/pull/34): personal favourites, curated Home, backwards-compatible v2 backup.
- [PR #35](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/pull/35): explicit chapter completion, protected ownership validation and backup import.

## Next acceptance gates

1. Inspect the Cloudflare live-smoke workflow after the latest `master` release and verify its build fingerprint, deep links, branding, reader, offline shell and navigation.
2. Perform the attached [real-device checklist](REAL_DEVICE_ACCEPTANCE.md) on at least one Android Chrome and one iOS Safari device. Automations are not hardware evidence.
3. Stress-test a licensed disposable 300–1,000-page chapter on a low-RAM phone; record image decode memory, scrolling responsiveness, app resume and cache eviction. Do not upload protected content into CI.
4. Enforce repository rules on `master` and gate production on green checks. Cloudflare's independent Git-triggered deployment can otherwise publish before CI finishes.
5. Only with explicit owner-approved private data and architecture, implement same-origin authentication, server-only storage tokens, CSRF/object authorisation, revisioned writes and disposable integration tests. Do not connect real manga originals first.

## Historical scaffold plan, archived verbatim

The content below records the earlier unmerged scaffold state and is **not** an accurate description of current `master`.

---

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
