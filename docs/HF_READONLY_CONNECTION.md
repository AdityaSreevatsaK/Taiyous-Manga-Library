# Read-only private Hugging Face connection

**Connection milestone, 20 November 2026.** The backend is limited to OAuth sign-in and
reading a private catalogue. It never commits, uploads, deletes or modifies Hugging Face data.

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
  No write routes exist.

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

## Not implemented in this milestone

Private chapter manifest/image download, offline private media caching, approved rights/provenance
ingestion, cloud progress sync, Owner mode and HF dataset mutations. The synthetic reader stays
available as a clearly labelled example. Real manga in a new catalogue would show metadata,
but reading buttons must not imply its pages are available until manifest/media gateway exists.
