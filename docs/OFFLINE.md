# Offline behaviour

Offline support has two separate scopes. Do not confuse the public application shell, synthetic sample chapter downloads and private cover caching.

## 1. Public application shell

The production app registers public/sw.js. The build stamps the worker with a fingerprint derived from the production assets so changed builds trigger an update.

The worker:
- Fetches the current app HTML, hashed JS/CSS and approved brand assets.
- Stages them in a new release-specific cache.
- Writes a ready marker only after all required resources and the self-contained offline fallback are complete.
- Keeps the two newest verified shell releases and removes incomplete/older shell caches.
- Uses a network-first navigation path and falls back to the newest verified offline shell.
- Uses cache-first for known public app assets.
- Excludes /api/*, the service worker script and private media routes from interception/caching.

The self-contained offline document inlines trusted first-party production JS/CSS. Re-test this fallback if changing CSP or shell generation.

## 2. Synthetic sample chapter downloads

The synthetic sample reader supports explicit per-chapter downloads. These are not private manga files.

- User initiates each download; no whole-series or automatic download.
- Pages are fetched/generated sequentially with bounded memory and a 75 MiB per-chapter byte budget.
- The app verifies PNG bytes and SHA-256 receipts before marking a chapter complete.
- The receipt is committed only after every page has passed integrity checks.
- Interrupted or failed attempts remove only the pages written by that attempt.
- Corrupt or incomplete copies show a recovery state; they are not silently replaced.
- The Offline shelf lists verified local sample chapter copies.
- Removing a sample offline copy does not remove reading progress or unrelated copies.

Chapter downloads use a separate CacheStorage namespace from the app shell.

## 3. Private manga media

Private catalogue and chapter pages require an online owner-authenticated request through Cloudflare Pages Functions. Private chapter pages are not downloaded to CacheStorage and cannot currently be read offline.

Verified private covers may be stored in a bounded IndexedDB cache for repeat display. This is a cover-performance optimisation only; it does not provide private chapter offline reading. The cover cache is cleared on sign-out.

## Security and limitations

- CacheStorage, IndexedDB, localStorage and browser quotas may be unavailable or evicted by the browser/OS.
- Local storage is not device encryption.
- SHA-256 confirms byte integrity, not ownership, permission or licence.
- No private HF token, session, private URL or API response is cached by the service worker.
- Do not clear personal records or offline sample chapters as a generic app rollback.

## Verification

CI tests the production build, synthetic opt-in downloads, cancellation, corruption recovery, offline shell, cold offline launch, service-worker fingerprint and two-release rollback. Physical Android/iOS storage eviction and OS background behaviour remain manual acceptance.

See docs/SERVICE_WORKER_RELEASES.md and docs/REAL_DEVICE_ACCEPTANCE.md.
