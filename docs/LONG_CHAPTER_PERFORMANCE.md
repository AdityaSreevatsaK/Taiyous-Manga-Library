# Long-chapter scrolling: 300–1,000-page engineering guardrails

## Current reader behaviour

VerticalReader preserves one continuous DOM layout of original-aspect page placeholders for the entire chapter. It uses the direct-child HTMLCollection and a binary search over page-slot geometry to find the current anchor page. This replaced an earlier full querySelectorAll plus O(n) rectangle scan on every scroll. For 1,000 pages, the binary search needs approximately 10–11 geometry reads rather than up to 1,000.

There are two different page-loading paths:

- **Synthetic/demo chapters:** only the nearby page window is generated/resolved as the reader scrolls.
- **Private chapters:** all page bytes are queued immediately in reading order through preloadChapterPages, with concurrency 3 (hard maximum 4). PageSource objects/object URLs are retained in the chapter's in-memory image map until the chapter is closed. Only the current visible window (three pages before through five pages after the anchor) is mounted as img elements and decoded for display.

This distinction matters: bounded request concurrency and bounded mounted/decoded images do **not** impose a strict bound on the total downloaded bytes or retained page-source memory for a very large private chapter. The reader is not currently a viewport-only private page downloader and private pages are not persisted as offline copies.

## Existing deterministic guardrails

- Page slots retain stable aspect-ratio placeholders before image bytes are available.
- Scroll observation uses an anchored point inside the viewport, which behaves better for unusually tall webtoon/long-strip pages than raw intersection ratios.
- Geometry lookup uses binary search over direct child page slots.
- Only a bounded visible window is mounted as private img elements.
- Page request concurrency is bounded at 3.
- Private page requests are revision-pinned and SHA-verified.
- Failed pages do not stop the remaining queue; each failed page can be retried.
- Closing/changing chapter aborts the queue and releases retained page sources/object URLs.
- Scroll tracking records only a loaded, visible page; it does not count unseen placeholders as read.

Tests cover 1, 5, 300 and 1,000 page geometry with mixed tall/short aspect ratios, beginning/end anchors, malformed input and lookup bounds. Server-side rendering tests 1,000 page slots without downloading a thousand images. The page-preloader tests cover concurrency, order, cancellation and failures.

## Important limitations

These are algorithm/render guardrails, **not** a hardware memory benchmark. Actual low-RAM mobile testing and 1,000 real high-resolution images remain pending with authorised disposable media.

Because private chapters currently fetch every page up front and retain the page sources until chapter close, total source bytes and retained Blob/object-URL memory can grow with chapter size. Only mounted/decoded image elements are bounded. Measure this on real devices before claiming the reader is safe for very large private chapters.

A rolling/chunked private page window with source eviction may be considered if measurements show a problem. It must preserve instant vertical navigation, page identity, retry behaviour, revision pinning and progress restoration. Do not introduce speculative eviction based only on desktop tests.

## Acceptance plan

Use owned/generated disposable page assets at representative dimensions for 300, 500 and 1,000 pages. Record:
- Download duration and total bytes.
- Peak memory where available and retained source count.
- Mounted img and decoded image count during fast scrolling.
- Scroll jank, page retry and failed-network behaviour.
- Orientation change, background/resume and chapter close/reopen.
- Progress restore after reload and correct immutable page ID.
- Behaviour under low storage/network and cache eviction.

Never put real protected manga in CI, screenshots or public fixtures. Record physical device/OS/browser and exact tested commit in docs/REAL_DEVICE_ACCEPTANCE.md.
