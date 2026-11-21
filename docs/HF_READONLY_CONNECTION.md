# Private Hugging Face connection and protected Master corrections

**Private dataset:** AdityaSreevatsaK/Taiyous-Manga  
**Canonical catalogue:** data/library.json  
**Production origin:** https://taiyous-manga-library.pages.dev/

This integration is implemented in the Manga Library. The normal catalogue/media read path is owner-authenticated and read-only. A separate protected Master path can make a narrow set of source metadata corrections; it does not upload, delete or migrate media.

## Authentication and runtime configuration

Cloudflare Pages Functions runtime variables:

| Name | Value / purpose | Secret? |
|---|---|---|
| HF_REPO_ID | AdityaSreevatsaK/Taiyous-Manga | No |
| HF_OWNER_USERNAME | AdityaSreevatsaK | No |
| HF_CLIENT_ID | Dedicated confidential Hugging Face OAuth application ID | No |
| HF_CLIENT_SECRET | Confidential OAuth client secret | Yes |
| SESSION_SECRET | Base64-encoded 32 random bytes | Yes |
| TAIYOU_OWNER_PASSPHRASE | Independent Master source-correction passphrase, 16–128 characters | Yes |

Never put secret values in Git, .env.example, VITE_* variables, browser code, URLs, screenshots or logs.

OAuth callback:
https://taiyous-manga-library.pages.dev/api/auth/callback

The ordinary sign-in flow requests openid, profile and read-repos. The optional write sign-in at /api/auth/login-write requests openid, profile, read-repos and write-repos. The owner and exact dataset are checked server-side. The Novel Library's OAuth cookie is not shared with this origin.

The session token is stored in an encrypted, Secure, HttpOnly, origin-bound cookie. Browser JavaScript receives owner/repository/revision metadata only, never the bearer token.

## Reader API

| Route | Purpose |
|---|---|
| GET /api/auth/login | Start normal read-authorised OAuth with state and PKCE |
| GET /api/auth/login-write | Start optional write-authorised OAuth |
| GET /api/auth/callback | Exchange code and verify exact owner |
| GET /api/auth/session | Return connection status only |
| POST /api/auth/logout | End the same-origin session |
| GET /api/library | Return the complete validated catalogue and immutable HF revision |
| GET /api/media/cover?mangaId=<id> | Deliver one validated original cover |
| GET /api/media/manifest?mangaId=<id>&chapterId=<id> | Deliver one validated chapter manifest |
| GET /api/media/page?mangaId=<id>&chapterId=<id>&pageId=<id>&revision=<sha> | Deliver one validated original page |

The catalogue is a single full snapshot. The browser performs tags, creator, publication, shelf, collection, text search and sort locally. The application refreshes that snapshot while browsing and when returning to the tab. It must not fetch metadata once per manga.

Covers are requested per visible/prioritised manga, lazily and with deduplication. A chapter manifest is requested when that chapter is opened. Page bytes are requested for the selected chapter using bounded concurrency. These are media-asset requests, not catalogue N+1 calls.

Private catalogue, manifest and image responses are no-store. The service worker excludes /api/*.

## Canonical dataset format

Canonical catalogue envelope:

    {
      "schemaVersion": 1,
      "mediaKind": "manga",
      "entries": []
    }

Canonical paths:

- data/library.json
- data/covers/<manga-id>.<original-extension>
- data/manifests/<chapter-id>.json
- data/manga/<manga-id>/<chapter-id>/<page-id>.<original-extension>

Entry fields include immutable id, title, aliases, creators, tags, synopsis, publicationStatus, direction and chapters. Optional Controller metadata includes:

- cover: relative assetPath, mimeType, width, height, byteSize and sha256.
- creatorRoles: author/artist records, retaining creators for older consumers.
- metadataSources: per-field provider, sourceId, HTTPS sourceUrl and UTC retrievedAt.

Rights evidence and cover permission records are maintained in the private Controller-managed control data, not exposed as public reader metadata. See the Controller's current METADATA_RECONCILIATION_CONTRACT.md for the full canonical contract.

The reader retains a read-only legacy catalogue fallback. If the canonical data tree contains files but data/library.json is missing, the endpoint returns a recovery error rather than silently treating the dataset as empty.

## Protected source metadata corrections

The Master Library management view can correct only:
- title
- creators
- publicationStatus

The user must:
1. Sign in as the configured HF owner.
2. Unlock with the independent TAIYOU_OWNER_PASSPHRASE.
3. Have a current HF session with write-repos scope. If normal read scope was used, reconnect through the separate write login.
4. Refresh the catalogue and submit the desired correction.
5. Let the server validate the full patch and exact current dataset revision before commit.

The owner grant is encrypted in a Secure, HttpOnly, SameSite=Strict cookie, tied to the current HF session fingerprint and expires after 10 minutes. Mutations require same-origin headers and JSON content type. The update uses the current HF revision as parent; concurrent changes return a conflict and require refresh/retry. The full catalogue is validated before commit.

When title changes, the server preserves or establishes the public slug so existing readable URLs remain stable. Manga/chapter/page IDs and chapter data are not rewritten. Media upload, original deletion, bulk migration and backups remain Controller operations.

Do not expand editable fields or run a real correction as a smoke test without a disposable dataset or explicit owner approval.

## Cover cache and private offline boundary

Private cover bytes are SHA-verified before being stored in a bounded IndexedDB cache. The cache is local to the browser and cleared on logout. Private chapter pages are not stored as offline chapter downloads. The explicit Offline shelf and synthetic chapter downloader apply to sample/demo chapters only.

## Release acceptance

Automated live smoke verifies:
- anonymous private API requests are denied with no-store JSON;
- OAuth redirects through Hugging Face;
- public assets, SPA routes, service worker and security headers match the deployed master build.

It does not authenticate as the owner. Manual owner acceptance must separately verify:
- sign-in and sign-out;
- known private cover display;
- chapter manifest and first page display;
- chapter navigation and progress restore;
- no token or private HF URL in browser requests;
- cover cache cleared after logout;
- protected source correction with write scope and revision guard, using a disposable/approved record.

Record the tested commit SHA and actual result. Do not mark owner acceptance complete based only on UI presence or anonymous CI.
