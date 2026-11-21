# Five-chapter continuous reader acceptance

**Live application:** https://taiyous-manga-library.pages.dev/  
**Synthetic fixture:** Five Chapter Scroll Trial (mng_fivechaptertrial).

The public fixture is original synthetic demonstration artwork, separate from the private HF catalogue. It contains five chapters and 36 generated sample pages:

| Chapter | ID | Pages |
|---|---|---:|
| 01 · The awakening | ch_trialawakening | 7 |
| 02 · The crossroads | ch_trialcrossroad | 6 |
| 03 · The sky bridge | ch_trialskybridge | 9 |
| 04 · A spark of light | ch_trialstarlight | 8 |
| 05 · The new dawn | ch_trialnewdawn | 6 |

## Public sample test

1. Open Library → Five Chapter Scroll Trial → Read from beginning.
2. Scroll through the entire chapter in one continuous vertical view.
3. Use Next chapter once; the next chapter starts at its first page. Previous chapter returns to the prior chapter.
4. Confirm the first chapter has no Previous chapter and the final chapter has no Next chapter.
5. Jump to a page, reload and confirm saved chapter/page and approximate vertical offset.
6. Try Wide view, theme, chapter selector, Jump within chapter, focus view and Back/Forward.
7. Download one synthetic chapter explicitly, disconnect the network and verify that the sample chapter and app shell work offline.
8. Remove that offline copy and verify progress and unrelated copies remain.

## Private manga acceptance is separate

The public synthetic fixture does not prove private media access. Owner-authenticated acceptance must separately verify a real private cover, manifest and page through the Manga Cloudflare gateway, without exposing an HF token or private HF URL. See docs/REAL_DEVICE_ACCEPTANCE.md and docs/HF_READONLY_CONNECTION.md.

## Architecture boundaries

- Reader progress uses immutable manga/chapter/page IDs; route page numbers are one-based and internal page indexes are zero-based.
- Whole-chapter vertical scrolling is retained. Previous/Next navigate chapters, not individual pages.
- Image requests are bounded and nearby images are mounted/decoded to limit display memory.
- Synthetic offline copies are explicit opt-in. Private chapter pages are not downloaded for offline use.
- The private catalogue is loaded as a complete owner-authenticated snapshot; ordinary filters are local.
- No real manga images, credentials or private content belong in public GitHub code, frontend assets or logs.

## Automated verification

GitHub Actions runs TypeScript, Vitest, production build, bundle budgets and Chromium browser tests. A separate workflow runs Firefox/WebKit smoke. A post-merge Cloudflare workflow verifies the exact public build and anonymous private API denial. None of these substitutes for actual owner sign-in or physical-device testing.
