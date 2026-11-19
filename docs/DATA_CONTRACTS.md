# Manga Library data contracts: current status, 19 November 2026

**Core:** immutable IDs `mng_*`, `ch_*`, `pg_*` backed by runtime validation in `src/domain/validation.ts`. Page identity is the immutable ID plus a zero-based chapter page index. Manifest order changes do not silently advance saved progress. Only raster `image/jpeg`, `image/png`, `image/webp` and `image/avif` private asset path shapes pass validation.

**Local versioned records:**
- `taiyou-manga:progress:v1:<mangaId>`: validated current chapter, page and approximate vertical offset, timestamp.
- Reader preferences: persisted six-theme UI state, page fit and reading direction; old Dark/Light values migrate to Charcoal/Paper.
- `taiyou-manga:personal-shelf:v1:<mangaId>`: Trying Out, Finished, To Be Read; Currently Reading is derived from real saved progress.
- `taiyou-manga:personal-annotation:v1:<mangaId>`: integer personal rating 1–10, bounded notes and case-insensitive Title Case personal tags, distinct from imported genres.
- `taiyou-manga:personal-collections:v1`: revisioned nested collection tree with cycle prevention, unique sibling names and stable collection membership IDs.

**Backup:** `taiyou-manga-local-personal-backup` schemaVersion 2, exported progress/preferences/shelves/annotations and optional validated nested collection tree. Importer understands old v1 reader backups and older v2 backups lacking collections. Nonempty local shelves, newer local notes and existing collections are never overwritten without a new explicit conflict policy; invalid local bytes are preserved.

**Privacy:** Public catalogue samples and imported publication status are separate from personal notes/status. Storage currently stays on this browser, and manual JSON files must be handled privately. No server persistence, Hugging Face private resolver, automatic multi-device conflict resolution or authenticated owner deletion exists.

## Historical scaffold data-contract notes, retained

The original statements below about having no persisted schemas, no lockfile or no deployed reader are historical and **superseded** by the implementation above.

---

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


## Feature-branch runtime parser checkpoint (18 November 2026)

`src/domain/validation.ts` now accepts `unknown` at input boundaries and validates opaque IDs, series and chapter arrays, duplicate IDs/order keys, zero-based progress with manifest bounds, versioned chapter image records, strict relative asset paths, allowed raster MIME types, dimensions, archive-entry metadata and source-rights evidence. `src/domain/reader.ts` preserves exact chapter/page progress and refuses to silently skip missing manifests. Tests exist on draft PR #2, but local npm/CI execution has not succeeded.

This **does not** provide a deployed persisted schema, image bytes inspection, actual ZIP extraction, cloud auth, database migration, persistence or sync. The rights and private adapter proposal is documented in `docs/adr/006-manga-rights-and-private-asset-adapter.md`; it is not approved for real data.

## Immutable page identity (feature branch, 18 November 2026)

The local prototype's `MangaProgress` now requires both `chapterId`, a **zero-based** `pageIndex` and immutable `pageId`. Runtime parsing and resume reject a record if `pageId` no longer matches the page at `pageIndex` in the validated chapter manifest. This is intentional fail-closed behaviour rather than quietly restoring to the wrong image after page reordering. Since there is no deployed progress persistence, this adds no data migration. Any future legacy migration must explicitly reconcile missing IDs before enabling resumption.
