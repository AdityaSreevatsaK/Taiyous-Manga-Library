# Integration with Taiyou's Shared Core and Other Libraries

## Contract: independence first
Every app must start, browse locally and display a meaningful empty/error state without Shared Core online. A parent hub navigation link is not an internal service dependency. The parent hub initially lives in `Taiyous-Shared-Core/apps/hub`. Taiyous-Manga-Library remains a distinct deployment with its own permissions and data model.

## Current (implemented) integration
**None.** This scaffold imports no packages from Shared Core, contacts no Novel Library endpoints, and assumes no shared auth. Its optional `VITE_HUB_URL` is reserved for a later approved public navigation URL. No fake link should be rendered until configured and verified.

## Planned integration points
1. `@taiyou/contracts`: experimental namespaced media identity and personal rating semantics. Requires version stability, compile-time type checks AND runtime schema validation before use.
2. `@taiyou/ui`: stateless presentation primitives, explicit accessibility and theming contracts. Avoid importing shared business actions or storage code.
3. Hub link: a public HTTPS route to this application. Never embed private information in URL query parameters.
4. Optional opt-in cross-media search: future server-side aggregator designed for authorisation, not browser reads against the other private datasets.
5. Optional cross-media collections: separate opt-in feature requiring `{kind, namespace, localId}` references and conflict migration. Existing novel collections must not be rewritten.

## Versioning strategy
Keep package exports small. A shared contract change must be backwards-compatible, unit-tested and reviewed by each consuming app. Start with private npm workspace packages in Shared Core; do not publish a registry package or copy dist artifacts into other repos without owner's approval. When adoption is real, choose a pinned semver release and automated change propagation with rollback. Avoid Git submodules, floating Git URLs, runtime CDN imports and import cycles.

## Authentication and URLs
Cloudflare Pages apps on different origins cannot share same-origin HttpOnly cookies by magic. There is currently **no shared account/identity service**. Design explicit per-app login or deliberate future central identity via an ADR with OAuth redirect origins, scopes, CSRF, logout and session revocation. No prototype that writes auth tokens to localStorage.

## Metadata and file ownership
Private original files and verified image manifests, with browser IndexedDB cache only after consent. No external source URLs should be saved as durable private media pointers.
A shared hub must never proxy protected media without appropriate server-side permission controls. No unlicensed manga downloads, paywall bypass, scraping of protected sites, reader requests to arbitrary URLs, or remote image proxying without SSRF protection.

## Compatibility checklist
Before adopting a Shared Core version: run app tests offline and online, verify exports and CSS isolation, confirm keyboard/mobile accessibility, inspect transitive dependencies and bundle size, verify the hub can be offline, and stage a rollback. Update this file with exact versions and links.
