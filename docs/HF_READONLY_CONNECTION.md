# Owner-authenticated private Hugging Face manga connection

**Current as of 20 November 2026.** Cloudflare Pages Functions provide read-only access to the private HF catalogue, original covers, chapter manifests and pages. Data uploads, deletion, migration and backups are separate Storage Controller responsibilities. No private manga is committed to GitHub or embedded in the public app bundle.

## Production configuration

Set these as Cloudflare **Pages Functions runtime** variables for Production, not `VITE_*` values:

| Key | Value | Secret? |
| --- | --- | --- |
| `HF_REPO_ID` | `AdityaSreevatsaK/Taiyous-Manga` | No |
| `HF_OWNER_USERNAME` | `AdityaSreevatsaK` | No |
| `HF_CLIENT_ID` | Dedicated confidential HF OAuth application ID | No |
| `HF_CLIENT_SECRET` | OAuth client secret | Yes |
| `SESSION_SECRET` | Base64-encoded 32 cryptographically random bytes | Yes |

The confidential OAuth application must use `openid profile read-repos` and the exact callback
`https://taiyous-manga-library.pages.dev/api/auth/callback`. A Novel Library OAuth cookie does not authorise the Manga Library.

## API routes

- `GET /api/auth/login`: CSRF-state and PKCE-protected sign-in.
- `GET /api/auth/callback`: confidential OAuth exchange, exact owner identity and private dataset verification.
- `GET /api/auth/session`: session-health diagnostic, no token returned.
- `POST /api/auth/logout`: same-origin, authorised cookie expiration.
- `GET /api/library`: owner-attested canonical catalogue, pinned to the immutable private dataset revision.
- `GET /api/media/cover?mangaId=<id>`: securely retrieve a canonical cover, checking the owner, revision, declared image MIME, size and SHA-256.
- `GET /api/media/manifest?mangaId=<id>&chapterId=<id>`: validate chapter membership and return a bounded manifest.
- `GET /api/media/page?mangaId=<id>&chapterId=<id>&pageId=<id>&revision=<sha>`: return exact verified original page bytes after owner, revision, membership, MIME, length and checksum checks.

Private media and catalogue responses are `no-store` and are never cached by the service worker. The HF token is only held in the server-managed Secure, HttpOnly, SameSite=Lax, host-bound encrypted session cookie. The browser cannot request arbitrary private media paths or URLs.

## Canonical dataset format

Private Hugging Face data use `data/library.json` with:

```json
{"schemaVersion":1,"mediaKind":"manga","entries":[]}
```

The manga entries use immutable IDs and may include optional `cover`, `creatorRoles` and `metadataSources` fields, following the [Storage Controller reconciliation contract](https://github.com/AdityaSreevatsaK/Taiyou-Manga-Storage-Controller/blob/master/docs/METADATA_RECONCILIATION_CONTRACT.md). Cover paths are private `data/covers/<manga-id>.<ext>` files, chapter paths use `data/manga/<manga-id>/<chapter-id>/<page-id>.<ext>` and manifests use `data/manifests/<chapter-id>.json`.

The reader preserves a safe read-only legacy fallback. If `data/` has any files but the canonical library index is missing, the endpoint returns a recovery error instead of inventing an empty catalogue. The Library never modifies private HF content.

Following the Controller's read-only live integrity smoke on 20 November, the private dataset was independently confirmed to contain **five manga, five original covers with metadata, 587 chapters and 14,635 pages**. This is evidence of dataset completeness, not a signed-in browser rendering result.

## Release verification

1. Run the Library's green PR and master checks, then the [live Cloudflare smoke](../.github/workflows/live-cloudflare-smoke.yml). Verify unauthenticated private API responses refuse access.
2. As the dataset owner, sign in with the dedicated Hugging Face OAuth application.
3. Open a known private manga. Verify its original cover, author/artist/synopsis, chapter selection and first page. Check actual chapter navigation, no broken images, and saved local progress after reload.
4. Confirm the browser network panel contains only first-party `/api/media/*` URLs for private images, with no HF bearer token, secret or unrestricted provider URL.
5. Sign out and confirm catalogue, covers, manifests and pages are no longer accessible.

The automated live smoke does **not** impersonate the owner. Do not call this manual authenticated check complete until it has genuinely been performed.

## Remaining limitations

Private originals require a network connection. Private-media offline downloads and automatic cloud synchronisation of personal progress, ratings, notes and collections are not implemented. The synthetic sample reader retains a separate offline demonstration flow.
