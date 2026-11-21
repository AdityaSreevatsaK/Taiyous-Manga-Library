> **Current implementation note, 21 November 2026:** This file contains the original 20 November screenshot audit and a source-driven follow-up. The implementation has since moved to six visible primary shelves (Home, Currently Reading, Trying Out, Available Offline, Finished, All Manga), with Analytics inside Master Controls and legacy To Be Read bookmarks preserved. PRs #56–#64 completed the Master route, analytics, homepage containment/contrast/toasts and rolling chart dates. Use [AGENTS.md](../AGENTS.md), [PROJECT_STATUS.md](PROJECT_STATUS.md) and [PROJECT_HISTORY.md](PROJECT_HISTORY.md) for the current approved behaviour. The older table below is historical context, not a current component inventory.

# Manga Library versus Novel Library: UI parity audit

**Date:** 20 November 2026  
**Visual evidence:** Owner's side-by-side desktop screenshot, Manga Library on the left and Novel Library on the right.  
**Reference repository:** `AdityaSreevatsaK/Taiyous-Personal-Library` (read-only)  
**Target:** `AdityaSreevatsaK/Taiyous-Manga-Library` (this repository)

## Observed differences and corrections

| Area | Novel Library reference | Manga Library before | This redesign |
|---|---|---|---|
| Branding | Sun mark, Novel Library masthead | Earlier Manga masthead with oversized header image | Matching mark scale, border and hierarchy; final brand wording is Taiyou's Manga Library |
| Cloud | Compact icon and status dot next to the brand; settings open on demand | Status text and sign-out spread across header and page | Compact cloud icon; real owner status, sign-in/out, sample switch and backup tools in one menu |
| Global search | Top-right searchable field with separate advanced search control | Search buried in catalogue toolbar | Top-right global search with advanced-search action; entering text opens All Manga |
| Themes | Six one-click circular swatches, selection tick | Wide `App theme` select | Six direct-access swatches with accessible names, keyboard focus and persisted state |
| Navigation | Separate full-width second row; active underline; tags and collections on right | Earlier eight crowded links | Six visible primary shelves below masthead; active underline; Tags and Collections at right; Analytics inside Master; legacy To Be Read URL preserved |
| Source management | Connection lives in the cloud popover | Oversized sample/private mode bar interrupts homepage | Bar removed. Sample remains clearly labelled and never mixed with private catalogue |
| Hero | Deep navy literary editorial hero with typography and a cover gallery | Pale split hero and white mock bookplate | Navy editorial hero with gallery and actual reading statistics underneath |
| Home versus all catalogue | Curated homepage, full controls in the main library | Repeats full search/filter controls on home | Home shows at most four stories and no heavy filter panel; All Manga contains full discovery filters |
| Cover cards | Cover-forward 2:3 artwork, centred details and publication ribbons | Earlier prototype cards | Retain cover-forward cards, genres, personal ratings, restrained **Story Complete / Updating / On Hiatus / Dropped** ribbons |
| Series page | Large cover, clear synopsis, reading actions and personal tools | Simpler detail layout | Existing editorial details preserved; personal metadata and chapter completion retained |
| Mobile | Controls wrap without horizontal overflow | Header crowds the 320–740 px range | Responsive masthead/nav/cloud overlay; viewport regression tests |
| Offline / reading | Independent offline and progress behaviour | Functional vertical manga reader | Preserve existing reader and chapter-only navigation; no replacement with novel EPUB controls |

## Deliberate distinctions

- Manga requires a continuous image-based chapter reader. Novel Library's EPUB controls and chapter rendering must **not** be copied.
- Novel Library already has cover artwork and a populated private dataset. The Manga dataset currently has no manga. The UI must not show invented cover art, featured manga or reading progress on the private homepage.
- Novel Library has Owner/Master controls and ingestion actions. Those will not be faked or enabled here until the manga Storage Controller's format and permissions are approved.
- Six visible primary shelves remain in place, with Analytics inside Master Controls and legacy To Be Read URLs preserved. Six saved themes, owner-only Hugging Face OAuth and browser-local personal records remain in place.
- Offline chapters and manual personal backup are reachable independent of cloud connectivity. Backups live in the cloud *menu as a library-tools entry*, but are still device-local data.
- Colour alone is not considered design parity: masthead information architecture, two-row navigation, cloud settings placement, empty state, density and editorial layout are all included.

## Tests and acceptance

- SSR verifies the heading, sun mark, no intrusive source switcher, global search, cloud status and six swatches.
- Chromium E2E checks 320, 390, 740, 900, 1,280 and 1,536 px, no horizontal overflow, actual All Manga search navigation, theme selection and cloud menu.
- Legacy browser journeys continue covering backup and restore, tags, collections, reader progress and offline downloads.
- Firefox/WebKit smoke checks prevent shell/reader regressions.
- Bundle enforcement includes **18 KiB maximum gzipped CSS** to keep the more elaborate styling usable on mobile.
- After merge, require production Cloudflare SHA/asset match and private API security smoke. A Git merge is not evidence that the deployment completed.

## Further work not hidden by this audit

1. Actual manga covers require a safe, approved private image path, not fake remote URLs.
2. Populated private catalogue layout requires real metadata. Revisit featured manga, recommendation rails and visual balance with actual entries.
3. Hardware acceptance on iOS Safari and Android Chrome remains separate from emulated browser tests.

---

## 21 November 2026: Source-driven parity follow-up

The table above records a historical 20 November prototype, **not the current
navigation or the full accepted visual specification**.

The owner compared two actual details-page screenshots and marked differences
in the top brand/utility controls, absent card-header icons, chapter heading
glyph, synopsis actions, footer text alignment and missing return-to-top.
The implementation must use the Novel Library source as the **contract**:

| Area | Current Novel source | Required Manga adaptation |
|---|---|---|
| Details masthead | `BookDetails.tsx` `details-topbar`, `BrandMark` (32px), `QuickNavigation`, compact `ThemeSwitcher` | Dedicated details header with Manga branding, reused sun, quick nav and same six-theme choices, no extra cloud icon here |
| Catalogue cloud | `LibraryDashboard.tsx` adjacent to wordmark, Lucide `Cloud` 25px/1.9 stroke, 6px dot | Leave adjacent to Manga sun, never independently reposition rightwards; same icon component |
| Master icon | `LibraryDashboard.tsx`: Lucide `Settings2` 16px | Use exact path instead of LockKeyhole in the Master link |
| Side cards | `BookDetails.tsx` `details-section-header` with Bookmark, Info, Tag, Star, LockKeyhole | Use identical semantic and decorative SVGs on Manga's corresponding cards |
| Chapters | `ChapterBrowser.tsx` uses Lucide `List` | Replace plain glyph placeholder with List, preserve Manga's chapter manifests and zero-based page ordering |
| Synopsis | `BookDetails.tsx`: edit Pencil control, serif scrollable text | Same edit action, typography, scrollbar and keyboard access, while local override never edits private HF metadata |
| Footer | `site-footer.css`: centred year, site title and “Created by Taiyou” | Replace the former spread-out private-connection/debug text |
| Back to top | `BackToTop.tsx` / `back-to-top.css` | Same scroll threshold, dimensions and focus/motion behaviour |
| Navigation | Current owner decision | Six visible shelves. Analytics is under Master, no separate password. Old `/analytics` and `/to-read` links redirect safely |

**Verification:** Expanded browser tests target the actual reference elements at
320, 390, 768 and 1280px, including status dot, theme controls, card icons,
scrollable synopsis, navigation and responsive footer. Cross-browser checks,
production build, Cloudflare smoke and real device acceptance remain distinct.
Never claim pixel-perfect matching merely because typechecking and tests pass.
