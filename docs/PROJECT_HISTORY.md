# Project vision, evolution and engineering history

This document preserves durable project context that future agents cannot infer from the latest source tree alone. It is a curated chronology, not a replacement for current code or docs/PROJECT_STATUS.md.

## Original vision

Taiyou's Manga Library is an independent personal manga catalogue and reader, designed for image-based manga rather than EPUB books. It should make legitimately acquired manga comfortable to organise and read across desktop, tablet and phone, with reliable chapter/page progress and optional offline access.

The user wanted a polished, warm editorial library rather than a generic admin dashboard. The existing Novel Library is the visual reference for shared library chrome and interaction patterns, but manga has different content, reader navigation, storage ownership and media delivery. The app must remain independently deployable and usable if the Personal Hub or Shared Core is unavailable.

Core domain requirements established at the start:

- Stable opaque manga, chapter and page identities. Titles, chapter labels, filenames and list positions are mutable display data, never primary keys.
- A continuous whole-chapter vertical image reader. Previous/Next move between chapters; they do not step through individual pages.
- Correct page order and reading direction, chapter/volume structure, image aspect ratio, bounded image decoding/preloading, touch/keyboard operation and exact saved-position recovery.
- Clear separation between source publication metadata, personal reading status, personal annotations, protected media and synchronisation metadata.
- Truthful loading, empty, offline and error states. Never show invented real catalogue data or imply a feature works when it is only a placeholder.
- Privacy by design: public source and synthetic fixtures only; private catalogue and media behind owner authentication; personal data kept local unless a separately reviewed sync design is approved.
- No scraping of protected sources, paywall/DRM bypass or unlicensed redistribution.

## Product and UX decisions

### Brand and shell

- End-user brand is **Taiyou's Manga Library**. The earlier "Taiyou's Personal Manga Library" wording was deliberately simplified.
- The approved Taiyou Sun mark is transparent and theme-aware. Matching favicon and PWA artwork are used.
- The compact cloud control sits directly after the wordmark, with a truthful green/red status dot. Connection settings live in its popover rather than consuming the page header.
- Use a full-width two-row header and responsive navigation, with no persistent sidebar.
- Six themes are supported: Sepia (default), Paper, Charcoal, Midnight, Ocean and Plum. Theme choice persists and opening the picker must not mutate it.
- Footer is centred and says "© [year] Taiyou's Manga Library · Created by Taiyou".

### Shelves and personal state

The approved visible primary navigation is Home, Currently Reading, Trying Out, Available Offline, Finished and All Manga. Analytics moved into the bookmarkable Master Controls view. The legacy To Be Read state and old URL remain supported for compatibility, but it is not a primary navigation tab.

Publication state is independent from personal completion. Cover ribbons describe publication (Story Complete, Updating, On Hiatus, Dropped). A manga is personally Finished only after an explicit user action; reading to the last available page does not silently mark it complete.

Personal ratings use the Novel Library's 1–10 scale. Personal notes, tags, favourites, shelves, explicit per-chapter completion markers and nested collections are local to the browser. Imported publication genres/tags are not deleted by personal tag editing. Collection deletion cannot cascade into manga, media or reading progress.

### Home and details

The home page evolved from a basic catalogue to a curated editorial home. The approved hero presents three distinct manga covers, with the centre cover selected initially. Hover/focus on another cover updates its title, creator, synopsis and actions. Covers must remain fully contained within their intended frames, including narrow and split-screen widths.

The details page uses the Novel Library's compact details header, section hierarchy, genuine Lucide icons, scrollable synopsis and centred footer, while retaining manga-only chapter and image-reader behaviour. Notifications use the Novel Library's accessible top-right stack and 4.5-second expiry. The cloud control must not be hidden or moved away from the wordmark.

## Architecture evolution

### 18 November: safe scaffold and reader foundation

The repository began as a TypeScript/React/Vite scaffold with typed manga identity and validation. Early work established the synthetic catalogue, generated illustration fixtures, reader navigation and responsive test foundation. The first milestone was deliberately public-source-safe: no real manga binaries, no private credentials and no unreviewed storage connection.

The continuous reader, readable browser routes, per-manga local progress, reader preferences, synthetic offline chapter downloads and release reliability were added through the early PR sequence. Private chapters currently queue all page bytes at concurrency 3 and retain their page sources until the chapter closes; the visible image window is bounded, but total source memory still scales with chapter size. This remains a measured hardware-acceptance item, not a proven 1,000-page memory cap. Service-worker release fingerprinting and two-release verified shell retention were introduced after identifying that unchanged service-worker bytes could leave an old offline app installed after the live site changed.

### 19 November: local library features and private read design

The app gained the six-theme library shell, personal shelves, ratings, notes, tags, favourites, nested collections, manual versioned JSON backups, advanced local search and evidence-based analytics. Browser storage remains local and potentially evictable; backups are manual, not cloud sync.

A separate per-app Hugging Face OAuth design was adopted. The Novel Library's cookies are not shared across unrelated Pages origins. Server-side session checks and a same-origin private-media gateway were required before private originals could be displayed.

### 20 November: private catalogue and media gateway

The canonical private dataset was integrated through Cloudflare Pages Functions. The Reader reads the complete catalogue from data/library.json at a pinned private dataset revision. The app supports the canonical Controller contract fields for cover descriptors, creator roles and metadata provenance, while preserving a read-only legacy catalogue fallback.

Private covers and chapter manifests/pages are served through owner-authenticated same-origin endpoints with immutable IDs, revision checks, MIME/size/SHA validation and no-store responses. Covers are loaded lazily and may be cached locally in a bounded IndexedDB store. The app does not embed HF tokens or private provider URLs in the browser.

Canonical chapter page delivery gained a revision-pinned fast path to avoid re-reading the entire catalogue/manifest for every page request. The browser still makes page-asset requests when a chapter opens; this is expected media loading, not per-manga catalogue metadata fetching.

The UI was aligned more closely with the Novel Library. The user reported oversized/zoomed cover artwork, poor visibility and missing cloud-control parity. The three-cover hero, scoped cover containment, actual cloud glyph and responsive regressions were addressed in PRs #53–#60. PR #60 fixed cover containment; PR #61 fixed hero contrast, hover-driven content and notification behaviour.

### 21 November: Master Controls, analytics and final dashboard parity

Master Controls became a direct, bookmarkable route. Analytics moved inside Master without a separate owner passphrase. The owner-only Library management view includes a protected source-metadata correction path, while local personal edits remain device-local. The protected write path is restricted to title, creators and publication status, requires a distinct owner passphrase and a Hugging Face write-authorised session, and uses revision-guarded server-side validation. Media upload/deletion remains with the Storage Controller.

The reading usage journal records prospective approximate focused/non-idle time on this device only. It supports opt-out, JSON export and typed confirmation for clearing. It records app time, time while a manga is open, offline time, per-manga totals and a bounded activity history. Existing progress timestamps cannot reconstruct earlier minutes.

PR #63 brought the Analytics landing view into close visual parity with Novel Library: four time metrics, a paired 14-day active-app/reading chart, a Most read manga list and a compact privacy card. Additional manga-specific insights remain available under a collapsed disclosure. PR #64 replaced ambiguous weekday abbreviations with dynamic day/month labels every three days, including the current day.

## Durable architecture decisions and why

1. **One full catalogue snapshot, local filtering.** Normal catalogue, shelf, tag, collection, creator and search views should not issue per-manga metadata reads. The owner-authenticated catalogue endpoint returns the complete validated catalogue; the browser filters it in memory. Individual requests are reserved for actual chapter manifests and media assets.
2. **Separate app authentication.** The Novel Library's Hugging Face session is origin-bound. Manga uses its own OAuth client, callback and encrypted HttpOnly cookie.
3. **Separate storage control plane.** The Storage Controller owns media ingestion, backup, migration and deletion. The reader app serves authenticated media and allows only narrow protected metadata corrections.
4. **Private data is not public just because source is public.** Public GitHub source and Cloudflare shell contain synthetic fixtures and code only. Private catalogue/media remain behind server-side authorisation.
5. **Local personal data first.** Progress, shelves, ratings, notes, tags, favourites, collections and analytics remain in browser storage with manual backups. Automatic sync needs a separate schema, revision/conflict policy and security review.
6. **No fabricated analytics.** Reading time starts prospectively with the usage-journal release. A last-position timestamp is not historical time spent.
7. **No private chapter offline claim.** The service worker caches the public app shell; explicit chapter downloads currently cover synthetic fixtures only. Verified private cover caching is separate and does not imply offline chapter reading.
8. **Novel parity is selective.** Reuse approved typography, icons, layout, cloud control, toasts and Master/analytics patterns; never reuse EPUB-specific reading or private storage/auth assumptions.

## Failures, corrections and lessons

- Early GitHub Actions runs sometimes failed before any runner step executed. Those were scheduling/account-level failures, not demonstrated TypeScript/test failures. Later Actions runs successfully executed npm ci, typecheck, Vitest, production builds and browser tests. Historical failure reports remain useful only as dated evidence.
- GitHub Pages was an early synthetic preview path, but Cloudflare Pages is the canonical production host. Do not infer deployment from a merge; the live Cloudflare smoke verifies the built asset fingerprint and security boundary.
- Service workers do not necessarily reinstall when their source bytes remain unchanged. The build now stamps the worker with a release fingerprint and tests two-release rollback behaviour.
- Algorithmic 1,000-page geometry tests bound lookup work, but do not establish physical-device image decode memory or smoothness. Hardware testing remains separate.
- The homepage cover bugs were caused by artwork sizing/containment and styling integration, not merely the image source. Regression tests must inspect computed frame bounds and narrow/split-screen layouts.
- A closed PR is not necessarily merged. Some stacked/private-reader PRs (#43, #45 and #46) were closed without merge and later work was integrated through other PRs. Always inspect merged_at and the current master tree.
- Historical docs accumulated contradictory "current" statements. Keep a single current status snapshot, label dated reports as historical, and require future agents to inspect current code, Git status and GitHub state before trusting a claim.

## Key repository milestones

| PR range | Milestone |
|---|---|
| #1–#2 | Repository foundation, typed domain, synthetic catalogue and reader prototype |
| #10–#18 | Continuous chapter reader, browser routes, local progress, sample offline reading, reliability and acceptance |
| #19–#35 | Personal progress, backups, shelves, collections, advanced search/analytics, browser parity and offline hardening |
| #37–#42 | Per-app OAuth, private catalogue access, editorial shell and authenticated private chapter reading |
| #47–#52 | Canonical cover metadata, private covers/pages, catalogue latency and image-cache performance |
| #53–#61 | Responsive hero, cloud control, Novel-style details/header/footer, homepage cover containment, hover content and toasts |
| #56–#62 | Master Controls, six visible shelves, local usage journal, per-title analytics and protected metadata editing |
| #63–#64 | Novel-style Analytics dashboard and rolling calendar date labels |

## Current versus historical source of truth

For present implementation, use docs/PROJECT_STATUS.md and trace the source files it identifies. For architecture and contracts, use docs/ARCHITECTURE.md, docs/DATA_CONTRACTS.md, docs/HF_READONLY_CONNECTION.md and docs/SECURITY.md. For release evidence, use current GitHub Actions and docs/DEPLOYMENT.md. The 18–20 November reports remain archived for provenance and must not override current code.
