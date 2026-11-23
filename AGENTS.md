# AI Agent Working Agreement: Taiyou's Manga Library

**Scope:** This file applies to this repository only: **AdityaSreevatsaK/Taiyous-Manga-Library**. It is the working contract for human and AI contributors.

## Mission and ownership

Build and maintain a secure, maintainable, privacy-respecting personal manga library for legitimately acquired or otherwise authorised manga. The app provides a catalogue, a continuous image-based chapter reader, chapter/page progress, personal organisation, private owner-only catalogue access and optional offline access for synthetic demonstration chapters.

This repository owns the Manga web application, manga domain model, browser-local personal state, same-origin Cloudflare Pages Functions and the reader-side private-media gateway. The separate **Taiyou-Manga-Storage-Controller** owns approved media ingestion, upload, backup, migration and source-media deletion. The private Hugging Face dataset is **AdityaSreevatsaK/Taiyous-Manga**. Treat both as external integration boundaries: inspect their public contracts when necessary, but **do not modify either repository or dataset from this repository's task**.

Do not modify the Novel Library, Manga Retriever, Shared Core/Hub, Anime or Movies/TV repositories. Novel Library is a visual reference only, not a runtime dependency. Shared Core remains experimental and is not imported by this app.

## Mandatory dynamic state-awareness protocol

**Historical documentation, prior conversation summaries, old AI handovers and previous agent claims are not proof of current state.** Before every substantial task, establish the state of the repository you are actually about to change.

1. **Establish the working tree and exact base.** Run `git status --short --branch`, `git rev-parse HEAD`, `git branch --show-current`, `git remote -v`, `git diff` and `git diff --cached`. Do not discard, reset, stash, overwrite or include pre-existing user changes without explicit direction. If no local checkout is available, say so internally and inspect the remote GitHub refs/files instead; never claim to have checked local Git status.
2. **Refresh GitHub state.** Inspect the default branch and latest commit, all relevant branches, open and recently merged PRs, issue state, recent commits, workflow runs and check results. Identify in-flight changes before editing. Do not infer that a closed PR was merged; check its merged timestamp and merge SHA.
3. **Inspect implementation, not just descriptions.** Trace the relevant UI, domain, data adapter, Pages Function, tests, configuration and deployment path. Check package.json, package-lock.json, workflow definitions and current runtime versions. Follow data from user action through storage/API to the rendered result.
4. **Read the current documentation entry points.** Start with README.md, this file, docs/PROJECT_STATUS.md, docs/ARCHITECTURE.md, docs/DATA_CONTRACTS.md and docs/SECURITY.md. Then read the task-specific docs and relevant ADRs. Dated reports and handovers are historical evidence, not mandatory current instructions; read them only when their history is relevant.
5. **Classify every material claim.** Use these labels in plans, docs and reports:
   - **Implemented:** present in the current target branch, with source/test evidence.
   - **Partially implemented:** some code exists, but a required integration, configuration, acceptance test or user-visible path is missing.
   - **Planned:** agreed direction without implementation.
   - **Deprecated:** deliberately no longer used; preserve compatibility only where required.
   - **Historical / superseded:** accurate only for a named earlier commit or date.
   - **Unverified:** source/configuration exists, but live or owner-authenticated behaviour has not been demonstrated.
6. **Record evidence.** For important status claims cite the current source path, test, commit/PR, workflow run or live acceptance record. A passing unit test does not prove OAuth, a production secret, a private dataset write, physical-device behaviour or a deployed release.
7. **Reconcile contradictions before editing.** When docs disagree, prefer the current implementation and verified CI/deployment evidence. Preserve the old account as clearly labelled history only when it explains a decision or failure. Never silently turn an assumption into a fact.

### Required pre-change note

Before implementation, produce a concise internal plan containing: observed branch/SHA and dirty state; related PRs; current implementation path; state classification; acceptance conditions; affected files; privacy/data/performance risks; tests and deployment checks. If the user asks for direct completion, proceed within the approved scope rather than stopping at the plan.

## Current architecture guardrails

- React 18 + TypeScript strict mode + Vite; Cloudflare Pages hosts the app and same-origin Pages Functions. Node.js 22 is the repository baseline.
- Private catalogue metadata is read in one owner-authenticated GET /api/library request. The browser filters the in-memory catalogue locally. Do not introduce one metadata request per manga for ordinary catalogue, shelf, tag, collection or search views.
- Manga-specific requests are appropriate for chapter manifests and actual image assets. Private covers are loaded lazily, deduplicated and cached in a bounded IndexedDB store; private page requests are authenticated and revision/checksum validated. Never expose Hugging Face bearer tokens or private dataset URLs to browser code.
- The canonical private catalogue is data/library.json in the private HF dataset. Its schema and paths are described in docs/HF_READONLY_CONNECTION.md and the Controller contract. Legacy catalogue reads are compatibility-only and must remain fail-closed.
- Private personal progress, shelves, ratings, notes, tags, favourites, chapter-completion markers, nested collections and usage analytics remain device-local. Manual JSON backups are private user files. There is no automatic cross-device personal-data sync.
- The reader displays a whole chapter in one continuous vertical flow. Previous/Next navigate chapters, not individual pages. Preserve immutable manga/chapter/page IDs and zero-based internal page indexes.
- Private chapter pages are online-only. Verified private covers may be cached locally for display; this is not private chapter offline reading. The synthetic sample has a separate explicit offline chapter-download flow. Never claim private media is encrypted.
- Owner source-metadata corrections are limited to the protected Master flow. They require the authenticated owner, a separate short-lived owner grant, Hugging Face write scope and revision-safe server validation. The Storage Controller remains responsible for media uploads, deletion and migrations.
- Keep the app usable without Shared Core or the parent Hub. Do not introduce runtime coupling merely to reuse UI.

## Approved user-experience contract

- End-user branding is **Taiyou's Manga Library**, never "Taiyou's Personal Manga Library".
- Six visible primary shelves, in order: Home, Currently Reading, Trying Out, Available Offline, Finished, All Manga. The legacy To Be Read state/URL remains supported where necessary but is not a primary navigation item. Analytics is inside the bookmarkable Master Controls route and does not require the owner passphrase.
- Six persisted themes: Sepia (default), Paper, Charcoal, Midnight, Ocean and Plum. Opening the theme menu must not change the current theme.
- Use the approved transparent Taiyou Sun mark and matching theme-aware favicon/PWA artwork.
- Catalogue cloud control sits immediately after the brand wordmark and shows a truthful green/red connection dot. Cloud settings remain in the cloud menu; never fake connectivity.
- Home is a curated editorial page with three distinct, fully contained manga covers, a selected centre item and hover/focus-driven details/actions. Keep cover artwork inside its intended frame at desktop, split-screen and mobile widths.
- Match the current Novel Library reference for approved shared chrome, details-card hierarchy, genuine Lucide icon paths, notification palette/placement, Master layout and analytics composition. Inspect the current Novel source before parity work; do not copy its EPUB reader or storage/auth implementation.
- Publication ribbons (Story Complete, Updating, On Hiatus, Dropped) are source publication state, not personal reading completion. Only an explicit personal action marks a manga Finished.
- The Manga reader is a continuous whole-chapter vertical image reader. Do not replace it with page-by-page Novel controls.
- Use accessible, dismissible in-app notices; no browser-native alert/confirm prompts or decorative non-functional controls.
- Footer: centred © [year] Taiyou's Manga Library · Created by Taiyou.
- Analytics: device-only, opt-out, prospective actual activity estimates. The rolling 14-day chart has paired active-app/reading bars and dynamically spaced day/month labels every three days, including the current date. Never reconstruct or fabricate historical reading time.

## Security, privacy and data safety

- Public Git contains source, approved brand assets and public demo imagery/fixtures only. Never commit manga images, archives, manifests containing private media paths, private catalogue exports, personal backups, credentials, OAuth tokens, owner passphrases, private URLs or real user records.
- VITE_* variables are public browser configuration. Secrets belong only in Cloudflare Pages Functions runtime secrets.
- Private reads must pass server-side owner/session checks and object-level validation. Preserve Cache-Control: no-store on private API responses. The service worker must never intercept or cache /api/*.
- Do not weaken OAuth state/PKCE, owner checks, SameSite/HttpOnly/Secure cookies, Origin/CSRF checks, content validation, revision guards or private media integrity checks to make a test pass.
- Treat catalogue fields, notes, tags, imported metadata, archive indexes and URLs as untrusted. Render text safely; never inject HTML.
- Never scrape protected sources, bypass paywalls/DRM, or fetch arbitrary user-supplied image URLs.
- Never delete, overwrite or migrate private originals, catalogue records or user progress as a side effect of UI work. Destructive operations require explicit owner approval, a dry run, verified backup, exact revision and a tested recovery path.
- Invalid local records are recovery evidence. Preserve them rather than silently clearing them.
- Do not describe browser-local data as encrypted or durable. Browser storage can be cleared or evicted.

## Engineering standards

- TypeScript strict mode; keep domain logic pure and separately tested.
- Validate all untrusted JSON at runtime. Preserve stable IDs, ordering and schema compatibility.
- Keep network requests bounded, cancellable where appropriate, deduplicated and scoped to actual user needs. Avoid N+1 catalogue metadata fetches and eager off-screen image decoding. Important: private chapters queue all page bytes at concurrency 3 for verification but retain only nearby page blob URLs; distant verified pages are released and refetched on demand. This bounds retained page sources, not overall network transfer, image decoding memory or physical-device performance. Real-device long-chapter measurement remains outstanding.
- Preserve the measured production bundle budgets in scripts/check-bundle.mjs. Any budget change requires measured before/after evidence and a narrow justification.
- Use semantic HTML, keyboard-operable controls, visible focus, screen-reader labels, reduced-motion support and truthful loading/empty/error/offline states.
- For UI changes, verify 320, 390, 768 and 1280 px at minimum; add 375/740/900/1536 px when the changed layout needs them. Check split-screen widths and no horizontal overflow.
- Keep tests synthetic and deterministic. Do not make paid/external provider calls in CI.

## Standard development and release workflow

1. Work on a short-lived branch from the latest master; never force-push master.
2. Implement the smallest coherent change and add unit, component, API or browser tests at the appropriate layer.
3. Update the authoritative docs and docs/PROJECT_STATUS.md when implementation status changes.
4. Run npm ci, npm run typecheck, npm test, npm run build, and the relevant production-browser checks. Use E2E_PRODUCTION=1 npm run test:e2e for the Chromium suite against the production build; run npx playwright test --config playwright.cross-browser.config.ts for Firefox/WebKit.
5. Inspect the final diff and ensure no unrelated or private files are included. Open a PR with exact scope, evidence, risk and rollback.
6. The owner has authorised routine non-destructive PR merges and subsequent Cloudflare deployment without another approval after required checks pass. Merge only the exact green PR head SHA. Never merge on a partial, stale or cancelled run.
7. After merge, verify the Live Cloudflare smoke workflow for the merged master SHA. Distinguish merged, deployed and owner-authenticated acceptance.
8. Report what changed, exact PR/commit/run links, what was verified, what remains unverified and any follow-up gaps.

## Known boundaries and remaining acceptance

Consult docs/PROJECT_STATUS.md and docs/ROADMAP.md for the current snapshot. Known non-goals/limitations include: no automatic cross-device sync for personal data; no private-media offline downloads; no in-app media upload or permanent media deletion; no general private HF catalogue migration; no verified physical iOS/Android acceptance or low-memory 300–1,000-page benchmark unless a current manual record says otherwise. Do not repeat these as facts without rechecking the code and current acceptance evidence.

## Documentation maintenance

- README.md is the concise public entry point.
- docs/PROJECT_STATUS.md is the dated, evidence-backed state snapshot.
- docs/PROJECT_HISTORY.md records the vision, evolution and durable lessons.
- Architecture, data, security, testing, deployment and roadmap docs describe the current implementation.
- Dated audit reports and old handovers are explicitly historical. Do not append another conflicting "current status" section to an obsolete document.
- When a feature, API, schema, workflow, dependency, deployment or decision changes, update its owning doc in the same PR.
- Keep the current status concise; move rationale and chronology to the history/ADR documents.

## Stop conditions

Stop and obtain explicit owner approval before destructive private-data changes, permanent deletion, forced history changes, changing repository visibility, changing production secrets/OAuth configuration, widening third-party access, weakening security, or importing/uploading real media. A routine code/documentation change with synthetic tests is not a reason to stop for approval.
