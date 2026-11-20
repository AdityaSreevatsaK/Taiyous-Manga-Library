# Read-only private Hugging Face connection

**Connection and online reading milestone, 20 November 2026.** The backend uses owner-only OAuth to read the private catalogue, chapter manifests and original page images. It never commits, uploads, deletes or modifies Hugging Face data.

## Cloudflare Pages production configuration

Configure the following as **Pages Functions runtime** variables under Production:

| Key | Value | Secret? |
| --- | --- | --- |
| `HF_REPO_ID` | `AdityaSreevatsaK/Taiyous-Manga` | No |
| `HF_OWNER_USERNAME` | `AdityaSreevatsaK` | No |
| `HF_CLIENT_ID` | ID of the dedicated confidential OAuth app | No |
| `HF_CLIENT_SECRET` | Client secret of that OAuth app | Yes |
| `SESSION_SECRET` | Base64 encoding of 32 cryptographically random bytes | Yes |

Do not add `VITE_*` variants, place credentials in GitHub or share them in chat.
OAuth app registration must use **confidential** mode and scopes `openid profile read-repos`.
Its callback must be precisely
`https://taiyous-manga-library.pages.dev/api/auth/callback`.

Production sign-in is deliberately restricted to this one hostname and exact HF owner. No
cross-origin Novel Library cookies or public preview logins are accepted.

## Route contract

- `GET /api/auth/login`: state-bound and PKCE-protected redirect to HF.
- `GET /api/auth/callback`: verify flow/state/PKCE, exchange the code with confidential HTTP
  Basic client authentication, verify owner and that the selected dataset is private.
- `GET /api/auth/session`: authenticated session health, no token returned.
- `POST /api/auth/logout`: same-origin + custom header required; expires both cookies.
- `GET /api/library`: owner-only metadata read, pinned to immutable dataset revision.
- `GET /api/media/manifest?mangaId=&chapterId=`: verify chapter membership and serve a bounded manifest.\n- `GET /api/media/page?mangaId=&chapterId=&pageId=&revision=`: verify owner, immutable revision, chapter membership, MIME signature, exact image size and SHA-256, then return the private image bytes.\n  No write routes exist.

All private API responses have `no-store` headers. HF access token is encrypted into
a Secure, HttpOnly, SameSite=Lax, host-bound AES-GCM session cookie. The token never reaches React.
Sessions expire when the HF token expires; a new sign-in may be required after 8 hours.
The service worker does not intercept or cache `/api/` requests or OAuth redirects.

## Empty dataset behaviour

The intended **future** private catalogue path is `data/library.json`.
When absent, the gateway checks the authenticated dataset's immutable `data/` tree:

- No files under `data/`: return `{connected:true,empty:true,entries:[]}`.
- Any files under `data/` but missing catalogue: return a recovery error (409).
- An existing `data/library.json`: require a strict JSON v1 envelope
  `{ "schemaVersion": 1, "mediaKind": "manga", "entries": [] }`, validated using
  the Manga Library's existing `parseCatalogue` rules.

This is a **read-only compatibility proposal**, not authorisation to upload or a complete
storage contract. The separate Storage Controller has not yet approved its production
dataset layout. Never create an index automatically or infer content from unrelated paths.

## Verification

After GitHub PR CI and deployment:
1. Open the production app in a fresh browser. Expect sample mode and a
   **Sign in with Hugging Face** action.
2. Sign in to the dedicated OAuth application as the exact owner.
3. After callback, the private view should say
   **Your private Hugging Face dataset is connected and empty**.
4. Confirm signed-out /api endpoints refuse data (401); after signing out, repeat.
5. For an unexpected 403, confirm the OAuth scope `read-repos`, repository visibility
   and owner username. For 503, recheck Cloudflare runtime bindings (never expose their values).
6. Do not claim production read access until step 3 is observed live.

## Private manga reader

- The canonical data paths are `data/library.json`, `data/manifests/<chapter-id>.json`
  and `data/manga/<manga-id>/<chapter-id>/<page-id>.<ext>`.
- ReLIFE is currently in the **read-only legacy layout**: root `catalogue.json`,
  `manifests/<chapter-id>.json` and `assets/manga/...`.
- Both layouts are read at a pinned private Hugging Face revision. No migration,
  re-upload or media copying is required just to read existing chapters.
- Only the signed-in dataset owner may retrieve pages. Page images are verified by
  SHA-256 on the server and in the reader, and are held as temporary browser blob URLs
  for at most a few nearby images. The service worker bypasses all `/api/` requests.
- The details page displays the first 25 chapter rows and supports searching and
  incremental expansion, rather than drawing hundreds of chapters at once.
- Private pages require network connectivity. Offline private media downloads and
  cross-device progress synchronisation are not yet implemented.
- Do not claim ReLIFE's original pages were tested live until the signed-in owner
  opens a chapter successfully after deployment.

## Not implemented in this milestone

Offline private media caching, image cover management, cloud progress sync,
browser uploads and dataset mutations. Synthetic chapters retain their separate offline demo.

