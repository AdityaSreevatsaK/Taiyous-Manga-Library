# Manga Library and Storage Controller metadata contract

**Status:** The Controller contract is implemented and consumed by the Manga Library. This file records the integration boundary; it is no longer an unapproved proposal.

**Reader repository:** AdityaSreevatsaK/Taiyous-Manga-Library  
**Controller repository:** AdityaSreevatsaK/Taiyou-Manga-Storage-Controller  
**Private dataset:** AdityaSreevatsaK/Taiyous-Manga

## Canonical catalogue

The private catalogue is data/library.json with schemaVersion 1, mediaKind manga and entries. Existing manga/chapter/page IDs remain immutable.

The Controller-managed entry fields consumed by this app include:
- cover: assetPath, mimeType, width, height, byteSize and sha256.
- creatorRoles: name and role (author or artist), while creators remains for compatibility.
- metadataSources: field-level provider, sourceId, sourceUrl and retrievedAt.

Cover assetPath is relative to data/ and must belong to the same immutable manga ID under covers/. The original file format is retained. The reader checks descriptor shape, MIME/extension, dimensions, size and SHA-256 before rendering/caching bytes.

Canonical paths:
- data/library.json
- data/covers/<manga-id>.<ext>
- data/manifests/<chapter-id>.json
- data/manga/<manga-id>/<chapter-id>/<page-id>.<ext>

Rights and permission evidence is retained in private Controller-managed control records, not sent to the browser as public source metadata.

## Reader behaviour

- GET /api/library reads the complete catalogue at a pinned private dataset revision.
- Browser search, tags, creator, publication, shelf and collection filters are local.
- Covers load individually when visible and use a verified bounded browser cache.
- Chapter manifests and page bytes load only for the chapter being read.
- The authenticated media gateway validates owner, immutable identity, revision, path, MIME, byte size and digest.
- Legacy catalogue fallback is read-only. If canonical data exists but the catalogue index is missing, the app returns a recovery error rather than pretending the library is empty.

## Ownership

The Controller owns original media ingestion, archive/image validation, upload, private backup, metadata reconciliation, migration and media deletion.

The Reader owns display, local personal progress/annotations/collections, authenticated cover/page delivery and a narrow protected Master correction path for title, creators and publicationStatus. Reader-side metadata correction does not upload or delete media.

## Compatibility and safety

- Do not change IDs or rewrite chapter/page manifests for a metadata-only correction.
- Preserve existing non-empty manual metadata and provenance unless a separately approved reconciliation explicitly changes it.
- Use the Controller's current canonical contract, not old branch PR drafts.
- Inspect Controller changes read-only when updating this repository's contract; do not modify the Controller or private HF dataset as part of a Reader task.
- Keep rights evidence private. A stored cover is not a public redistribution licence.

See the Controller's current docs/METADATA_RECONCILIATION_CONTRACT.md and this repository's docs/DATA_CONTRACTS.md.
