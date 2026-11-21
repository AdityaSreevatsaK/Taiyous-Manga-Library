# ADR-006: Manga rights manifest, asset addressing and private adapter boundary

> Historical design proposal from 18 November 2026. The private Hugging Face dataset, owner OAuth and authenticated cover/chapter gateway were implemented later. Use ADR-007 and docs/ARCHITECTURE.md for the current implementation. The rights, path-validation and recovery principles below remain relevant.


**Status:** Superseded as an implementation proposal by ADR-007 and the live private gateway. Retained as the original rights/manifest design record.  
**Date:** 18 November 2026  
**Scope:** Taiyous-Manga-Library only  
**Source of truth:** Domain validators in `src/domain/validation.ts`; this ADR deliberately does **not** select a provider or grant upload permission.

## Problem

A chapter can contain hundreds of large pages, and its provenance cannot be inferred from a title, filename or publicly accessible URL. We must keep identity, source rights, private media, personal annotations and sync revisions distinct. A private GitHub repository does not secure browser bundles, uploaded pages or a public deployment. The novels app's HF dataset or OAuth session is not shared authentication.

## Proposed manifest envelope

Store private originals and a versioned manifest on an access-controlled backend. The following *illustrative* structure is not a deployed schema:

```json
{
  "schemaVersion": 1,
  "mediaKind": "manga",
  "seriesId": "mng_stableopaque001",
  "revision": "opaque-etag",
  "rights": {
    "schemaVersion": 1,
    "sourceType": "original",
    "title": "An Original Fictional Series",
    "permissionEvidence": "Private authored-work record; do not publish this field",
    "attribution": "Owner",
    "recordedAt": "2026-11-18T00:00:00Z"
  },
  "chapters": [{
    "schemaVersion": 1,
    "mediaKind": "manga",
    "chapterId": "ch_stableopaque001",
    "pages": [{
      "id": "pg_stableopaque001",
      "assetPath": "manga/mng_stableopaque001/ch_stableopaque001/page0001.png",
      "mimeType": "image/png",
      "width": 680,
      "height": 920,
      "byteSize": 20000,
      "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }]
  }]
}
```

Paths are **opaque relative identifiers**, not arbitrary URLs. SHA-256 and byte size must eventually be verified against decoded binaries at the private server boundary. The fixture metadata is illustrative, not actual binary proof. A path by itself must never be passed to `<img src>`; a trusted private adapter must resolve it after authorisation.

## Required adapter port (proposed only)

```ts
interface PrivateMangaAssets {
  readManifest(seriesId: string, signal?: AbortSignal): Promise<ValidatedManifestResult>;
  resolvePage(chapterId: string, pageId: string, signal?: AbortSignal): Promise<AuthenticatedImageResult>;
  downloadOffline(chapterId: string, explicitConsent: boolean, signal?: AbortSignal): Promise<OfflineOperationResult>;
  removeOfflineCopy(chapterId: string): Promise<OfflineOperationResult>;
}
```

The result types must distinguish `unavailable`, `unauthorised`, `offline`, `corrupt`, `unsupported-format` and `revision-conflict`. Storage URLs must not be reusable cross-origin credentials. Browser `blob:` URLs must be revoked on eviction. No client-side long-lived tokens and no open fetch proxy.

## Upload/import preflight

1. Owner supplies original, legitimately owned or licensed media and private proof of rights.
2. Validate schema version, IDs, chapter order, page indexes and duplicate IDs.
3. Inspect image magic bytes and decoded size; allow PNG/JPEG/WebP/AVIF only. Reject SVG, HTML, scripts, polyglots and content type mismatches.
4. For archives: reject absolute paths, `..`, encoded traversal, backslashes, nested unexpected paths, symlinks, excess entries, decompression bombs and excessive total bytes. Recheck while streaming extraction into a quarantined temporary location.
5. Verify checksum, dimensions, size limits and total quota before committing a revision-guarded manifest.
6. Preserve immutable originals, immutable backup and revision history. Never overwrite on conflict; support explicit recovery.

`validateArchiveIndex` is a **metadata-only preflight**, not a ZIP extractor or complete malicious-archive defence. Actual bytes must be independently validated when an importer exists.

## Provider options (undecided)

- Private object storage with same-origin signed server mediation: scalable media delivery, but new auth, cost and cache policy.
- Private Hugging Face dataset via server-side adapter: ecosystem familiarity, but unsuitable unless access, download behaviour, archive limits and long-term data costs are verified.
- Local-only import: simplest privacy boundary, but no cross-device sync and more complex backups.

**No provider chosen or connected.** No costs are asserted without region and expected storage/egress figures.

## Privacy, sync and deletion

Separate four stores: public descriptive metadata; private personal ratings/tags/progress; protected originals and validated manifests; revisions, tombstones and sync conflicts. Offline caching is opt-in per chapter, limited by quota, with explicit Clear Offline Copy. Permanent deletion must require server-authorised owner confirmation, proven backup and revision guard. At proposal time the prototype retained synthetic progress only in React memory. Current private media access is implemented through the gateway described in ADR-007; media uploads and deletion remain with the Storage Controller.

## Compatibility, testing and rollback

Stable IDs survive renaming, sorting and import changes. Future schema migrations are explicit, reversible and fail closed on unknown versions. Add two-device revision tests, corrupted image/page errors, quota failures, cancellation, offline eviction, expired session, CSRF and backup restore tests before enabling a live adapter. No migration or rollback is needed for the synthetic-only demonstration.

## Approval gate

Obtain owner approval of provider, rights policy, authentication, data volumes, quotas, retention, storage cost, offline consent and rollback before real uploads or synchronisation.
