# Long-chapter scrolling: 300–1,000-page engineering guardrails

`VerticalReader` preserves one continuous DOM layout of original-aspect page placeholders, but never loads more than the visible page and immediate neighbours into the generated-image source map. This is independent of chapter length.

Before this change, every scroll triggered a full `querySelectorAll` plus an O(n) pass over page rectangles. On a 1,000-page chapter, that could force up to 1,000 geometry reads per scroll event. The reader now uses its live direct-child collection plus a binary search to find the anchor page, bounding geometry lookups to **at most 10–11 per 1,000 pages**. Page ranges remain bounded at 2 or 3 decoded sources.

Unit tests cover 1, 5, 300 and 1,000 pages with tall/short mixed heights, beginning/end anchors, malformed input and decoded-source bound. Server-side static rendering tests 1,000 page slots and aspect-ratio placeholders without loading a thousand images.

**Important limitation:** these are deterministic algorithm and render guardrails, **not** a hardware memory benchmark. Actual low-RAM mobile testing and 1,000 real high-resolution images remain pending with licensed disposable media. Never load real protected manga in CI.
