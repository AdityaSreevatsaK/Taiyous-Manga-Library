# Architecture Decision Records

## ADR-001: Independent media repositories
**Status: accepted for scaffolding.** Five repos: Shared Core/hub, existing Novels, Manga, Anime and Movies & TV. Each app owns its data and deployments. The shared hub only provides navigation. This avoids an early shared-backend single point of failure.

## ADR-002: No copied novel storage/auth implementation
**Status: accepted.** The live EPUB app is not a universal media backend. Its private HF data schema and same-origin OAuth session are novel-specific. Evaluate storage options separately and record owner approval.

## ADR-003: Domain-specific progress
**Status: accepted for design, implementation pending.** Chapter ID plus zero-based page index, distinct from scroll position. Missing/reordered pages must not silently advance progress. Cross-media common contracts must not erase these semantics.

## ADR-004: Shared Core adoption is opt-in and versioned
**Status: accepted.** Shared code starts experimental and private; do not install mutable local imports from other repositories or deploy runtime Shared Core dependencies.

## ADR-005: Never fake shipped functionality
**Status: accepted.** Unconfigured storage and playback are visibly labelled planned; no fake demo results in production; CI runs without secrets and no automatic release.

## Open decisions
- D-01: approved private storage provider, data sizes and cost/retention.
- D-02: per-app auth now versus explicitly designed central SSO later.
- D-03: data schema version, backup/restore and offline cache policy.
- D-04: provider metadata rights, rate limits, attribution and artwork handling.
- D-05: when to consume a pinned Shared Core release.
- D-06: first controlled staging/deployment domain and rollback.

### ADR template
Create `docs/adr/NNN-title.md` with: Status; Date; Problem; Options and cost; Decision; Rationale; Data/security impact; Compatibility/migration; Rollback; Tests; Owner approval. Never silently re-decide an accepted ADR.
