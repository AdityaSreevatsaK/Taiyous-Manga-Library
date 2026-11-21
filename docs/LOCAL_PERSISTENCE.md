# Browser-local progress and personal-data persistence

Personal data remains on the current browser/device. It is not automatically uploaded to Hugging Face or synchronised across devices. Browser storage may be cleared or evicted; keep private manual backups.

## Reader progress and preferences

- Progress key: taiyou-manga:progress:v1:<mangaId>.
- Each record is a version-1 manga envelope containing mangaId, chapterId, zero-based pageIndex, immutable pageId, updatedAt and optional readingMode/verticalOffsetRatio.
- Reader preferences use taiyou-manga:reader-preferences and include theme, image fit and optional reading direction.
- New profiles default to Sepia. Legacy Dark/Light preferences migrate to Charcoal/Paper.
- Every read/write validates the stored envelope and manga/chapter/page lineage.
- A page index without the matching immutable page ID is not safe to restore.
- Progress writes reject stale timestamps. Invalid existing records are preserved and surfaced for recovery rather than silently overwritten.
- Per-manga keys isolate corruption; one malformed record must not erase another manga's progress.
- Vertical offset is an approximate fraction within a tall page, not a promise of pixel-perfect restoration after source dimensions change.

## Personal shelves and annotations

Separate versioned local keys store:
- Personal shelf: Trying Out, Finished or legacy To Be Read.
- Personal annotation: 1–10 rating, notes, personal tags, favourite flag, explicit completed chapter IDs and updated timestamp.
- Imported publication status/genres are separate from personal shelf/tags.
- Currently Reading is derived from actual saved progress and shelf overrides.
- Chapter completion and Finished status are explicit actions; neither is inferred from scroll position or publication status.

## Nested collections

A single revisioned document stores stable collection IDs, names, parent IDs and manga membership. Runtime validation rejects duplicate IDs, missing parents, cycles, duplicate sibling names and duplicate memberships. Stale revision writes fail. Deleting a collection subtree does not delete manga, media, progress, notes or offline chapters.

## Manual JSON backup and transfer

The full personal backup uses schemaVersion 2 and includes progress, preferences, shelves, annotations and optional nested collections. It excludes manga images, private catalogue metadata, OAuth/session data and private media.

- Export from the app's backup control.
- Keep the downloaded file private; it may contain personal notes and reading history.
- On another device, select the backup, review validation and explicitly confirm import.
- The importer accepts legacy v1 reader backups and older v2 backups without collections.
- Import is a guarded merge, not a replace-all operation. Newer local records, invalid records and existing collections are preserved according to the current import rules.
- Import size is bounded and all content is validated before writing.

This is manual transfer, not automatic cross-device sync or a cloud backup.

## Cover cache

Verified private cover blobs may be stored in IndexedDB under taiyou-manga-private-covers-v1. Entries are content-addressed by manga ID and cover SHA-256. The cache is bounded to 120 covers / 72 MiB; a smaller session hot cache avoids repeat reads. Actual cover bytes are SHA-verified before persistence. Sign-out clears this private artwork cache.

This cover optimisation does not cache private chapter pages or provide private offline reading.

## Failure and recovery rules

- Browser storage can be unavailable or quota-limited. Surface a truthful warning and do not pretend the write succeeded.
- Do not silently clear invalid local records.
- Do not treat a browser storage event as transactional cross-device sync.
- Do not clear local progress or personal records during an app rollback.
- Keep manual backup files private and separate from public repository folders.

See docs/PERSONAL_METADATA.md, docs/COLLECTIONS.md, docs/DATA_CONTRACTS.md and docs/ADVANCED_DISCOVERY_AND_ANALYTICS.md.
