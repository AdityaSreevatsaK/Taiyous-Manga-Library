# Security, privacy and content rights

**Current security boundary:** public React application plus same-origin Cloudflare Pages Functions. Private catalogue and media are owner-authenticated. Personal reading records remain browser-local.

## Assets and trust boundaries

Protect:

- Private manga catalogue and original cover/chapter files in the private Hugging Face dataset.
- Owner Hugging Face OAuth access token and encrypted session cookie.
- Separate short-lived Master owner grant and passphrase.
- Device-local reading progress, ratings, notes, tags, collections, activity journal and manual backups.
- Integrity and revision lineage for catalogue, manifests, covers and pages.

Trust boundaries:

1. Public GitHub source and Cloudflare static assets are public. They contain code, approved brand artwork and public demo imagery only.
2. Browser JavaScript is never trusted with secrets. Every VITE_* value is public by design.
3. Cloudflare Pages Functions are the private gateway. They validate session, owner, repository, object identity, revision, content type, byte size and digest.
4. Hugging Face is the private source of record. The browser must not call private HF dataset URLs or hold a bearer token.
5. Browser-local storage is accessible to users of the same browser profile and may be evicted. Do not claim encryption or durable retention.
6. The Manga Storage Controller is a separate ingestion/backup/migration/deletion control plane. This app must not bypass it.

## OAuth and session controls

- Manga uses a dedicated confidential Hugging Face OAuth client and exact callback at https://taiyous-manga-library.pages.dev/api/auth/callback.
- OAuth uses state and PKCE. The confidential code exchange happens in the Pages Function.
- The signed-in account is checked against the configured owner and private dataset.
- The access token is stored only in an encrypted, Secure, HttpOnly, origin-bound session cookie. Session status endpoints never return the token.
- Normal read access requests openid, profile and read-repos. The separate write login requests write-repos as well.
- Do not assume Novel Library cookies or identity authenticate this app. Different Pages origins do not share same-origin HttpOnly cookies.

## Private catalogue and media

- GET /api/library returns the complete validated catalogue at an immutable private dataset revision. It is owner-only and no-store.
- GET /api/media/cover, /manifest and /page are owner-only, same-origin and no-store.
- Every private media request validates the owner session, identifier/path syntax and descriptor bounds. The browser supplies canonical cover/page descriptors only after validating the owner-authenticated catalogue/manifest. The gateway validates the ID-derived private path, actual MIME, byte length and SHA-256.
- Canonical fast paths use the immutable revision and validated descriptor supplied by the authenticated app. They do not re-resolve the moving main revision or refetch catalogue/manifest membership for each asset request. Legacy requests retain server-side catalogue/manifest membership checks. This is a single-owner application, not a multi-tenant permission boundary.
- The service worker explicitly excludes /api/* and private media is never part of the public app-shell cache.
- Verified covers may be cached in a bounded IndexedDB store for repeat display. Sign-out clears that store. This does not make private chapter pages available offline.
- Private chapter downloads are not implemented. Only synthetic sample chapters have explicit offline downloads.

## Protected Master writes

Source publication metadata corrections are restricted to title, creators and publicationStatus. The server requires:

- A valid owner HF session.
- A separate configured TAIYOU_OWNER_PASSPHRASE (16–128 characters).
- A short-lived encrypted owner grant, tied to the current HF session fingerprint and expiring after 10 minutes.
- A session with write-repos scope.
- Same-origin request checks, JSON content-type and request marker.
- Runtime input validation and an exact parent dataset revision.
- Whole-catalogue validation before the revision-pinned commit.

The correction path preserves manga/chapter/page IDs and the existing public slug. Each approved correction atomically writes an exact pre-change `data/library.json` copy to `control/master-catalogue-backups/<parent-revision>/library.json` alongside the corrected catalogue. The server rejects an existing/unverifiable backup path and verifies the backup bytes after the commit. If post-write verification fails, the change may already be committed: refresh the dataset before retrying. **This same-dataset catalogue backup is not an independent full-original-media backup or a replacement for Controller recovery.** Do not expand editable fields or weaken controls without a reviewed decision and explicit owner approval. Media uploads, permanent deletion and migrations remain with the Storage Controller.

## Personal data

Progress, reader preferences, shelves, annotations, personal tags, favourites, explicit chapter completion, nested collections and usage analytics are local to the browser. Manual JSON backup files can contain private reading history and notes; keep them private. No personal data is uploaded to Hugging Face by this app and automatic cross-device sync is not implemented.

The analytics journal is opt-out, prospective and device-only. It stores approximate focused/non-idle time, not a precise surveillance record. No third-party analytics is used. Clearing analytics does not clear reading progress or private catalogue data.

## Content rights and imports

Use only user-owned, authorised or appropriately licensed media and metadata. Permission to retain a private copy is not a redistribution licence. Keep rights evidence and cover provenance in the private Controller-managed records; do not expose confidential evidence to the public app.

Do not scrape protected websites, bypass paywalls/DRM, follow arbitrary image URLs, proxy user-supplied URLs or put third-party private media in GitHub Actions, public Cloudflare assets, fixtures or screenshots. Archive-index validation is not a full ZIP/CBZ binary scanner or extraction sandbox.

## Browser and application security

- Public headers and CSP are defined in public/_headers. Review them when adding a new external origin, font, image host or script.
- Metadata and personal strings are rendered as text. Never use dangerouslySetInnerHTML for catalogue content.
- Validate IDs, manifests, image types, dimensions, byte sizes, hashes and collection/backup documents at runtime.
- Keep CSRF/Origin checks on mutations, bounded body sizes, request timeouts and error messages that do not leak secrets.
- Private API responses must remain no-store.
- Do not store credentials, owner passphrases or access tokens in localStorage, sessionStorage, URLs, browser bundles, logs, test output or exported backups.

The offline shell currently builds a self-contained fallback from trusted first-party JS/CSS. Re-test the offline fallback if changing CSP or service-worker behaviour.

## Incident and recovery response

If a secret leak, unauthorised access, missing original, corrupted catalogue or data-loss event is suspected:

1. Stop affected writes and deployments.
2. Preserve safe evidence without copying private content into public logs.
3. Revoke or rotate affected credentials/sessions.
4. Check the private dataset revision and Controller backup state.
5. Restore only through the approved Controller recovery process and verified backup.
6. Document the incident and verify the exact recovered revision.

Never "fix" a private data problem by deleting and recreating the dataset, clearing browser storage or bypassing validation.

## Security verification

Public CI uses synthetic fixtures and verifies validation, owner-route behaviour, anonymous API denial, CSRF/Origin checks and regression paths where covered. It cannot prove live owner OAuth, Cloudflare secret values, write-scope availability or an actual private dataset commit. Those require an isolated owner-authenticated acceptance record.

See docs/HF_READONLY_CONNECTION.md, docs/DEPLOYMENT.md, docs/TESTING.md and docs/adr/007-private-manga-media-auth-boundary.md.
