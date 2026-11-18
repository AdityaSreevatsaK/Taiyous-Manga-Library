# Manga Roadmap and Definition of Done

## Phase 0: safe foundation (current)
- [x] Repository created private, with `master`.
- [x] TypeScript/React/Vite scaffold and responsive, honest no-data UI.
- [x] Domain model and local search tests.
- [x] CI typecheck/test/build (no deploy).
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
