# Real-device and production acceptance checklist

**Status:** Manual acceptance remains unverified unless a dated result is recorded below. This file is a procedure, not evidence of a pass.

## Record each session

| Field | Value |
|---|---|
| Date / tester | |
| Device and memory | |
| OS and version | |
| Browser and version | |
| Tested master commit SHA | |
| Cloudflare deployment / live-smoke run | |
| Network state | |
| Steps, result and evidence | |

Use the original synthetic Five Chapter Scroll Trial for public reader tests. Never upload private licensed manga to public CI or screenshots.

## Production shell and deployment

- [ ] Confirm current master SHA and Cloudflare deployment match.
- [ ] Check /, /library, /offline, /master, manga details and direct chapter/page routes.
- [ ] Verify service-worker fingerprint and cold offline app-shell launch.
- [ ] Check the six visible primary shelves: Home, Currently Reading, Trying Out, Available Offline, Finished and All Manga.
- [ ] Check Master Controls and Analytics route, including /master?view=analytics.
- [ ] Confirm theme-specific Sun mark, favicon and PWA artwork across all six themes.
- [ ] Confirm public shell contains only synthetic demo data and no private manga assets or credentials.

## Reader and UI

- [ ] Test 320–430px portrait, landscape, split-screen, tablet and desktop layouts.
- [ ] Check the cloud status control immediately after the wordmark, real connection state and keyboard access.
- [ ] Check three-cover Home hero: all three covers visible and contained, centre selected initially, hover/focus updates title/creator/synopsis/actions.
- [ ] Test whole-chapter vertical scrolling without per-page Next/Previous controls.
- [ ] Confirm Previous/Next navigate chapters only and chapter-boundary controls disable correctly.
- [ ] Verify direct links, page selection, Back/Forward and reload.
- [ ] Resume saved progress at the correct immutable page ID and approximate tall-page offset.
- [ ] Test focus, keyboard, touch, rotation, app background/resume and reduced motion.
- [ ] Verify no horizontal overflow, clipped controls, unreadable contrast or distorted covers.

## Local personal data

- [ ] Change theme, personal shelf, rating, notes, tags, favourites and explicit chapter-completion markers.
- [ ] Create nested collections, add/remove membership and test confirmation/revision conflicts.
- [ ] Export the personal JSON backup and restore into a disposable browser profile.
- [ ] Confirm invalid/stale local records are preserved and unrelated records remain unchanged.
- [ ] Check usage analytics opt-out, per-manga reading time, action history, JSON export and typed-confirmation clearing.
- [ ] Confirm clearing analytics does not clear reading progress or annotations.
- [ ] Download a synthetic chapter, cold-start offline and verify checksum-backed reading.
- [ ] Remove the synthetic offline copy and confirm progress and other copies remain.

## Owner-authenticated private dataset checks

These checks require the actual owner account and must not be inferred from anonymous CI.

- [ ] Sign in through the dedicated Manga Hugging Face OAuth flow.
- [ ] Confirm the complete private catalogue loads and local tag/shelf/search filtering does not generate per-title metadata calls.
- [ ] Confirm a known private cover loads through /api/media/cover and the network panel shows no HF bearer token or private HF URL.
- [ ] Open a known private chapter, load its manifest and pages, and verify chapter navigation and saved position.
- [ ] Sign out and confirm private API reads are denied and the local private cover cache is cleared.
- [ ] Verify the separate write OAuth scope and configured Master passphrase without exposing their values.
- [ ] Test one title/creator/publicationStatus correction against a disposable dataset or explicitly approved test record; confirm revision conflict behaviour and immutable IDs/slugs.

## Long chapter acceptance

Use owned/generated disposable images representing intended page sizes at 300, 500 and 1,000 pages. Record initial render, scroll responsiveness, peak memory where available, decoded image count, failures, rotation/restart and recovery after cache eviction. Deterministic unit geometry tests are not a hardware memory benchmark.

## Current result log

No physical-device or owner-authenticated pass is asserted by this checklist. Add dated evidence only after the test is actually performed. If unavailable, record **Not tested**.
