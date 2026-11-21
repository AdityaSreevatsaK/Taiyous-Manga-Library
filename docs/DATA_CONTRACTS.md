# Manga Library data contracts

**Current implementation:** src/domain/types.ts and src/domain/validation.ts.  
**Private dataset:** AdityaSreevatsaK/Taiyous-Manga, canonical data/library.json.  
**Reader ownership:** this repository reads private catalogue/media and makes narrow protected metadata corrections; the Storage Controller owns media ingestion, backup, migration and deletion.

## 1. Catalogue envelope and MangaEntry

Canonical catalogue envelope:

- schemaVersion: 1
- mediaKind: manga
- entries: array of MangaEntry

A MangaEntry contains:

| Field | Meaning |
|---|---|
| kind | Literal manga |
| id | Immutable opaque mng_ identifier |
| title | Source title, mutable display field |
| slug | Optional stable public URL slug; ID remains the identity |
| aliases | Alternative publication titles |
| creators | Backwards-compatible creator names |
| creatorRoles | Optional author/artist role records |
| metadataSources | Optional per-field provenance for imported publication metadata |
| tags | Imported/publication genres and tags |
| publicationStatus | unknown, ongoing, completed, hiatus or dropped |
| direction | rtl, ltr or vertical |
| chapters | Ordered MangaChapter records |
| synopsis | Source synopsis; a personal local override is separate |
| cover | Optional verified cover descriptor |
| rating / collections | Synthetic fixture-only rating and optional fixture collection labels; never use these fields for private personal annotations |

MangaChapter has immutable ch_ ID, display label, unique sequence, and optional stable slug, volume and informational pageCount. Titles, labels, slugs and chapter numbers are not primary keys.

### Cover descriptor

The exact cover object fields are assetPath, mimeType, width, height, byteSize and sha256. The path must belong to the same manga ID under covers/ and retain the original image extension. Supported image MIME types are JPEG, PNG, WebP and AVIF. Runtime validation checks path ownership, extension/MIME agreement, positive bounded dimensions, pixel budget, byte size and lowercase SHA-256 format. The gateway verifies actual bytes against the descriptor.

### Creator and provenance metadata

creatorRoles entries contain name and role (author or artist). The legacy creators array remains for older consumers. metadataSources is keyed by the publication field it describes and records provider, sourceId, uncredentialled HTTPS sourceUrl and UTC retrievedAt. Provenance URLs are metadata references, not media URLs and must never be used as image sources.

Publication genres/status are independent from personal tags and the Finished reading shelf. A publication status of completed never marks the user's personal shelf as Finished.

## 2. Chapters, manifests and pages

A chapter manifest is a version-1 manga document with chapterId and an ordered pages array. Each page has an immutable pg_ ID, relative assetPath, MIME type, dimensions, byte size and optional SHA-256 in the domain type. The canonical private Controller layout provides original page bytes under data/manga/<manga-id>/<chapter-id>/<page-id>.<ext> and manifests under data/manifests/<chapter-id>.json.

Supported image MIME types are image/jpeg, image/png, image/webp and image/avif. Arbitrary absolute URLs, foreign origins, traversal paths, mismatched IDs, unsupported types, duplicate page IDs, excessive page counts and unsafe dimensions must fail validation. The reader never treats an untrusted assetPath as a browser URL.

The browser validates the exact manga → chapter → page lineage against the authenticated catalogue and chapter manifest. For canonical imports it sends the immutable catalogue revision and validated page descriptor. The server checks the owner session, revision/descriptor format, ID-derived path, MIME, byte length and SHA-256 of the bytes. It does not re-read the moving main revision or catalogue/manifest for every canonical page request; the supplied revision is immutable. Legacy requests without a pinned descriptor re-resolve catalogue and manifest membership server-side.

## 3. Progress identity and semantics

MangaProgress contains:

- mangaId: immutable manga identity
- chapterId: immutable chapter identity
- pageIndex: zero-based index in the validated chapter manifest
- pageId: immutable page identity at that index
- updatedAt: UTC timestamp
- optional readingMode
- optional verticalOffsetRatio from 0 to 1 for approximate tall-page anchor restoration

A saved page index without a matching immutable pageId is insufficient. If a manifest is reordered or no longer matches, fail closed and preserve the record rather than silently restoring to a different image. Human-facing route page numbers are one-based; internal progress is zero-based.

Reading progress is not proof that a chapter was completed. Chapter completion is a separate explicit per-chapter marker. Personal Finished status is a separate explicit shelf selection. Publication completion is a separate source field.

## 4. Browser-local personal schemas

| Record | Key / scope | Data |
|---|---|---|
| Reader progress | taiyou-manga:progress:v1:<mangaId> | Validated MangaProgress envelope |
| Reader preferences | taiyou-manga:reader-preferences | Theme, fit and optional reading direction |
| Personal shelf | taiyou-manga:personal-shelf:v1:<mangaId> | trying, finished or to-read |
| Personal annotation | taiyou-manga:personal-annotation:v1:<mangaId> | 1–10 rating, notes, personal tags, favourite, explicit completed chapter IDs and timestamp |
| Collections | taiyou-manga:personal-collections:v1 | Versioned tree, stable IDs, parent links, manga membership and revision |
| Usage journal | taiyou-manga:usage:v1 | Device-only app/reading/offline durations, per-manga totals and bounded action history |

Currently Reading is derived from a real saved progress record and personal shelf overrides. Available Offline is derived from verified local sample chapter receipts. Imported publication status is not used to infer personal completion.

Personal notes are bounded to 5,000 characters. Personal tags are limited to 24 unique values, up to 48 characters each. Collections validate unique IDs, parent existence, sibling names, membership, revision and cycle prevention. Invalid stored records are preserved as recovery evidence.

## 5. Manual backup contract

The full personal JSON backup uses schemaVersion 2 and includes validated progress, preferences, shelves, annotations and optional nested collections. It does not include manga covers, page bytes, private HF metadata, credentials, sessions or private dataset content.

The importer supports legacy v1 reader backups and earlier v2 documents without collections. It validates before writing, merges non-destructively and preserves newer or invalid local records. Users must keep downloaded backup files private. This is not cloud sync or a replacement for an independent media backup.

## 6. Reading usage journal

The usage journal is stored locally under taiyou-manga:usage:v1. It is prospective; it does not reconstruct time from old progress timestamps.

- Time sampling occurs every 10 seconds while the tab is visible, focused and recently active.
- A sample is discarded when the elapsed gap exceeds 30 seconds or the user has been idle for more than 3 minutes.
- Each stored sample is capped at 30 seconds.
- The journal retains up to 400 daily buckets, 500 recent actions and up to 2,500 per-manga duration keys.
- It supports opt-out, JSON export and typed-confirmation clearing.
- No analytics are uploaded to Hugging Face or a third-party analytics provider.

## 7. Private dataset and API boundary

Canonical private paths:

- data/library.json
- data/covers/<manga-id>.<ext>
- data/manifests/<chapter-id>.json
- data/manga/<manga-id>/<chapter-id>/<page-id>.<ext>

Reader API:
- GET /api/library: full catalogue snapshot and immutable revision.
- GET /api/media/cover: one requested cover.
- GET /api/media/manifest: one requested chapter manifest.
- GET /api/media/page: one requested page.
- POST /api/master?action=update-metadata: protected correction of title, creators or publicationStatus only.

The catalogue endpoint is intentionally bulk. Browser-side filters operate on the full loaded catalogue. Per-manga and per-page requests are for media assets or a selected chapter, not for repeated catalogue metadata. Private responses are no-store. The service worker must not intercept /api/*.

## 8. Versioning and migration rules

- Validate every untrusted response at runtime; TypeScript types alone are not validation.
- Keep manga/chapter/page IDs immutable through title changes, sorting, imports and metadata corrections.
- Preserve chapter/page ordering and exact identity. Do not infer completion from scrolling.
- Unknown schema versions fail closed. Do not silently truncate or normalise away fields.
- Use revision guards for remote writes. On conflict, refresh and ask for a new explicit correction; never blindly overwrite.
- Never mutate the private dataset or original media as a side effect of reader UI changes.
- Schema changes require a backwards-compatible migration plan, tests, backup and ADR.

For storage operations see the separate Manga Storage Controller. This repository does not own upload, full media backup, dataset migration or permanent deletion.
