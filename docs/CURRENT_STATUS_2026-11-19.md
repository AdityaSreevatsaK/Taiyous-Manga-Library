# Current Manga Library status (19 November 2026)

The canonical production branch is `master`; this document records the verified baseline and the active UI upgrade.

## Verified before the UI upgrade
- Merge #22 at `d192a29336bf6a22fd8c3b62cc5f78cb29d55076` fixed service-worker release fingerprints.
- The full master CI passed: [Verify Manga Library](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/actions/runs/44547174555).
- The deployed Cloudflare smoke check passed: [Live Cloudflare smoke](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/actions/runs/44547175370).
- All 4 sample series and 36 generated pages are fictional. No private catalogue, Hugging Face integration, account authorisation or cross-device sync is implemented.

## Approved UI changes under development
- Eight navigable sections, local Trying Out / Finished / To Be Read assignment and derived Currently Reading / Available Offline, plus progress-derived Analytics.
- Six themes with Sepia default and legacy Dark/Light preference migration.
- Two approved transparent logo variants and matching favicons/PWA artwork from the Novel Library's optimised approved assets.
- Top-left status ribbons, searchable chapters, bounded synopsis and a bottom chapter selector.
- Personal shelves, ratings, notes, tags and nested collections use versioned local storage and the v2 personal JSON backup; legacy v1 reader backups remain importable. Offline manga images are never included.

## Boundaries and remaining work
- Personal ratings/notes, nested collections and personal tags are implemented locally. Full advanced search, longitudinal usage analytics and secure private data integration remain planned.
- Branch protection and Cloudflare gating require account-level settings not currently accessible to the GitHub App.
- Firefox/WebKit, iOS/Android devices and very long chapter benchmarking remain to be verified.
- No fake private connection, no private media and no destructive migration.
