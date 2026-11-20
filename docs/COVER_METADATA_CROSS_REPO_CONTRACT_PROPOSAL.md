# Proposed Manga Library / Storage Controller cover metadata contract

**Status:** DRAFT, requires agreement with Manga Storage Controller before merging. No Hugging Face writes.

The existing canonical envelope remains `{"schemaVersion":1,"mediaKind":"manga","entries":[...]}` at `data/library.json`. Existing entries with no optional metadata remain valid and keep all `mng_*`, `ch_*` and `pg_*` IDs.

## Proposed optional entry fields

```json
{
  "kind": "manga",
  "id": "mng_<immutable-id>",
  "creators": [],
  "authors": ["Original author"],
  "artists": ["Illustrator"],
  "synopsis": "Source-verified summary",
  "aliases": ["Alternative title"],
  "tags": ["Romance"],
  "publicationStatus": "completed",
  "coverAsset": {
    "assetPath": "covers/mng_<immutable-id>.webp",
    "mimeType": "image/webp",
    "byteSize": 12345,
    "sha256": "<64 lowercase hexadecimal characters>"
  }
}
```

**Compatibility:** `creators`, `aliases`, `tags`, `publicationStatus` and `chapters` retain current required meanings. `authors`, `artists` and `coverAsset` are optional. A missing author or artist role is not inferred from an unspecified `creators` array. The `source`/provenance model must be defined by Controller and Retriever; the Library does not fabricate claims of accuracy.

**Cover asset:** The Controller already documents a planned `data/covers/<manga-id>.webp` object. This proposed catalogue reference uses the same relative `assetPath` convention as chapter pages, without `data/` in the field. It must be validated against the entry's immutable ID. Do not accept absolute URLs, arbitrary extensions, mismatched checksums or remote token-bearing URLs.

**Reader API:** `GET /api/media/cover?mangaId=<immutable-id>` uses owner-authenticated Cloudflare Pages Functions, resolves the private canonical catalogue at its current SHA, checks the referenced cover size and SHA-256, and streams a no-store same-origin WebP response. Browser components receive only this first-party route. Missing or corrupt artwork retains the existing placeholder.

**Storage safety:** The Library does not upload, migrate, delete, reconcile or refresh HF assets on its own. The Controller must handle source provenance, manual-edit precedence, matching/conflicts, preview, revision-guarded catalogue updates and backup/recovery. The Library offers a metadata-only refresh that does not rewrite personal progress, collections or offline records.

## Required agreement before merge

1. Controller and Retriever confirm the exact optional field names and credit/provenance semantics.
2. Controller confirms the WebP-only managed cover path, hash/byte-size metadata and conversion policy, or proposes an agreed revision here.
3. Verify an actual private dataset cover and the authenticated no-token endpoint end-to-end.
4. Pass unit, Chromium, Firefox and WebKit checks and confirm mobile layout against the Novel Library details page.
5. Merge only after agreement. No destructive or implicit migration of existing manga.
