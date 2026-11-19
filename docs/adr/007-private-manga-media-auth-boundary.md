# ADR 007: Per-app private manga gateway and rights boundary

**Status:** Security-design checkpoint, unapproved for real data. 19 November 2026.

## Decision

Keep the existing public static manga demonstration entirely disconnected from private storage. A future private adapter will use a **same-origin Cloudflare Pages Function** gateway and server-held authorisation, never browser-accessible Hugging Face dataset tokens, direct private provider URLs, or Novel Library cookies.

The typed `AuthorisedPrivateMediaPort` contract defines only the browser-facing application boundary. The currently installed `UnconnectedPrivateMedia` implementation returns `not-connected` for **all** calls and makes no external requests. Pure runtime validators verify catalogue identities, relative paths, page order, MIME expectations and rights evidence. **They do not authorise a request.**

## Preconditions before enabling real content

1. **Rights and source provenance:** catalogue-level `SourceRights` and individual acquisition rights/attribution must be recorded and reviewed. Use only user-owned, permitted or properly licensed manga; never redistribute or bypass site access controls.
2. **Independent authentication:** explicit Hugging Face OAuth integration for this origin, state/PKCE and callback allowlists, CSRF validation, short-lived server-side session, Secure HttpOnly cookie, SameSite appropriate for OAuth callback, logout/revocation and expiry. Do not assume the Novel Library's login, client Owner mode or shared cookie authenticates the Manga Library.
3. **Server-side authorisation:** every catalogue, manifest and page read verifies session and object access. Owner-only mutations are independently rechecked server-side. Separate non-owner offline deletion in the browser.
4. **Private storage:** server-secret private dataset credentials; no tokens in Vite `VITE_*`, GitHub, Cloudflare public files, downloaded JSON, URLs, HTML, localStorage, CI logs or telemetry. No browser-to-Hugging-Face private media fetch.
5. **Gateway routes and validations:** fixed same-origin route forms with immutable IDs, strict asset path and MIME allowlists, request timeouts, size/pixel limits, no arbitrary URLs or remote redirects, SSRF prevention, rate/concurrency limits, and bounded response streaming.
6. **Private caching:** `Cache-Control: no-store` on private catalogue/manifest reads unless an explicit secure caching design is approved. Opt-in downloaded media is device-accessible, potentially evictable, and must not be presented as encrypted. Never silently remove downloaded chapters on logout or revisions.
7. **Mutations and sync:** preconditioned `If-Match`/revision writes, reconciliation and tombstones, immutable preflight backups, CSRF/Origin checks, idempotency and safe failure/rollback. Cross-device progress only after two-device conflict tests.
8. **CSP and offline:** current offline synthetic fallback inlines trusted compiled JS/CSS; strict CSP would block it. Rework/test the fallback or use a verified nonce/hash before tightening headers.
9. **Testing:** disposable authorised fixtures for allow/deny/expired sessions, revoked user, forged IDs, traversal, MIME mismatch, oversized page, provider timeout, concurrent writes, quota expiry and rollback. Real protected originals must never enter public CI.

## Rejected shortcuts

- Relying on client-side owner flags or public branch visibility for access control.
- Sending HF access tokens or signed private object URLs to the static browser.
- Reusing Novel Library storage/session implicitly.
- Proxying user-provided external image URLs without SSRF controls.
- Enabling private media by merely changing a mock adapter's `not-connected` status.

## Release gate

Explicit owner-approved server-side credentials/auth configuration and a disposable private dataset are needed before implementation. Until then, maintain the synthetic public demo, versioned local progress and manual encrypted-by-user-discretion backup files only.
