# Manga Library architecture, deployed synthetic milestone (19 November 2026)

Cloudflare Pages serves the React/TypeScript application. The public JavaScript bundle contains four fiction-only sample series with five-chapter/36-image original generated trial. There is **no private manga gateway or login**.

## Implemented components

- `src/domain/types.ts`, `validation.ts`: stable manga/chapter/page identities, strict untrusted manifest parsing and rights provenance contract.
- `src/domain/routes.ts`, `filters.ts`, `advancedDiscovery.ts`: immutable deep links, local discovery and evidence-based analytics.
- `src/components/VerticalReader.tsx`: continuous full-chapter vertical scrolling, stable image aspect ratio, bounded visible/adjacent image decoding, chapter-only previous/next buttons.
- `src/data/pageSource.ts`, `offlineChapters.ts`: fictional image rendering, explicitly downloaded checksum-verified device-local chapters, isolated offline media.
- `src/domain/localReaderStorage.ts`, `personalShelves.ts`, `personalAnnotations.ts`, `personalCollections.ts`: versioned local progress, theme, shelves, notes, ratings, tags and nested collections.
- `src/domain/localFullBackup.ts`, `collectionBackup.ts`: manual v2 JSON export and guarded imports of progress and personal metadata, compatible with old v1 and previous v2 documents. No media included.
- `public/sw.js`: release-specific, verified offline shell with last known-good cache fallback. Public brand assets cached; no private content.
- `.github/workflows/ci.yml`, `cross-browser.yml`, `live-cloudflare-smoke.yml`: CI, engine parity and deployed release checks.

## Architecture boundaries

The Novel Library and Shared Core are **not** runtime dependencies. The Manga Storage Controller and private Hugging Face dataset are separate future integrations. The application's current device-local storage is not a server authorisation or cross-device sync mechanism. Browser-local notes and caches may be read by anyone sharing the same browser profile.

No tokens, private image URLs, user histories or real source media may enter public Git/Pages files. Future server Functions must perform session validation, per-object authorisation, CSRF on mutations, private-source rights review and revisioned writes before access to protected originals.

## Historical 18 November scaffold design notes

The content below is preserved for engineering history. It describes branch-only or unimplemented features and is **not** today's `master` architecture.

---

# Current reader architecture checkpoint (feature branches, 18 November 2026)

Verified but not deployed:
- `src/components/VerticalReader.tsx`: continuous scroll, bounded nearby images, stable page anchors.
- `src/domain/routes.ts`: immutable manga/chapter IDs, History API and real browser links.
- `src/domain/localReaderStorage.ts`: versioned isolated per-series progress and local reader preferences, no cloud sync.
- `src/data/offlineChapters.ts`: explicit synthetic chapter CacheStorage, checksum receipts, cancellation and deletion.
- `src/data/pageSource.ts`: verified offline-first binary resolution, safe object URL cleanup.
- `public/sw.js`: revisioned app shell caching and a self-contained offline fallback.
- No server-side auth, private asset adapter, Hugging Face datasets or cross-device synchronisation. Final integrated hardening PR not yet deployed.

The original scaffold architecture text below is historical and describes unimplemented features as of repository creation. Do not treat its "current" statements as the latest branch state.

---

# Architecture and Ownership Boundaries

## System context
```text
Personal Hub (apps/hub, in Shared Core)
  ├─ navigates to existing independent Novel Library
  ├─ optional link to this Manga application
  └─ other independently deployed applications
                 |
                 v
Taiyous-Manga-Library (THIS REPO)
  ├─ presentation and responsive catalogue UI
  ├─ manga domain entities and pure selectors
  ├─ future application use cases and repository ports
  ├─ future private storage + authorisation adapters
  └─ future offline cache and sync (NOT IMPLEMENTED)
```

**Ownership:** no runtime backend call to the hub is required. The hub is merely a route selector; if it is offline, this application still runs. Shared Core code may eventually be consumed as versioned packages, never as a mutable sibling-repo source import.

## Current implementation vs intended shape
Current: `src/domain/types.ts` defines MangaEntry, MangaChapter, MangaProgress; `searchCatalogue` is a pure Unicode-normalised title/alias filter; `src/data/catalogue.ts` is explicitly empty; `App.tsx` renders an honest no-data catalogue; CI builds locally. There is **no** media import, cloud API, login, parser, transcoder, player, tracking persistence, licence verification or backend.

Intended components (do not treat them as shipped):
1. **Domain:** stable media identities, MangaEntry, MangaChapter, MangaProgress, validation, read-only selectors, progress transformations.
2. **Application:** explicit commands/queries such as Add, UpdateMetadata, MarkProgress, RemoveOfflineCopy, and administrative Delete, with permission checks.
3. **Ports:** `CatalogueRepository`, `ProgressRepository`, `AssetRepository`, `AuthSession` abstractions, each with cancellable, typed results and errors.
4. **Adapters:** indexed local cache and a future private storage provider chosen after design review.
5. **Presentation:** responsive cards, details, progress, collections, search, settings, empty/error/offline states.
6. **Cross-media integration:** optional shared UI/contracts; no direct access to the novel app's dataset, cookies or internal browser storage.

## Domain requirements
Panel and page ordering, right-to-left versus left-to-right reading, vertical scrolling, chapter/volume structure, image dimensions, page preload limits and full-screen touch navigation.

## Operational boundaries
Never ship a public build containing tokens. Prefer same-origin server functions and HttpOnly, Secure sessions where authentication is implemented. Restrict allowed origins, use CSRF controls for mutating endpoints and plan for OAuth redirects that do not share cookies across unrelated pages.dev hosts. For local-first operations, record revision tokens and reconcile conflicts explicitly; never use blind overwrite.

## Performance principles
Virtualise very large lists; decode media lazily; cap concurrent requests; back off failures; avoid state updates on every scroll tick; cache only assets that the user explicitly chooses for offline. Document performance budgets and measure with browser tooling before changing them.

## Deployment
Current: **none configured**. The CI workflow is a quality gate, not a release path. A future Cloudflare Pages deployment will require manual consent, secure environment variables, unique per-app origin and tested rollback. Do not copy the Novel Library's one-shot deployment workflows.

## Architecture review checklist
Does each API preserve the identity/progress semantics? Can the app run if the hub is down? Does it expose private data in client bundles or public files? Are cross-origin auth assumptions explicit? Are destructive changes reversible? Are tests and rollback specified? If any answer is unclear, write an ADR before code.


## In-branch demonstration implementation (18 November 2026)

The `feature/local-manga-catalogue-reader` branch adds `src/domain/validation.ts` (runtime schemas, rights and archive-index preflight), `src/domain/reader.ts` (pure chapter/page navigation), `src/domain/filters.ts`, `src/data/fixtures.ts` (three entirely fictional sample series) and `src/data/fixtureArt.ts` (original canvas-generated PNG illustrations). The React app provides a sample-mode shelf, series details and a page-step reader. The existing empty `src/data/catalogue.ts` remains the only real catalogue placeholder. All progress is retained in React state only and discarded on refresh. The image cache keeps the current page and at most the next page. No server or external asset resolver exists.

This implementation is in a working branch and **has not passed its dependency-backed quality gates**. See `docs/DEVELOPMENT_REPORT_2026-11-18.md`. It does not change the intended future ports or the explicit no-backend integration boundary.
