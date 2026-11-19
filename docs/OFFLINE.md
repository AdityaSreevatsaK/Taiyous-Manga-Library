# Synthetic Manga Offline Reading (PR D)

**Scope:** Public fictional catalogue only. Nothing in this milestone fetches, stores or publishes private or externally owned manga.

## Offline application shell

The production build includes `public/sw.js`. It is registered only in production, not the Vite development server. On successful install it fetches the local app's production HTML and its hashed JS/CSS bundle into a **new release-specific cache**. It records a ready marker only after every resource completes. If installation fails, the old release remains available.

Service worker navigation is network-first, falling back to the latest verified application shell for offline direct URL access. Hashed assets are cache-first and kept across at least the previous release. Cache cleanup excludes all media caches. This implementation does not promise offline access before a successful online visit.

## Per-chapter media

A chapter can be explicitly downloaded from its series details. The app generates its own **synthetic** PNG pages, verifies each binary's PNG magic bytes, stores it in Cache Storage and records SHA-256 checksums and sizes in a separate versioned `localStorage` receipt.

- Sequential download: bounded memory, byte budget 75 MiB per chapter, per-page progress and cancellation.
- Two-phase completion: the receipt is committed only **after every cached page has passed integrity checks**.
- Interrupted/failed new downloads clean up only pages written by that attempt. Existing valid copies are never overwritten silently.
- Corrupt, missing or incomplete copies show an explicit recovery state; remove the damaged copy before a new download.
- The reader retrieves cached bytes and verifies their checksums before decoding. There is no silent fallback to newly generated pages for a recorded offline chapter.
- Remove individual offline copies without any Owner mode or access to cloud content; reading progress and preferences remain untouched.
- The Offline tab only lists verified local chapter copies.
- No full-series download is automatic.

## Security and limits

Browser `CacheStorage`, `crypto.subtle`, and `localStorage` must be available; browsers may deny access or evict site data. No auth, Hugging Face data, private URL, token, real manga page or untrusted binary is involved. SHA-256 is local integrity verification, not licensing proof. Real private media will require a separately approved asset adapter and rights checks.

## Acceptance

CI now runs Playwright against `npm run build` + `npm run preview`, not only the development server. Tests cover opt-in downloads, chapter counts, offline image blob use, missing/corrupt page recovery, removal without progress loss, vertical image bounds, no automatic downloads, and **cold offline launch** with a service-worker-controlled production app. Manual mobile-browser/OS storage-eviction tests remain pending.

## Rollback

The app's new service worker cache retains previously verified release assets. The downloaded synthetic chapter cache is separate from shell caches; routine app updates must never delete it. To roll back the app, redeploy the previous known-good Cloudflare production release after owner approval. No automatic purge of personal progress or media.
