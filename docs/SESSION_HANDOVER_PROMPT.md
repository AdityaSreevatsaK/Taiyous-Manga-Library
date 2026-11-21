# Current Manga Library agent handover

**Repository:** https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library  
**Scope:** this repository only.

This is a current-session entry point, not a static claim that the code has not changed. Before acting, inspect the latest master SHA, working tree, branches, open PRs, recent commits, workflows, implementation and current docs.

## Mandatory first steps

1. Read AGENTS.md, README.md, docs/PROJECT_STATUS.md, docs/ARCHITECTURE.md, docs/DATA_CONTRACTS.md and docs/SECURITY.md.
2. Run git status --short --branch, git rev-parse HEAD, git log -20 --oneline, git branch -a, git diff and git diff --cached. Preserve existing changes.
3. Refresh GitHub master, open PRs/issues, recent commits and Actions. Verify merged_at and exact head SHAs.
4. Trace the relevant code and tests. Do not trust this handover or old dated reports over current implementation.
5. Classify work as implemented, partially implemented, planned, deprecated, historical/superseded or unverified.
6. Implement on a short-lived branch, test, update the owning docs and open a PR.
7. Routine non-destructive green PR merges and Cloudflare deployment are authorised without repeated owner approval. Verify the exact merged SHA and post-merge live smoke.

## Product and architecture essentials

- Product name: Taiyou's Manga Library.
- Independent React/TypeScript/Vite app on Cloudflare Pages with same-origin Pages Functions.
- Private dataset: AdityaSreevatsaK/Taiyous-Manga. The Storage Controller owns uploads, backups, migration and media deletion.
- Manga uses a dedicated owner Hugging Face OAuth client and encrypted HttpOnly session. Do not reuse Novel Library auth/cookies.
- Initial/private catalogue load is one full GET /api/library snapshot. Search, tags, creators, shelves, collections and sorting are local. Avoid per-manga metadata N+1 calls.
- Covers are lazy per-asset requests with verified bounded IndexedDB cache. Chapter manifests/pages load only for the chapter being read, through the authenticated gateway.
- Private media is online-only. Only synthetic sample chapters support explicit offline downloads.
- Whole chapter is one continuous vertical reader; Previous/Next move between chapters only.
- Personal progress, preferences, shelves, annotations, tags, favourites, collections and analytics remain browser-local. Manual JSON backup is the transfer path; automatic sync is not implemented.
- Master Controls includes password-free Analytics and protected source metadata corrections (title, creators, publicationStatus only). Protected writes require the independent passphrase, HF write scope and revision guard.
- Analytics is prospective, approximate, opt-out and device-only. The rolling 14-day paired chart labels dates every three days.

## Approved UX constraints

Six visible shelves: Home, Currently Reading, Trying Out, Available Offline, Finished and All Manga. Analytics lives under Master. Six themes: Sepia default, Paper, Charcoal, Midnight, Ocean and Plum. Approved Sun mark, adjacent cloud indicator, three contained hero covers, Novel-style details/notifications/Master/analytics parity, centred footer and no browser-native alerts.

## Safety

No private data in GitHub, CI, screenshots, logs or public assets. No arbitrary image proxy, protected-site scraping, paywall/DRM bypass or unlicensed redistribution. No edits to sibling repositories or private HF data. Destructive private operations, production secret changes and expanded OAuth permissions require explicit owner approval.

## Current authoritative docs

- docs/PROJECT_STATUS.md: dated implementation/verification snapshot.
- docs/PROJECT_HISTORY.md: original vision, product evolution, durable decisions and lessons.
- docs/ARCHITECTURE.md: current runtime/request architecture.
- docs/DATA_CONTRACTS.md: current types, IDs, storage and API contracts.
- docs/ROADMAP.md: remaining acceptance and future decisions.
- docs/DEPLOYMENT.md / docs/HF_READONLY_CONNECTION.md: production and private owner flows.
- docs/TESTING.md / docs/REAL_DEVICE_ACCEPTANCE.md: automated and manual verification.

Historical snapshots (18–20 November reports) are preserved for provenance. They are not current instructions.
