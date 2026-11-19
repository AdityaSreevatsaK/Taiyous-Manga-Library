# Real-device and production acceptance checklist

**Status:** Manual verification pending. This document is a test procedure, not evidence of a pass.

## Record for each session

| Field | Value |
| --- | --- |
| Date and tester | |
| Device / memory capacity | |
| OS and version | |
| Browser and version | |
| Tested release commit SHA | |
| Cloudflare deployment / live-smoke run URL | |
| Test network: Wi-Fi / mobile / airplane | |
| Failures, screenshots and reproduction | |

Use the synthetic **Five Chapter Scroll Trial**. Never submit private licensed manga to public GitHub Actions, Cloudflare assets or support screenshots.

## Production release checks

- [ ] Compare the current `master` SHA with the Cloudflare deployment; do not infer successful deployment from merging a PR.
- [ ] Check `/`, `/library`, series details and direct chapter/page URLs in a fresh tab and after reload.
- [ ] Check the current generated `/sw.js` fingerprint against the published application assets.
- [ ] Confirm the app is a clearly labelled fictional demonstration with no third-party private media requests.
- [ ] Check installed logo, favicon and PWA artwork in Sepia, Paper, Charcoal, Midnight, Ocean and Plum.
- [ ] Confirm a fresh browser, previously installed browser and offline cold start all show the correct release.
- [ ] Install a second distinct release with the same browser profile. Verify no partial release becomes the offline fallback; keep an older complete shell for rollback.
- [ ] Check error behaviour when a release download is interrupted halfway through, without clearing unrelated offline chapters or personal data.

## Android Chrome and iOS Safari (repeat on each)

- [ ] Start at 320–430 px portrait width, landscape, tablet layout where available; inspect safe areas, controls, menu positioning and horizontal overflow.
- [ ] Navigate all eight sections. Confirm mobile More has no duplicate active navigation destinations.
- [ ] Save a theme and reopen. Default is Sepia for new profiles; opening the theme menu must not mutate the selection.
- [ ] Open the five-chapter trial and scroll through **every page of a whole chapter** without individual-page Next/Previous controls.
- [ ] Confirm previous bottom-left, chapter selection bottom-centre and next bottom-right; check first/final chapter disabled boundaries.
- [ ] Jump directly to a page, reload and restore chapter, page and approximate tall-image offset.
- [ ] Suspend, background, rotate and reopen the browser. Verify reading position and keyboard/touch focus.
- [ ] Observe only nearby decoded images during scrolling; check tall pages for no distortion, gap, overlap or flash.
- [ ] Save favourites and manual chapter-completion markers; confirm they survive reload and do not change publication status or reading position.
- [ ] Edit notes, tags, collections and reading shelves. Export a private JSON backup, restore into a second disposable browser profile and verify non-destructive merge.
- [ ] Download a chapter, turn off connectivity, cold-start the app and read the cached chapter.
- [ ] Remove an offline chapter and confirm reading progress and unrelated downloads remain intact. No Owner mode is needed for offline removal.
- [ ] Simulate low quota/blocked storage in a disposable profile. Verify truthful error messages and no silent loss of the only copy.
- [ ] Check focus visibility, screen-reader labels, large touch targets and reduced-motion behaviour.

## Long chapter memory acceptance

Use **owned/generated disposable images**, representative of the intended image resolutions, with 300, 500 and 1,000 pages. The current deterministic geometry tests are not a hardware performance benchmark.

Record for each size: initial render latency, scroll smoothness/jank, peak browser memory where supported, live image count, decoding failures, rotation/restart behaviour and recovery after cache eviction.

**Release decision:** Pass only when the evidence links above are recorded. If no physical iOS or Android device is available, record *Not tested* rather than assuming WebKit/Chromium emulation proves it.
