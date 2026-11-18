# Shared Core proposal 001: Accessible media shelf primitives

**Status:** Candidate proposal only, not an approved shared package  
**From:** Manga engineering session, 18 November 2026  
**Recipient:** Shared Core engineering session (Session 1)

## Evidence of possible reuse

Manga and the existing Novels app both need an adaptive search/filter shelf, a responsive header, media detail metadata and keyboard-accessible list/card navigation. The Manga demonstration implements these locally to avoid coupling an unversioned Shared Core workspace to a second application. No second-app benchmark, extraction or migration has yet occurred.

## Suggested exports (API sketch)

- `MediaShelfToolbar<TFilter>`: controlled filter slots + search, no media-specific network/search logic.
- `MediaCardShell`: focus and tap target, artwork slot, title and metadata slots; no cover source fetching.
- `MediaDetailHeader`: heading, badges/metadata and action slots; no manga or EPUB semantics.
- `LibraryBreadcrumbs`: labelled navigation, optional home link; no dependency on the hub.
- Semantic design tokens for spacing, contrast, focused states and mobile layout.

Every component is stateless with accessible labels and no storage, authentication, implicit routing or mutable global CSS side effects. Business logic, `MangaProgress`, page loading and rights manifests remain local.

## Consumers, acceptance and compatibility

**Potential consumers:** Manga and Novels, optionally Anime and Movies/TV if they later demonstrate comparable UI.  
**Breaking-change discipline:** versioned, pinned package release, backwards-compatible props, controlled/keyboard/a11y tests.  
**Evidence needed:** two actual consumers, screenshot and UX review at 320/375/390/768/1280 px, keyboard and screen-reader checks, bundle-size comparison, no hub-online requirement, and verified fallback/rollback.

**Request:** Session 1 can evaluate when it has a second concrete consumer. Do not change Shared Core based solely on this RFC. The Manga repo stays independent and uses no shared exports at present.
