# Architecture: Taiyou's Manga Library

**Current implementation reference:** master as of 21 November 2026.  
**Live application:** https://taiyous-manga-library.pages.dev/

This document describes the deployed architecture. Earlier scaffold-only descriptions are retained in dated reports and are not current.

## System overview

The Manga Library is an independently deployed React application with same-origin Cloudflare Pages Functions. Private manga catalogue and media are stored in the private Hugging Face dataset managed by the separate Manga Storage Controller.

- Browser application: React 18, TypeScript, Vite.
- Hosting and server boundary: Cloudflare Pages and Pages Functions.
- Private source: AdityaSreevatsaK/Taiyous-Manga.
- Private access: a dedicated Hugging Face OAuth client and encrypted HttpOnly session cookie for this origin.
- Personal state: versioned browser-local records; no automatic cross-device personal sync.
- Media ingestion, backups, migrations and original-media deletion: Manga Storage Controller, outside this repository.
- Shared Core and Novel Library: no runtime dependency.

## Runtime request and data flow

### 1. Catalogue

On initial application load, src/data/privateLibrary.ts makes one same-origin GET /api/library request. The Pages Function in functions/api/library.ts:

1. Checks production configuration and the encrypted owner session.
2. Verifies the signed-in identity is the configured owner and can access the private dataset.
3. Resolves the current immutable Hugging Face dataset revision.
4. Reads and validates the complete canonical data/library.json catalogue at that revision.
5. Returns the complete entries and revision with private no-store headers.

The browser validates the response again in src/domain/privateMediaContracts.ts and stores the complete catalogue in React state. Search, creators, publication status, tags, shelves, collections, sort order and advanced discovery are local filters over that in-memory snapshot. Normal catalogue views must not fetch metadata once per manga.

While the user is browsing the catalogue, App.tsx refreshes the catalogue on focus/visibility return and through a bounded 90-second timer, with a 60-second minimum between actual requests. Polling is paused while a chapter reader is open. Manual refresh uses the same single-catalogue path.

### 2. Covers

src/components/useMangaCoverArt.ts waits until artwork is prioritised or near the viewport (360px root margin). src/data/coverCache.ts:

- Deduplicates concurrent requests for the same manga/cover digest.
- Reads a bounded IndexedDB cache first.
- Requests a missing cover through GET /api/media/cover.
- Checks the returned MIME type, byte size and SHA-256 against the catalogue descriptor before persistent caching.
- Keeps a small session hot cache and a bounded IndexedDB cache (maximum 120 covers / 72 MiB).
- Clears private cover data on sign-out.

The API response itself is private and no-store. Browser-local cover caching is a deliberate performance optimisation, not private chapter offline support.

### 3. Chapter manifests and pages

A private chapter manifest is requested only when a chapter is opened or a direct reader bookmark is resolved. src/data/privateMedia.ts validates manga/chapter IDs, response revision and manifest membership.

For a selected private chapter, src/data/chapterPreloader.ts starts page requests in page order with bounded concurrency (default 3, maximum 4). VerticalReader keeps stable page placeholders and mounts/decodes only the visible page and nearby images. Page loading is actual media traffic, not catalogue metadata fetching.

The canonical private page fast path accepts the immutable revision and page descriptor already obtained from the authenticated catalogue/manifest. The browser validates manga → chapter → page membership before requesting it. The server validates the owner session, revision/descriptor format, safe ID-derived path, MIME, byte length and SHA-256 of the returned bytes. It deliberately does not re-resolve the moving main revision or refetch catalogue/manifest metadata for each canonical asset request; the supplied revision is immutable. Legacy requests without a pinned descriptor use the slower server-side catalogue/manifest membership path. Private API responses are no-store and the service worker excludes /api/*.

### 4. Personal data and analytics

Browser-local storage is intentionally separate from the private source catalogue:

- localStorage: per-manga progress, reader preferences, personal shelves, ratings, notes, tags, favourites, explicit chapter-completion markers, nested collections and usage analytics.
- IndexedDB: verified private cover blobs only.
- CacheStorage: public app shell and explicitly downloaded synthetic sample chapters.
- In-memory React state: active catalogue snapshot, current chapter manifests, current session and transient UI state.

Manual JSON backup/restore is available for personal data. It is a validated merge, not cloud synchronisation. Private original chapter pages are not stored as offline downloads.

### 5. Master Controls

MangaMasterControls is lazy-loaded when the bookmarkable /master route opens. It contains:

- Analytics: device-local usage journal and manga-specific insights. No separate owner passphrase is required.
- Library management: local personal record editing and protected publication metadata corrections.
- Protected source correction is limited to title, creators and publication status. It requires an authenticated owner session, a separate passphrase grant, a Hugging Face session with write-repos scope and a revision-pinned server-side update. The grant is encrypted in a Secure, HttpOnly, SameSite=Strict cookie and expires after 10 minutes.
- Media uploads, migrations and permanent media deletion remain with the Storage Controller.

## Cloudflare Pages Functions

| Route | Method | Responsibility |
|---|---|---|
| /api/auth/login | GET | Read-only Hugging Face OAuth start with state and PKCE |
| /api/auth/login-write | GET | Separate OAuth start requesting write-repos scope |
| /api/auth/callback | GET | Confidential code exchange, owner verification and encrypted session |
| /api/auth/session | GET | Session status only; never returns the bearer token |
| /api/auth/logout | POST | Same-origin session logout |
| /api/library | GET | Full private catalogue snapshot at an immutable dataset revision |
| /api/media/cover | GET | Authenticated, validated private cover bytes |
| /api/media/manifest | GET | Authenticated chapter manifest |
| /api/media/page | GET | Authenticated, revision-pinned private page bytes |
| /api/master?action=status | GET | Owner-grant configuration/status |
| /api/master?action=unlock | POST | Verify separate owner passphrase and issue short-lived grant |
| /api/master?action=lock | POST | Revoke the owner grant |
| /api/master?action=update-metadata | POST | Revision-guarded title/creator/publication-status correction |

The server-side boundary lives in functions/_lib/mangaAuth.ts and functions/api/*.ts. Do not put credentials in VITE_* variables, frontend code, URLs, localStorage or public build artifacts.

## Canonical private dataset layout

The private dataset uses a version-1 envelope in data/library.json:

- schemaVersion: 1
- mediaKind: manga
- entries: MangaEntry records

Canonical media paths:

- data/covers/<manga-id>.<original-extension>
- data/manifests/<chapter-id>.json
- data/manga/<manga-id>/<chapter-id>/<page-id>.<original-extension>

Catalogue cover descriptors include relative assetPath, MIME type, width, height, byte size and SHA-256. Creator roles and field-level metadata provenance are optional fields. Rights evidence and cover-rights records are managed separately by the Controller and must not be exposed as public reader metadata.

A read-only legacy catalogue fallback remains for older Controller layouts. If the canonical data tree contains files but data/library.json is missing, the reader fails with a recovery error rather than treating the dataset as empty.

## Source map

### Browser application

- src/App.tsx: application state, catalogue loading/refresh, routing, shelves, details and integration of reader/Master controls.
- src/domain/types.ts: MangaEntry, MangaChapter, MangaProgress, MangaPage, ChapterManifest and source-rights types.
- src/domain/validation.ts: runtime validation for untrusted catalogue, manifest, progress, IDs, MIME/path and metadata.
- src/domain/routes.ts: readable public slugs, immutable-ID resolution, legacy routes and History API contract.
- src/domain/filters.ts and advancedDiscovery.ts: local catalogue filtering and evidence-based discovery.
- src/domain/localReaderStorage.ts: reader progress/preferences.
- src/domain/personalShelves.ts, personalAnnotations.ts and personalCollections.ts: local personal organisation.
- src/domain/localFullBackup.ts and related backup modules: manual validated export/import.
- src/domain/usageAnalytics.ts: device-local prospective usage journal.
- src/data/privateLibrary.ts and privateMedia.ts: browser clients for authenticated catalogue/manifests/pages.
- src/data/coverCache.ts and src/components/useMangaCoverArt.ts: verified private cover caching and lazy loading.
- src/data/offlineChapters.ts: explicit synthetic chapter offline downloads.
- src/components/VerticalReader.tsx: continuous chapter reader.
- src/components/MangaMasterControls.tsx and MangaAnalyticsPanel.tsx: lazy-loaded Master workspace and analytics.

### Server and delivery

- functions/_lib/mangaAuth.ts: OAuth session, encryption, owner checks and Hugging Face request helper.
- functions/api/auth/[action].ts: OAuth login/callback/session/logout.
- functions/api/library.ts: canonical catalogue and read-only legacy fallback.
- functions/api/media/[kind].ts: cover, manifest and page delivery.
- functions/api/master.ts: owner grant and narrow source metadata corrections.
- public/sw.js: release-fingerprinted offline shell; private APIs are excluded.
- public/_headers: security headers and CSP.
- scripts/stamp-service-worker.mjs and scripts/live-cloudflare-smoke.mjs: release fingerprinting and live deployment verification.

### Build and test

- package.json / package-lock.json: Node 22 package manifest and locked dependencies.
- vite.config.ts: Vite and Vitest.
- playwright.config.ts: Chromium E2E, optionally against production preview.
- playwright.cross-browser.config.ts: Firefox/WebKit smoke.
- e2e/: browser acceptance suites.
- .github/workflows/ci.yml: typecheck, Vitest, release tests, build, bundle budgets and Chromium.
- .github/workflows/cross-browser.yml: Firefox/WebKit reader/navigation parity.
- .github/workflows/live-cloudflare-smoke.yml: post-master deployment verification.

## Performance and reliability invariants

- One full catalogue read per load/refresh, not one metadata request per title.
- Cover requests are lazy, shared and cache-validated.
- Chapter preloading is bounded; decoded images are not unbounded.
- Stable page IDs are required to restore progress after manifest reordering.
- The service worker caches only verified app-shell releases and public artwork; it never caches private API responses.
- Two verified app-shell releases are retained for rollback; manga chapter CacheStorage is separate.
- scripts/check-bundle.mjs enforces measured JS/CSS budgets.

## Explicitly not implemented

- Automatic cross-device personal progress/annotation/collection sync.
- Private chapter offline downloads or encrypted private-media storage.
- In-app upload, bulk import, original-media deletion or general dataset migration.
- Shared cross-app SSO, runtime Shared Core imports or direct Novel Library data access.
- A verified physical iOS/Android acceptance record or real low-memory 300–1,000-page benchmark unless separately recorded.

See docs/DATA_CONTRACTS.md, docs/SECURITY.md, docs/DEPLOYMENT.md and docs/PROJECT_STATUS.md for related contracts and acceptance.
