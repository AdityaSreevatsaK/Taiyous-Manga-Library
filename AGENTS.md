# AI Agent Working Agreement: Taiyou's Manga Library

**Applies to every directory in this repository.** The owner is directing parallel sessions across five GitHub repositories. Your session owns **only** Taiyous-Manga-Library; treat other repositories as external integration partners.

## Agent mission
Build a secure, maintainable, privacy-respecting manga application to read and organise legitimately acquired manga with chapter/page-level progress and optional offline access. Review the actual current source and issue/PR state on every visit. Do not assume README statements are always current.

## Mandatory start sequence
1. Inspect `master`, active branches, pull requests, workflow results and actual package versions.
2. Read `README.md`, this `AGENTS.md` and **all** `docs/*.md`, especially the repository-specific handover.
3. Run or review `npm run typecheck`, `npm test`, `npm run build`. If dependency lock is absent, run `npm install` first.
4. Prepare a brief implementation plan with acceptance conditions and files that will change.
5. Implement only the current agreed scope on a short-lived feature branch.
6. Add tests, update docs, run CI, review the PR diff and verify the merge state before claiming completion.
7. Do not merge changes that break the typecheck, unit tests, build, privacy rules or user-visible core functionality.
8. The owner has authorised non-destructive merges and subsequent deployments by default. Merge only after green required CI; verify Cloudflare production after merging. Production secrets, destructive changes or private data still require explicit approval.

## Source of truth and boundaries
- This repository owns its domain types and implementation. Shared Core's v0 contracts are **proposals**, not a migration mandate.
- Do not edit the Novel Library or other media repos from this session.
- Use stable opaque IDs, not titles, indexes, or provider-specific season labels as primary keys.
- Separate imported source metadata, private personal annotations, files and sync metadata.
- Domain complexity: Panel and page ordering, right-to-left versus left-to-right reading, vertical scrolling, chapter/volume structure, image dimensions, page preload limits and full-screen touch navigation.
- Model types: MangaEntry, MangaChapter, MangaProgress. See `src/domain/types.ts` and `docs/DATA_CONTRACTS.md`.
- Shared code is extracted only after a second consuming app demonstrates genuine reuse. Do not create runtime coupling to the hub.

## Safety and owner approvals
No secrets or sensitive content in commit history, tests, screenshots, logs, `.env.example` or `VITE_*` variables. Private media must be served through authorised private storage; do not assume that making a repository private protects public deployments. Do not bypass authentication, paywalls, DRM or third-party restrictions. Never delete private originals or rewrite large catalogues without explicit consent, dry-run, verified backup and revision check. Reject unsafe imports and untrusted URLs. Treat user-authored tags/comments as untrusted strings and never inject into the DOM as HTML.

## Engineering standards
Use TypeScript strict mode, pure domain helpers, explicit discriminated models, short independent modules, keyboard-accessible React components and responsive CSS. Make loading, empty, offline and error states truthful. Avoid unbounded in-memory media blobs or unnecessary network calls. Document performance budgets and measure when possible. UI controls must have useful actions, not decorative placeholders. Add accessible labels and test at 320/375/390/768/1280px when layout changes.

## Tests and quality gates
Unit tests cover edge cases, identity, ordering, partial data, malformed imports and regressions. Integration tests use a disposable private dataset or mocked adapter only. Browser tests should cover mobile/desktop, offline entry, keyboard navigation, privacy boundaries and failure behaviour. No paid external API calls from CI. A passing CI is necessary but not sufficient for user acceptance. Update `docs/TESTING.md` with new gates.

## Collaboration and reporting
Propose schema changes as versioned, backwards-compatible ADRs. Never silently modify Shared Core public exports or other repos. State what is implemented, tested, still planned, blocked and deployed. Document affected APIs, migration, rollback and any tests not run. Keep secrets and real personal media out of AI handovers. Preserve owner preference for an independent, aesthetically refined personal library without unnecessary architectural overhead.

## Hard stop conditions
Stop a destructive operation, forced push, production data migration, deletion of source files, disclosure of private media, unsanctioned external scraping, or authentication weakening pending explicit approval. Stop and ask for the specific required consent rather than guessing it.

## First engineering milestone
A read-only local catalogue with an explicit no-data state, a chapter manifest validator, and a page reader prototype using generated/owned fixture images.
**Definition of done:** Fixtures prove correct RTL/LTR page ordering, chapter transitions, resume on exact page, keyboard/touch operation and offline behaviour without exposing private image assets. Run all local checks and keep the production system unaffected.

## Visibility approval
The owner authorised public **source code** on 18 November 2026. This is not approval to publish private manga, private datasets, credentials or production access details. Actual GitHub API visibility still needs confirmation; the last report remained private.

## Approved UI specification, 19 November 2026
- Six visible shelves in exact order: Home, Currently Reading, Trying Out, Available Offline, Finished, All Manga. Previous To Be Read entries are still preserved internally. Analytics lives under the bookmarkable Master Controls view and needs no separate password; private catalogue management remains authenticated.
- Mobile displays Currently Reading, Trying Out, Available Offline and a More menu, with no duplicated live links.
- Six themes: Sepia (default), Paper, Charcoal, Midnight, Ocean, Plum. Persist selection; an open menu must not mutate it.
- The Taiyou Sun artwork is approved and must remain transparent. Use the theme-specific mark, favicon and PWA icons; footer says Created by Taiyou.
- Reader displays ALL images in one vertical scroll. Previous/Next navigate CHAPTERS only; bottom-centre chapter selector.
- Personal reading shelf values and publication statuses are independent; shelf state is device-local pending secure cloud sync.
- Use diagonal text ribbons on covers. No "Unrated" labels, browser-native confirms or fake connectivity.
- Merge and deploy once CI passes unless the owner explicitly asks to stop. Preserve real user progress, downloaded images and rollback compatibility.

## Novel Library is the authoritative UI design reference (21 November 2026)

**Do not approximate or redesign already-approved Novel Library interface details.**
For every Manga UI change, inspect the corresponding **current** source under
`AdityaSreevatsaK/Taiyous-Personal-Library/src/components/` and its CSS.
Reuse exact Lucide SVGs, spacing, component composition, focus/mobile behaviour,
control placement and footer text layout. Adapt only the Manga-specific
data/IDs, chapter image reader and private Hugging Face integration.

- **Catalogue header:** Approved sun and title, the 25px/1.9-stroke Lucide cloud
  immediately after the wordmark (not silently moved to the far right), with a
  green/red dot inside. Theme controls belong in the opposite header tools.
- **Manga details header:** Mirror Novel's `BookDetails.tsx` dedicated small
  header, not the oversized catalogue masthead. Sun mark 32px, title-case brand,
  centred `QuickNavigation`, compact theme picker. Novel's details header has
  no cloud control; cloud settings remain reachable from the catalogue/reader.
- **Details cards:** Follow Novel's `details-section-header` hierarchy and
  *real* Lucide Bookmark, Info, Tag, Star, LockKeyhole, List and Pencil glyphs,
  not glyph substitutes or blank ornament spans. Preserve semantics and actions.
- **Layout:** Reuse Novel's grid proportions, card spacing, serif typography,
  compact scrollable synopsis and responsive breakpoints; preserve manga-only
  concepts. Never remove a functional manga control just for visual matching.
- **Footer:** Centred `© [year] Taiyou's Personal Manga Library · Created by Taiyou`,
  not debug statements such as cloud-sync limitations or hub independence.
- **Master Controls:** Use Novel's Settings2 symbol, direct navigation and
  accessible analytics section; no separate analytics password.
- **Regression gates:** Assert paths/size/stroke/placement, real icon paths,
  mobile and split-screen widths (320, 390, 768, 1280), keyboard focus and
  footer behaviour. CI DOM assertions alone do not establish pixel-perfect
  parity: inspect representative screenshots when possible.
- **Private data:** Never modify Novel Library or either private dataset while
  porting UI. Keep Manga OAuth, source metadata, downloads, progress and IDs.

See `docs/NOVEL_LIBRARY_UI_PARITY_2026-11-20.md` (historical audit plus
21 November source-driven addendum).

## Personal metadata acceptance
Keep personal rating, notes, tags and shelves strictly in device-local versioned stores until reviewed server-side authorisation. Do not expose them in public static fixtures, telemetry, assets or URLs. Reader and publication statuses must stay independent. All destructive personal data operations require an application confirmation, not a browser alert. Treat invalid existing storage as immutable recovery evidence.

## Nested collections constraints
Treat collection IDs as immutable; preserve the tree on invalid data, reject cyclic reparenting and same-parent duplicates, protect writes by revision, and require an app dialog before deleting a collection subtree or membership. Never delete manga image bytes or reading progress as a side effect of collection operations. Deploy after green CI/merge.

## Advanced discovery and analytics
Never fabricate reading durations, streaks or completed chapters from a single latest-position record. Statistics must derive from validated local progress, personal ratings and actual offline chapter inventory only. Preserve bookmarkable /library filter query strings and Back/Forward behaviour. Advanced search is local-only, never an external metadata or personal-data request.

## Private media security gate (ADR 007)
The typed authorisation/data port is explicitly disabled and is not backend implementation. Never switch it to real network access without independent per-origin OAuth, server-side object-level authorisation, verified rights, secret isolation, path/MIME/size validation, CSRF protection on mutations, revisioned writes and a disposable-data integration test. Do not embed HF dataset tokens or private image URLs anywhere in frontend assets.
