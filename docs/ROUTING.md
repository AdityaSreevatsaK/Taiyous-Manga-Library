# Browser Routes and Navigation

**State:** PR B, staged on top of the mobile-reader PR. Not yet merged or deployed.

## URL contract

- `/` is the Home view, including the editorial introduction.
- `/library` is the searchable sample Library.
- `/manga/:mangaId` opens series details.
- `/manga/:mangaId/chapters/:chapterId?page=3` opens page 3 of the chapter.
- `page` is a human-readable **one-based** query parameter; internal `ReaderLocation.pageIndex` remains zero-based. Manga and chapter IDs are immutable.
- Unknown series, missing chapters and out-of-range pages show a recoverable Page Unavailable state.

Navigation uses ordinary `<a href>` links, with History API interception for unmodified left clicks. Modified clicks, copy link, middle-click, right-click and new tabs retain normal browser behaviour. Browser Back/Forward restores routes without erasing in-session progress.

For horizontal reader navigation and explicit page selection, a new reader position is pushed to history. Frequent updates while vertically scrolling replace the current history entry rather than creating hundreds of Back entries.

## Hosting and fallback

Cloudflare Pages is the preferred host. It normally serves `index.html` for unknown SPA routes when no top-level `404.html` exists, as described in Cloudflare's serving-pages documentation. **This has not been verified against a live deployment in this project.**

The existing GitHub Pages fixture demo is separate and may not serve direct nested URLs without an explicit 404 fallback; treat Cloudflare deployment verification as the release gate for deep links. No second production host is required.

The route prefix respects `import.meta.env.BASE_URL` so that internally generated links work under `/Taiyous-Manga-Library/` for the GitHub Pages build and under `/` on Cloudflare.

## Security, privacy and compatibility

Route IDs are validated and never used as raw media URLs. Invalid page indexes are rejected. The public demo uses only synthetic media. Page URLs contain no private user data, cloud tokens, or private source identifiers. Future private auth must authorise server-side asset requests independently of the route parser.

All prior RTL/LTR/continuous vertical reading controls remain. No persistence, offline downloads or real images are introduced in PR B.

## Required verification

TypeScript, Vitest and browser tests, plus manual Cloudflare direct deep-link and refresh after a permitted deployment. Tests include invalid routes, 1-based page query, Back/Forward, bookmark/reload, home/library distinction and opening series in a separate browser tab.
