# Manga Library ↔ Manga Storage Controller: metadata contract alignment

**Status:** Reader implementation aligned with Controller draft PR #26 (20 November 2026). No live HF writes. Do not merge into production until Controller finalises the cross-repository contract and tests real private media.

**Reference:** [Storage Controller PR #26](https://github.com/AdityaSreevatsaK/Taiyou-Manga-Storage-Controller/pull/26), `docs/METADATA_RECONCILIATION_CONTRACT.md` on its feature branch.

## Canonical catalogue

`data/library.json` remains `{"schemaVersion":1,"mediaKind":"manga","entries":[...]}`. Existing immutable manga, chapter and page IDs remain unchanged. Existing entries without new metadata are still valid.

The Controller's optional `MangaEntry` fields are:

```json
{
  "kind": "manga",
  "id": "mng_aaaaaaaaaaaa",
  "creators": ["Writer", "Artist"],
  "creatorRoles": [
    {"name": "Writer", "role": "author"},
    {"name": "Artist", "role": "artist"}
  ],
  "aliases": ["Alternative title"],
  "tags": ["Romance"],
  "synopsis": "Source-verified summary",
  "publicationStatus": "completed",
  "cover": {
    "assetPath": "covers/mng_aaaaaaaaaaaa.webp",
    "mimeType": "image/webp",
    "width": 800,
    "height": 1200,
    "byteSize": 12345,
    "sha256": "<64 lowercase hexadecimal characters>"
  },
  "metadataSources": {
    "cover": {
      "provider": "mangadex",
      "sourceId": "source-title-id",
      "sourceUrl": "https://mangadex.org/title/source-title-id",
      "retrievedAt": "2026-11-20T08:30:00Z"
    }
  }
}
```

The example shows the additional fields only, not a standalone complete manga entry.

- **Cover:** exact field `cover` with six descriptor properties. Relative to `data/`; must reference `covers/<same-immutable-manga-id>.(png|jpg|jpeg|webp|avif)`. The original format is retained; JPEG accepts `.jpg` or `.jpeg`. Dimensions and SHA-256 are checked. No hotlink, token, public URL, or arbitrary path is allowed.
- **Credits:** `creatorRoles` with `name` and `role` ('author' or 'artist'). Required `creators` remains the backwards-compatible fallback. No unsupported assumption that a creator is an author.
- **Provenance:** optional `metadataSources` keys limited to `aliases`, `creators`, `creatorRoles`, `tags`, `synopsis`, `publicationStatus`, `cover`. Each source contains provider, sourceId, uncredentialled HTTPS sourceUrl and UTC retrievedAt. No signed URL is followed or rendered.
- **Separation:** imported publication genres and release status never overwrite personal tags, ratings, shelves, notes or collections.

## Library integration

`GET /api/media/cover?mangaId=<immutable-id>` requires a valid owner session, verifies the current private dataset revision, matches `cover` to the catalogued manga, checks image signature, byte size and SHA-256, and returns original bytes with the verified MIME type and `private, no-store` headers. No provider access tokens or private Hugging Face URLs appear in page HTML.

The UI displays private artwork across the home hero, cards and manga detail page; preserves publication ribbons, reading progress, themes and fallback illustrations. A metadata-only refresh reloads the catalogue without changing personal reading data.

## Deployment gates and responsibilities

1. Controller PR #26 must finalise its exact schema with the Retriever; this Library branch follows that draft, not a competing `coverAsset` or `authors`/`artists` format.
2. Controller must preview and approval-gate any metadata enrichment, preserve existing information and rights evidence, and use revision-safe HF writes. **Library does not write private media**.
3. Automated parser, gateway, Chromium, Firefox and WebKit checks must pass.
4. Real signed-in cover retrieval must be verified **only after** the Controller uploads an authorised private cover. A mocked CI cover is not live proof.
5. Only then merge, deploy and run authenticated Cloudflare smoke. Older bookmarks, progress and offline copies must remain intact.
