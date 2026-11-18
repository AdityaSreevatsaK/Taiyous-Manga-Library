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
