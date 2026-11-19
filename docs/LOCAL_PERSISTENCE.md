# Local Reader Persistence

## Manual backup and transfer (19 November 2026)

The library now includes a **Transfer reading progress between devices** panel. It is browser-only and works without Hugging Face:

1. Open Home or Library and expand the transfer panel.
2. Choose **Download progress backup** to save a small JSON file. Only validated manga IDs, chapter/page progress, anchor offsets and optional reader preferences are included.
3. On the receiving device, select the JSON file. The app validates the entire document, rejects unsupported versions, duplicate manga IDs, incorrect page identities and malformed preferences, and presents a review before writing.
4. Select **Confirm restore**. Records with equal or newer local timestamps, or corrupted local records, are never overwritten. Unknown manga IDs are skipped.
5. Theme and image-fit preferences are restored only if the separate opt-in checkbox is selected.

Import files are capped at **256 KB**. Backups are never uploaded to a service. This is not automatic cross-device synchronisation. Media, offline chapter blobs, user accounts, title metadata and private Hugging Face data are not included.

If a destination write fails, successfully applied individual records remain intact and the UI reports unavailable records. No record is deleted. Restore is a *merge*, not a replacement. Browser storage can be cleared independently by the browser or device, so keep the downloaded JSON somewhere safe.

**Tests:** Unit cases for malformed/unknown records, duplicate IDs, stale records, corrupt local data and settings opt-in, plus Playwright download/import and cancellation tests.

---


**State:** stacked development branch, not merged or deployed.

## Storage contract

- `localStorage` per-manga record: `taiyou-manga:progress:v1:<immutable manga ID>`.
- Versioned envelope: `{ schemaVersion: 1, mediaKind: "manga", progress: { mangaId, chapterId, pageIndex, pageId, updatedAt, readingMode?, verticalOffsetRatio? } }`.
- `pageIndex` is zero-based. The immutable `pageId` must match the validated manifest on every read.
- Preferences stored separately under `taiyou-manga:reader-preferences`: explicit reading direction override, image fitting and visual theme.
- Every record is validated at read/write; corrupted, unsupported or stale records are preserved, not automatically deleted or migrated destructively.
- Each series has its own storage key so one malformed record cannot reset every other manga.
- Stale cross-tab writes are rejected by UTC timestamp comparison. A browser `storage` event reconciles later records with current session state.
- Browser quota or security failures are surfaced as a warning; the session stays operational. The app does **not** promise survival in private mode or if the user clears site data.
- Anchor ratio is captured in vertical mode and used when reopening the same page. It is not a promise of pixel-perfect restoration after an asset's dimensions change.

## Data boundaries

No publication status or Finished reading status is derived from page position. No cloud writes, accounts or cross-device sync exist. Personal records stay in the user's browser and are never in the static build. This is designed for later versioned cloud sync, but no provider or conflict policy is approved.

## Verification

Run Node 22 `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. Browser cases cover reload, new tab, image-fit/theme persistence, incorrect records, stale writes, vertical scrolling and offline progress in an already loaded tab. Genuine offline cold starts and private downloaded chapters are **PR D**, not this feature.

## Rollback

A code revert leaves versioned browser records intact. Do not remove or clear per-series keys as part of rollback; previously validated data remains available after restoring this feature.
