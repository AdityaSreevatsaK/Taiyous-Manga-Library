# Manga Data Contracts, Identity and Migration

**Current type definitions:** `src/domain/types.ts`. They are intentionally local and preliminary. No persisted schema or migration has been deployed.

## Core entities
MangaEntry, MangaChapter, MangaProgress
Panel and page ordering, right-to-left versus left-to-right reading, vertical scrolling, chapter/volume structure, image dimensions, page preload limits and full-screen touch navigation.

## Stable identity
Use immutable opaque IDs scoped to this media kind; never use mutable titles, list positions or episode labels as keys. Keep external provider IDs in optional source/provenance records rather than replacing local IDs. Preserve aliases, rename history and canonical IDs when imports change.

## Ownership of fields
- **Public descriptive metadata:** title, alternative names, genres, release information and licensed artwork references; verify provenance and terms.
- **Private personal data:** ratings (integer 1–10; absent means unrated), annotations, tags, watch/read state, custom collections and updated timestamps. This must never be published to static bundles.
- **Protected asset references:** images or files, manifests, checksums, rights/provenance; do not use arbitrary remote URLs as trusted assets.
- **Sync metadata:** opaque revision, updatedAt, tombstones, origin/device identifier if required and conflict records, separate from display data.

## Versioning and validation
Future persisted documents must declare `schemaVersion`, `mediaKind`, revision and validated arrays/objects. Validate at the untrusted boundary (runtime, not only TypeScript), limit lengths/counts and reject duplicate IDs. Keep backward-compatible migrations version-to-version with reversible backups. Unsupported future schema versions must fail closed, never silently truncate. Do not add database or sync until an ADR chooses a store.

## Progress and edge cases
Chapter ID plus zero-based page index, distinct from scroll position. Missing/reordered pages must not silently advance progress.
Maintain atomic record-level updates when multiple devices edit; compare remote version before write. Support 'unrated', unknown episode count, missing chapters, deleted records, stale local caches, out-of-order updates and offline divergence. Do not infer an irreversible completion event from a title match.

## Storage contract
Private original files and verified image manifests, with browser IndexedDB cache only after consent. No external source URLs should be saved as durable private media pointers.
Shared Core's `MediaIdentity` is a potential exchange boundary, not a replacement for this repository's current types. Do not import the Novel Library's 24-character EPUB hashes into manga as a universal ID format.

## Privacy and deletion
Distinguish reversible removal from a shelf, clearing an offline cache, soft-deleting personal metadata and permanent deletion of originals. Permanent deletion requires explicit owner action, confirmation of affected objects, backups and a tested recovery path. Never cascade across other media repos.

## Next schema work
Write `docs/DECISIONS.md` ADR for source/provider mapping; add runtime parsers and fixtures with valid, invalid and legacy versions; write migration tests; then implement an adapter behind a typed interface. Until then, the current catalogue is empty by design.
