# Browser routes and navigation

## Canonical route contract

- / : editorial Home.
- /library : All Manga and local discovery filters.
- /master : Master Controls overview.
- /master?view=analytics : Master Controls Analytics.
- /manga/<readable-series-slug> : manga details.
- /manga/<readable-series-slug>/chapters/<readable-chapter-slug> : continuous chapter reader.
- ?page=N : optional human-readable one-based page index. Page 1 is omitted from canonical links.

The route resolves readable slugs against the authenticated catalogue and then uses immutable manga/chapter IDs internally. Existing ID-based bookmarks remain supported. Duplicate slugs are disambiguated with an ID suffix. Ambiguous title/alias matches fail closed.

Legacy /analytics bookmarks resolve to /master?view=analytics. Legacy /to-read resolves to the All Manga view; To Be Read is no longer a primary navigation tab.

## Navigation behaviour

The app uses ordinary anchor links and History API interception for unmodified left clicks. Modified clicks, middle-click, copy-link and opening in a new tab retain browser-native behaviour.

- Direct deep links and page query parameters are validated.
- Browser Back/Forward restores the route without discarding the current session's progress.
- Frequent vertical scroll updates replace the current history entry instead of creating hundreds of Back entries.
- Unknown series, chapters or out-of-range pages show a recoverable not-found state.
- Catalogue search/filter query parameters are bookmarkable and do not include private notes, ratings or personal annotations.

## Hosting

Cloudflare Pages serves the SPA shell for nested routes. The live smoke checks /library, /offline, /master and synthetic manga/chapter deep links. The Vite base path supports the optional GitHub Pages preview mode, but GitHub Pages is not the production host.

## Privacy

Route IDs and slugs are not credentials. No route may include private HF tokens, private media URLs, personal notes or ratings. Every private media request independently checks server-side owner access; a route parser is not an authorisation layer.

## Tests

See src/domain/routes.test.ts, e2e/manga-reader.spec.ts and scripts/live-cloudflare-smoke.mjs. Verify deep links, one-based page queries, legacy bookmarks, Back/Forward and reload after route changes.
