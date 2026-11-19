# Reader security checkpoint (18 November 2026, draft features)

- Only original synthetic manga samples are used; no real manga, private asset URL, storage token or OAuth login is included.
- `src/domain/localReaderStorage.ts` preserves malformed records rather than deleting unrelated progress and rejects older timestamps.
- `src/data/offlineChapters.ts` validates per-page SHA-256 checksums, complete manifest identities, MIME types and chapter byte limits; media caches are isolated from shell caches.
- `public/sw.js` stages a complete revisioned app shell and retains a known-good fallback; the offline fallback currently inlines **trusted first-party compiled JS/CSS**. Do not introduce a strict CSP without retesting this path or designing a CSP-compatible fallback.
- Offline content and reading history are locally accessible to anyone with that browser profile; no device encryption claim.
- Real private media storage and owner deletion remain blocked on server-side authorisation, approved rights, backups, quotas and conflict resolution.
- No production merge or deployment has occurred in this session.

The original threat model below remains relevant; statements assuming the scaffold is private or browser persistence absent are historical.

---

# Security, Privacy and Content Rights

## Threat model
Assets: private catalogues, personal viewing/reading history, owner credentials, authentication sessions, private media assets, and revision-controlled synchronisation. Threats: unauthorised read/write, cross-site script injection via metadata, leaked API keys, CSRF, SSRF through remote asset fetches, archive traversal, corrupted caches, conflict-driven data loss, careless deployment logs and malicious third-party media.

## Trust boundaries
1. Public browser code is **not secret**, even if the GitHub repo is private. No tokens in Vite `VITE_*`, JavaScript bundles, localStorage, screenshots, source maps or CI logs.
2. Any future serverless backend is a separate trust boundary; session validation, owner checks and input validation must occur server-side.
3. Private cloud storage must enforce both access and object-level authorisation. The Novel Library's Hugging Face OAuth session is for its own origin and MUST NOT be assumed to provide shared SSO.
4. Importers treat all files, tags, titles and provider responses as untrusted.
5. Offline caches are accessible to browser users on that device; do not claim device encryption unless implemented.

## Domain-specific controls
Protect image manifests and binaries; reject archive path traversal, decompression bombs, script-bearing SVG/HTML, oversized images and unexpected MIME types. Do not hotlink private media to other domains.
No unlicensed manga downloads, paywall bypass, scraping of protected sites, reader requests to arbitrary URLs, or remote image proxying without SSRF protection.

## Mandatory controls before writing private data
- An approved session design with CSRF protection on mutations, Secure HttpOnly cookie where appropriate, server-side owner revalidation and per-app scope.
- Schema validation, max object/payload sizes, allowlisted content types, rate/size/concurrency limits and strict path handling.
- Revision-guarded writes, non-destructive reconciliation, tombstones, backup/restore and two-device collision tests.
- User-facing warning before permanent deletion; no browser-only owner enforcement.
- Content-Security-Policy, safe metadata rendering, outbound URL validation, sanitised filenames and precise error messages without secret leakage.
- Dependency audit, secret scan, licence/provenance validation and accessibility review.

## Incident handling
If data exposure, missing originals or a secret leak is suspected: stop writes/deployments, preserve safe logs, rotate affected secrets, revoke sessions, audit revisions, restore from verified backups and document the event. Do not hide a security incident to keep a CI run green.

## Data rights
Use only user-owned, authorised or appropriately licensed media and metadata. Keep origin attribution and honour providers' terms and usage quotas. AI-generated test fixtures must be clearly synthetic. Never deploy copyrighted content to a public asset directory.

## Security tests
Unit tests for malicious strings, invalid IDs, malformed manifests and boundary values. Integration tests for unauthorised reads/writes, expired credentials, CSRF, conflict rejection, failed uploads, rollback, and offline cache eviction. Do not run private integration tests in public CI without isolated disposable fixtures.

## Public static demo host
The GitHub Pages preview uses synthetic fixtures only. Cloudflare Pages may apply `public/_headers` strict CSP and security headers; verify behaviour in deployed response headers. No hosting choice implies protection for private source media, which remains unimplemented.
