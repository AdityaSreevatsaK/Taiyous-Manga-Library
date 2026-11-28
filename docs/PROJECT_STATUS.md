# Project status: Taiyou's Manga Library

> Journal foundation candidate: separate D1 migration, validated contract and owner-session CRUD are proposed in a feature branch. No production D1 binding, UI or import is verified. See [Journal foundation](MANGA_READING_JOURNAL.md).

**Snapshot date:** 21 November 2026  
**Repository:** [AdityaSreevatsaK/Taiyous-Manga-Library](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library)  
**Production:** [taiyous-manga-library.pages.dev](https://taiyous-manga-library.pages.dev/)  
**Default branch:** master  
**Implementation baseline commit:** ff519fc175bb61e234bbdea278679e32afd97fe5  
**Latest change:** PR #64, rolling calendar labels on the 14-day analytics chart.

> This is a dated snapshot of the implementation baseline, not a permanent source of truth. The documentation-only PR may advance master without changing the implementation baseline. Every agent must re-check local Git status, the current default-branch SHA, open PRs, workflows, implementation and deployment before acting. See AGENTS.md.

## Release and repository state at this snapshot

- GitHub API reports the repository as **public**. This permits source visibility only, not publication of private manga, personal data or credentials.
- master points to ff519fc175bb61e234bbdea278679e32afd97fe5 (21 November 2026, 15:16:10 UTC).
- PRs #56–#64 are merged. PR #64 is the latest merged product change.
- The five open PRs at the time of inspection are Dependabot updates only: #4 actions/checkout 4→7, #5 actions/setup-node 4→7, #6 @vitejs/plugin-react 4→6, #7 React DOM/types 18→19, and #8 React/types 18→19. No open product PR or open non-PR issue was returned by the inspected GitHub API listing.
- Current remote branch list also contains historical feature branches and Dependabot branches. A branch's existence does not mean its work is part of master.
- Branch-protection status could not be inspected through the connected GitHub integration (API returned 403). Do not claim branch protection is enabled or disabled without checking repository settings directly.
- Latest master checks for the snapshot SHA all passed:
  - [Verify Manga Library](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/actions/runs/44918275621)
  - [Firefox and WebKit reader parity](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/actions/runs/44918275594)
  - [Live Cloudflare smoke](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/actions/runs/44918275658)
- These runs verify repository CI and the deployed public app shell/API boundary. They do **not** prove the owner's authenticated private-media workflow, a live HF metadata correction, physical-device acceptance or low-memory hardware performance.

## Feature status

| Area | Status | Current implementation and boundary |
|---|---|---|
| Public application and deployment | **Implemented** | React/Vite app on Cloudflare Pages; master is the production source branch. GitHub Pages is not the production host. |
| Synthetic catalogue | **Implemented** | Fictional sample manga and generated demonstration artwork remain separate from the private catalogue. |
| Private Hugging Face OAuth | **Implemented in code; owner acceptance remains separate** | Per-app confidential OAuth, state/PKCE, exact owner check and encrypted HttpOnly session. The Novel Library's cookie is not reused. |
| Private catalogue read | **Implemented** | One authenticated GET /api/library returns the validated catalogue snapshot and immutable dataset revision. Catalogue, tags, shelves, collections and search are filtered in memory. |
| Catalogue refresh | **Implemented** | Refresh on tab return/focus and at a bounded interval while browsing; no automatic polling while reading a chapter. A manual metadata refresh is available. |
| Private covers | **Implemented** | Owner-authenticated gateway, metadata/SHA/size/MIME validation, lazy loading and request deduplication. Verified covers may be cached locally in bounded IndexedDB storage; logout clears this cache. |
| Private chapter manifests/pages | **Implemented** | Owner-authenticated manifest and page routes, immutable IDs, pinned-revision and integrity validation. Opening a private chapter queues all page bytes in order at concurrency 3 and retains page sources until chapter close; only the visible window is mounted/decoded. Total source memory still scales with chapter size. |
| Continuous chapter reader | **Implemented** | Whole chapter in one vertical flow; previous/next controls move between chapters. Canonical readable series/chapter slugs preserve immutable IDs and legacy bookmark resolution. |
| Personal reading progress | **Implemented, device-local** | Per-manga versioned browser storage, chapter/page IDs and approximate vertical offset. Private progress summaries can be shown before a manifest is opened; the reader validates against the manifest before resuming. |
| Personal shelves, ratings, notes, tags, favourites | **Implemented, device-local** | Includes Trying Out, Finished and legacy To Be Read state. Imported publication status/tags remain separate from personal status/tags. |
| Nested collections | **Implemented, device-local** | Validated hierarchy, immutable IDs, revision-guarded browser writes and non-destructive membership handling. |
| Personal JSON backup | **Implemented, manual** | Versioned local export/import with validation and merge protections. Backups contain personal records, not manga media. Keep exported files private. |
| Synthetic offline chapters | **Implemented, explicit opt-in** | Sample chapters only; checksum-verified CacheStorage copies and offline shell. No automatic downloads. |
| Private manga offline downloads | **Not implemented** | Private covers can be locally cached for faster display, but private chapter pages are not an offline chapter-download feature. |
| Manga Master Controls | **Implemented** | Bookmarkable /master route, Analytics and Library management views. Analytics does not require the owner passphrase. |
| Private source metadata corrections | **Implemented in code; production configuration/owner acceptance must be checked** | Title, creator and publication-status corrections only. Requires owner HF sign-in with write-repos scope, TAIYOU_OWNER_PASSPHRASE, short-lived owner grant and revision-guarded commit. |
| Personal synopsis and annotations in Master | **Implemented, device-local** | Local overrides and personal fields do not write the source catalogue. |
| Reading usage analytics | **Implemented, prospective and device-local** | Opt-out journal of approximate focused/non-idle app time, reading time, offline time, per-manga time and up to 500 recent actions. Retains up to 400 daily buckets. Historical minutes cannot be reconstructed. |
| Analytics chart | **Implemented** | Rolling 14-day paired active-app/reading bars; dynamic day/month labels every three days, including today. |
| Automatic cross-device personal sync | **Not implemented** | Use manual JSON backup/restore. Do not describe localStorage as cloud-synchronised. |
| In-app media upload/permanent deletion | **Not implemented here** | The Manga Storage Controller owns approved uploads, backups, migrations and source-media deletion. |
| Physical iOS/Android acceptance | **Unverified / manual** | Firefox/WebKit CI is not physical iOS Safari or Android Chrome evidence. |
| 300–1,000-page low-memory device benchmark | **Unverified / manual** | Deterministic geometry and browser tests do not prove real device memory or decode performance. |

## Data and request architecture

### Catalogue requests

On initial app load, the browser calls GET /api/library once. That endpoint authenticates the owner, resolves the private dataset revision and returns the complete validated catalogue. The app then performs title search, creator/tag/publication filtering, shelf selection, collection filtering, sorting and analytics locally.

While browsing the catalogue, the app refreshes the catalogue on tab focus/visibility return and on a bounded timer (90-second interval, with a 60-second minimum between actual requests). It does not poll while a chapter reader is open. A user-triggered refresh uses the same catalogue endpoint. Do not regress to per-manga metadata requests for normal catalogue screens.

### Manga-specific media requests

- Covers are fetched per manga only when their cover component is near the viewport or prioritised. A 360px IntersectionObserver margin, shared in-flight request and content-addressed cache avoid repeated work. The browser cache is bounded to 120 covers / 72 MiB, with a smaller session hot cache.
- A chapter manifest is fetched when a private chapter is opened or a direct chapter bookmark is resolved.
- Private page assets are fetched for that chapter through the authenticated media gateway. The reader preloader caps concurrent requests (default 3, hard maximum 4) and the reader limits mounted/decoded images to the visible area and neighbours. This is expected media traffic, not catalogue N+1 fetching.
- Private API responses are no-store; the service worker excludes /api routes.

## System boundaries

- **Private dataset:** AdityaSreevatsaK/Taiyous-Manga, canonical data/library.json.
- **Storage Controller:** separate repository that prepares and manages private media and catalogue storage. The Reader does not upload, migrate or permanently delete original media.
- **Cloudflare Pages Functions:** same-origin OAuth, catalogue, cover, manifest, page and protected Master endpoints.
- **Browser storage:** localStorage for personal records and analytics; IndexedDB for verified private covers; CacheStorage for the public app shell and explicitly downloaded synthetic sample chapters.
- **Shared Core / Hub:** no runtime dependency. VITE_HUB_URL is reserved configuration, not proof of an active integration.
- **Novel Library:** visual reference only. Do not reuse its OAuth cookie, private dataset, EPUB reader or personal data.

## Runtime configuration names

Cloudflare Pages Functions runtime configuration uses the following names (values must never be committed):

- HF_REPO_ID
- HF_OWNER_USERNAME
- HF_CLIENT_ID
- HF_CLIENT_SECRET (secret)
- SESSION_SECRET (secret; 32 random bytes, base64 encoded)
- TAIYOU_OWNER_PASSPHRASE (Production secret for the separate Master owner grant)

The OAuth callback is https://taiyous-manga-library.pages.dev/api/auth/callback. Read-only login uses openid/profile/read-repos; the separate write login requests write-repos as well. The exact owner and repository are checked server-side.

## Priority outstanding work

1. Complete a genuine owner-authenticated acceptance of private covers, chapter manifests/pages, logout/cache clearing and protected metadata correction using a disposable private test dataset or an explicitly approved test record. Do not infer this from anonymous CI.
2. Verify Cloudflare Production secret and OAuth write-scope configuration without disclosing values. The UI being present is not proof the production secret/scope is configured.
3. Complete physical Android Chrome and iOS Safari acceptance and a measured 300–1,000-page low-memory test with authorised disposable images.
4. Continue reviewing Dependabot PRs #4–#8 individually. React 19 and Vite plugin major updates must be assessed with full browser/reader tests rather than merged automatically.
5. Consider private-media offline downloads and automatic cross-device personal sync only through a reviewed ADR, explicit owner consent, revision/conflict rules, quota policy and isolated tests.

See docs/ROADMAP.md for ordered acceptance and docs/PROJECT_HISTORY.md for the project's evolution.
