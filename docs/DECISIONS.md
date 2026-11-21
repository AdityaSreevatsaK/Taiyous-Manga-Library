# Architecture decisions

This log records durable choices. The current implementation is described in docs/ARCHITECTURE.md and docs/PROJECT_STATUS.md. A decision's original date does not freeze the code; verify its current implementation.

## ADR-001: Independent media repositories

**Status:** Accepted and implemented.

Each media application owns its domain, deployment and data boundary. The parent Hub is navigation, not a runtime backend. The Manga app must work if Shared Core or the Hub is offline.

## ADR-002: No copied Novel Library storage/auth implementation

**Status:** Accepted and implemented.

Novel Library is a visual and interaction reference. Its Hugging Face schema, OAuth cookie, EPUB reader and browser data are not Manga dependencies. Manga uses its own owner OAuth client, dataset contract and continuous image reader.

## ADR-003: Manga-specific immutable progress identity

**Status:** Accepted and implemented.

Progress uses manga ID, chapter ID, zero-based page index and immutable page ID. A reordered or missing page fails closed instead of silently restoring the wrong image. Human-facing route page numbers are one-based.

## ADR-004: Shared Core adoption is opt-in and versioned

**Status:** Accepted; no runtime adoption.

Shared Core contracts/components remain experimental. Do not add mutable sibling-repository imports, submodules, floating Git URLs or runtime CDN imports. Extract only after a real second consumer demonstrates measurable reuse and compatibility.

## ADR-005: Never fake shipped functionality

**Status:** Accepted and implemented.

The public catalogue fixtures are explicitly synthetic. Private connection status reflects real owner authentication. Planned features must not be represented as working controls. Tests and release reports distinguish implemented, partial, planned, deprecated and unverified states.

## ADR-006: Rights, manifests and private media adapter

**Original status:** Proposed on 18 November 2026.  
**Current status:** Superseded as an implementation proposal by ADR-007 and the live Cloudflare/HF gateway.

The original ADR remains useful for rights, image validation, path safety and backup principles. It is not the current implementation description. The deployed gateway and canonical dataset contract are documented in docs/ARCHITECTURE.md, docs/HF_READONLY_CONNECTION.md and ADR-007.

## ADR-007: Per-app private Manga gateway and owner metadata boundary

**Status:** Accepted and implemented, with owner-authenticated production acceptance tracked separately.

The app uses same-origin Cloudflare Pages Functions, its own confidential Hugging Face OAuth client, an encrypted HttpOnly session and server-side owner checks. Catalogue, cover, manifest and page reads are authorised and revision/integrity validated. Private API responses are no-store and never enter the service-worker cache.

The catalogue is read in one full snapshot. Ordinary filtering remains in memory. Cover/page requests are per actual media asset, not per-title catalogue metadata.

A separate short-lived owner grant protects narrow source metadata corrections. It requires the independent Cloudflare Production passphrase and a Hugging Face write-repos session. The current editable source fields are title, creators and publicationStatus. Mutations are same-origin, server validated, parent-revision guarded and preserve immutable IDs. The app does not upload or permanently delete media.

See docs/DEPLOYMENT.md and docs/HF_READONLY_CONNECTION.md for runtime configuration. Do not infer that a configured-looking UI proves production secrets or OAuth scopes are set.

## ADR-008: Personal records and usage analytics remain device-local

**Status:** Accepted and implemented for the current release.

Progress, preferences, shelves, ratings, notes, personal tags, favourites, explicit chapter completion, nested collections and usage analytics stay in browser storage. A validated manual JSON backup is the supported transfer path. There is no automatic cross-device sync.

Usage time is prospective, approximate and device-only. Tracking is opt-out, has bounded retention, export and typed-confirmation clearing. Historical time is never inferred from old progress timestamps.

## ADR-009: Cloudflare Pages is the production host

**Status:** Accepted and implemented.

Cloudflare Pages serves the application and same-origin Pages Functions. master is the production source branch. GitHub Pages is not the production host. Every merge must be followed by the live Cloudflare smoke for the exact merged SHA. The live smoke verifies deployment assets and anonymous security boundaries; it does not impersonate the owner.

## Resolved decisions

| Question | Decision |
|---|---|
| Private catalogue/media provider | Private Hugging Face dataset, accessed through the Manga app's server-side Cloudflare Functions |
| OAuth | Independent per-app Hugging Face OAuth; no implicit cross-origin Novel SSO |
| Canonical catalogue | Version-1 data/library.json envelope, compatible with the Storage Controller |
| Media ingestion and deletion | Separate Manga Storage Controller |
| Personal data storage | Browser-local versioned records plus manual JSON backup; automatic sync not implemented |
| Private chapter offline policy | Not implemented; synthetic demo downloads only |
| Shared Core | No runtime package adoption |
| Production hosting | Cloudflare Pages |

## Open decisions

- Whether private chapter offline access is wanted, and its device-accessibility, quota, cache and logout policy.
- Whether automatic cross-device personal-data sync is wanted, and its conflict, identity, backup and privacy design.
- Whether any new publication metadata fields should be editable in Master Controls.
- Whether a pinned Shared Core package provides enough measured value to justify adoption.
- Whether to add protected production deployment gating beyond the current merge/CI/Cloudflare workflow; branch-protection settings were not readable during the 21 November audit.

## ADR template

New decisions belong in docs/adr/NNN-title.md and should record: status, date, problem, options, decision, rationale, security/data impact, compatibility/migration, rollback, tests and required owner approval.
