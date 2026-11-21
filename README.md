# Taiyou's Manga Library

**Live application:** https://taiyous-manga-library.pages.dev/

Taiyou's Manga Library is an independent personal manga catalogue and image-based reader. It supports a continuous vertical chapter reader, chapter/page progress, personal organisation, a private owner-authenticated manga catalogue and an explicit offline demonstration flow for synthetic sample chapters.

The existing Novel Library is a visual reference for approved shared chrome and interaction patterns. This application has its own manga domain, OAuth client, private dataset gateway and reader. It does not depend on the Novel Library or Shared Core at runtime.

## Current features

- **Editorial library:** three-cover featured Home, six visible primary shelves, six themes (Sepia default), approved Sun branding, cloud status indicator and responsive details pages.
- **Private catalogue:** dedicated Hugging Face OAuth and same-origin Cloudflare Pages Functions. The app loads the complete validated catalogue in one request, then filters tags, creators, shelves, collections, status and search locally.
- **Private artwork and reader:** owner-authenticated, revision-pinned cover, chapter manifest and page endpoints with MIME/size/SHA validation. Covers load lazily and use a bounded verified IndexedDB cache.
- **Continuous reader:** the whole chapter is one vertical flow. Previous/Next navigate chapters only. Readable permalinks resolve to immutable manga/chapter IDs and progress includes immutable page identity.
- **Personal organisation:** device-local progress, shelves, 1–10 ratings, notes, personal tags, favourites, explicit chapter completion and nested collections.
- **Master Controls:** password-free device-only Analytics plus a protected Library management workspace. Narrow source corrections (title, creators and publication status) require an independent owner passphrase, Hugging Face write scope and revision-safe server validation.
- **Analytics:** prospective, opt-out device-only active/reading/offline time, per-manga duration and activity journal. The 14-day paired chart has rolling date labels every three days.
- **Manual backup:** validated version-2 JSON export/import for personal data. No manga media or credentials are included.
- **Offline sample:** explicit opt-in synthetic chapter downloads and a verified offline app shell.

The optional public sample catalogue includes **Five Chapter Scroll Trial**, an original synthetic series with five chapters and 36 generated illustration pages. It is separate from the private catalogue.

## Data loading and privacy

The initial private catalogue request is GET /api/library and returns the complete validated catalogue at an immutable dataset revision. Normal catalogue filtering is performed in memory; the app does not fetch each manga's metadata separately.

Individual media requests are expected:
- Covers are requested lazily for visible/prioritised manga and cached locally after verification.
- A chapter manifest is requested when a chapter is opened.
- Page bytes are requested for the chapter being read through the authenticated media gateway.

The private dataset is AdityaSreevatsaK/Taiyous-Manga. The separate Taiyou-Manga-Storage-Controller manages original media imports, backups, migrations and deletion. Public GitHub and Cloudflare assets contain source, approved brand artwork and public demo imagery/fixtures only.

Personal progress, ratings, notes, tags, collections and analytics remain in browser-local storage. Manual JSON backup is the current transfer path. Automatic cross-device personal-data sync is not implemented.

## Current limitations

- Private chapter pages are online-only. The synthetic sample reader has explicit offline chapter downloads; verified private cover caching is not private chapter offline support.
- No automatic cross-device personal-data synchronisation.
- No in-app original-media upload, bulk migration or permanent deletion. Use the separate Storage Controller.
- Owner-authenticated private media and protected metadata correction require real production OAuth/secret configuration and separate owner acceptance; anonymous CI does not prove these paths.
- Private chapters currently preload every page at concurrency 3 and retain page sources until the chapter closes; only the visible image window is mounted/decoded. Total source memory can therefore grow with chapter size. Physical iOS Safari/Android Chrome acceptance and measured low-memory 300–1,000-page hardware testing remain manual unless recorded in docs/REAL_DEVICE_ACCEPTANCE.md.
- No standalone software licence has been selected. Public source visibility does not grant rights to manga artwork.

## Quick start

Requirements: Node.js 22+, npm and Git.

    git clone https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library.git
    cd Taiyous-Manga-Library
    npm ci
    npm run dev

The Vite development server binds to 127.0.0.1. Synthetic sample features can be exercised locally. Production OAuth and private media routes require the Cloudflare Pages Functions environment.

## Validation

    npm ci
    npm run typecheck
    npm test
    npm run build
    node scripts/check-bundle.mjs

Production-build Chromium E2E:

    npm run build
    E2E_PRODUCTION=1 npm run test:e2e

Firefox/WebKit smoke:

    npm run build
    npx playwright test --config playwright.cross-browser.config.ts

## Deployment

Cloudflare Pages deploys master using npm ci && npm run build, output dist, Node.js 22. The GitHub Actions live smoke verifies the deployed asset fingerprint and anonymous security boundary after a master push. A merge is not proof of deployment; check the exact post-merge smoke run.

Private runtime configuration is described in docs/DEPLOYMENT.md and docs/HF_READONLY_CONNECTION.md. Never put secrets in VITE_* variables or public files.

## Documentation guide

1. AGENTS.md — mandatory dynamic state-awareness and engineering rules.
2. docs/PROJECT_STATUS.md — dated current state and latest evidence.
3. docs/PROJECT_HISTORY.md — original vision, evolution, decisions and lessons.
4. docs/ARCHITECTURE.md — runtime and source-code map.
5. docs/DATA_CONTRACTS.md — domain, private dataset and local record schemas.
6. docs/SECURITY.md — privacy, OAuth, media and rights boundaries.
7. docs/DEPLOYMENT.md and docs/HF_READONLY_CONNECTION.md — production operations.
8. docs/TESTING.md and docs/REAL_DEVICE_ACCEPTANCE.md — automated/manual verification.
9. docs/ROADMAP.md and docs/DECISIONS.md — outstanding priorities and durable decisions.

Dated audit reports from 18–20 November are retained as historical evidence. They do not override current source or GitHub state.
