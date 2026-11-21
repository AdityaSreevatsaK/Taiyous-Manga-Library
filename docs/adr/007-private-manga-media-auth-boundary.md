# ADR-007: Per-app private Manga gateway and owner metadata boundary

**Status:** Accepted and implemented in the current application. Owner-authenticated production acceptance remains a separate verification item.  
**Original decision date:** 19 November 2026; implementation evolved through 21 November 2026.

## Context

The Manga Library is a public-source Cloudflare Pages application that reads private manga stored in a private Hugging Face dataset. Browser code cannot protect embedded credentials or private provider URLs. The Novel Library's OAuth cookie is origin-bound and cannot be reused by the Manga app.

## Decision

Use a dedicated same-origin Cloudflare Pages Functions gateway with its own confidential Hugging Face OAuth client and server-held access token. Public browser code never receives the HF bearer token or private dataset URL.

The implementation lives in:
- functions/_lib/mangaAuth.ts
- functions/api/auth/[action].ts
- functions/api/library.ts
- functions/api/media/[kind].ts
- functions/api/master.ts
- src/data/privateLibrary.ts
- src/data/privateMedia.ts
- src/data/masterGateway.ts

## Implemented read boundary

1. OAuth uses state and PKCE, confidential code exchange and exact owner identity verification.
2. Session data is encrypted in a Secure, HttpOnly, origin-bound cookie.
3. GET /api/library authenticates the owner, resolves the immutable HF dataset revision and returns the complete validated data/library.json catalogue. Normal catalogue filtering remains in memory.
4. GET /api/media/cover, /manifest and /page require the owner session. The browser validates canonical manga/chapter/page membership from the authenticated catalogue/manifest; canonical asset requests carry the immutable revision and validated descriptor. The server validates descriptor bounds, ID-derived path, MIME, byte length and SHA-256. It does not re-resolve the moving main revision or refetch catalogue/manifest for each canonical asset. Legacy requests without pinned descriptors retain server-side catalogue/manifest membership checks.
5. Private responses are no-store. The service worker excludes /api/*.
6. Verified private covers may be cached in bounded IndexedDB for faster repeat display; logout clears this cache. Private chapter pages are not downloaded for offline use.
7. The reader makes chapter-manifest and page-asset requests when the user opens a chapter. This is distinct from per-manga catalogue metadata fetching.

## Implemented owner metadata correction boundary

The app has a separate Master owner grant. It requires:
- Current owner HF session.
- TAIYOU_OWNER_PASSPHRASE configured as a Cloudflare Production secret (16–128 characters).
- Successful unlock, creating an encrypted Secure, HttpOnly, SameSite=Strict cookie tied to the current HF session fingerprint.
- A 10-minute expiry.
- A Hugging Face session with write-repos scope for source changes.
- Same-origin request validation, bounded JSON body and strict runtime schema.
- Exact parent dataset revision and whole-catalogue validation before commit.

The currently supported source fields are title, creators and publicationStatus. The update preserves manga/chapter/page IDs and keeps the public slug stable when title changes. No other source fields are editable through this API.

Analytics and personal annotations do not require this owner passphrase and remain browser-local. Media upload, original deletion, bulk migration and media backups remain the Storage Controller's responsibility.

## Security and operational consequences

- Read and write OAuth flows are separate. A read-only session cannot perform a source correction.
- Cloudflare secrets must never be stored in VITE_* variables, GitHub source or public logs.
- The gateway must remain same-origin; do not add arbitrary remote URL fetching or an open proxy.
- Revision conflicts fail closed and require refresh/review.
- Do not infer that a configured-looking UI proves Cloudflare secrets, OAuth scopes or a real private dataset commit are working.
- Anonymous CI and live smoke verify denial and public deployment, not the owner's private read/write path.

## Rejected shortcuts

- Reusing Novel Library cookies or HF credentials.
- Sending HF tokens or private provider URLs to the browser.
- Relying on client-side owner flags.
- Skipping revision checks for speed.
- Caching private API responses in the service worker.
- Treating private cover caching as private chapter offline support.
- Letting the reader upload/delete media or bypass the Storage Controller.

## Verification and remaining acceptance

Automated tests cover synthetic session, owner, revision, validation and Master correction paths. The current live Cloudflare smoke verifies public assets and anonymous API denial. It does not sign in as the owner.

Still required when a private integration change is made:
- Owner-authenticated cover, manifest and page rendering.
- Logout and cover-cache clearing.
- Write-scope and passphrase configuration verification.
- Revision conflict handling against a disposable private dataset or explicitly approved test record.
- Physical-device acceptance and low-memory chapter benchmarks where relevant.

See docs/ARCHITECTURE.md, docs/SECURITY.md, docs/HF_READONLY_CONNECTION.md, docs/DEPLOYMENT.md and docs/TESTING.md.
