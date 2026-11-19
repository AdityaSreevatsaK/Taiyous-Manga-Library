# Five-chapter continuous reader: acceptance checklist

**Live application:** https://taiyous-manga-library.pages.dev/

The fixture catalogue includes **Five Chapter Scroll Trial** (`mng_fivechaptertrial`), an entirely original synthetic manga created in the browser. It is separate from the empty private catalogue.

| Chapter | ID | Pages |
| --- | --- | ---: |
| 01 · The awakening | `ch_trialawakening` | 7 |
| 02 · The crossroads | `ch_trialcrossroad` | 6 |
| 03 · The sky bridge | `ch_trialskybridge` | 9 |
| 04 · A spark of light | `ch_trialstarlight` | 8 |
| 05 · The new dawn | `ch_trialnewdawn` | 6 |

Total: **five chapters, 36 original sample pages.** Neither the manga nor the pages originate from an external website.

## Test on phone and desktop

1. Open **Library → Five Chapter Scroll Trial → Read from beginning**. The chapter's full page sequence must be vertically scrollable without pressing Next for individual pages.
2. Scroll from the first to the last illustration. All seven pages of chapter 1 occupy the same continuous chapter view; nearby images load as needed.
3. At the bottom, select **Next chapter** once. Chapter 2 must open at its first page, with all six pages below it. **Previous chapter** returns to the first page of chapter 1.
4. Repeat through chapter 5. Its **Next chapter** control must be disabled, and chapter 1's **Previous chapter** control must be disabled.
5. Scroll halfway through a chapter, then return via the series page's **Continue reading** link. The exact page and approximate vertical offset should be restored. Reload the browser to verify local persistence.
6. Try **Wide view**, the reader themes, the chapter selector, **Jump within chapter**, focus view and Back/Forward navigation. On narrow mobile screens there must be no horizontal scrolling or tiny buttons.
7. On series details, choose **Download chapter** for one chapter. In **Offline**, open that specific chapter with the device disconnected; the app shell and downloaded images should be usable. Other chapters are **not** downloaded automatically. Removing the offline copy must preserve reading progress.

## Architectural boundaries

- Page URLs and local progress retain immutable chapter/page IDs for accurate resume even though navigation is chapter-only.
- Downloaded images are explicitly opted into and integrity-checked; large chapters are rendered with limited neighbouring images decoded at a time.
- The source is still fictional fixtures. Personal manga imports, private Hugging Face data, backend authentication, authorised media delivery and cross-device syncing are separate milestones.
- No real manga images, credentials or private content belong in public GitHub code, frontend assets or logs.

## Engineering verification

GitHub Actions runs TypeScript, unit tests, production build and Playwright Chromium checks. The separate *Live Cloudflare smoke* workflow compares real served asset hashes against the current source build, checks deep links for the trial series, and confirms the service worker and chapter-only controls are present. CI passing alone does not establish real-device acceptance.
