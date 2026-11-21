# Personal manga metadata

Personal reading state is separate from imported publication metadata and remains local to the current browser/device.

## Personal records

- Shelf key: taiyou-manga:personal-shelf:v1:<mangaId>. Values are Trying Out, Finished or legacy To Be Read. Currently Reading is derived from saved progress and shelf overrides.
- Annotation key: taiyou-manga:personal-annotation:v1:<mangaId>. Fields include a 1–10 personal rating, notes (maximum 5,000 characters), up to 24 unique personal tags (48 characters maximum), optional favourite and explicit completed chapter IDs.
- Reader progress and preferences use their own versioned keys.
- Nested collections use a revisioned collection document.
- Personal synopsis edits are local overrides; they do not update the private HF source synopsis.

Imported source genres/tags, creator metadata and publication status are not overwritten by personal tags or shelf changes. Source publication status is displayed with a ribbon and remains independent of personal Finished state.

## Completion semantics

- A manga is personally Finished only after an explicit shelf action.
- A chapter is complete only after an explicit chapter-completion action.
- Scrolling to the end or saving a last-page position does not automatically mark a chapter/manga complete.
- Publication status completed does not mark the personal shelf Finished.

## Privacy and backup

Personal records remain in localStorage. They are not uploaded to Hugging Face and are not included in the public static bundle. The version-2 manual JSON backup includes progress, preferences, shelves, annotations and optional collections, but no images, private media or credentials.

Keep backup files private. Browser storage can be cleared or evicted. Invalid local records are preserved as recovery evidence. Import is a validated merge, not a replace-all operation.

The protected Master source editor is separate: it can correct title, creators and publicationStatus in the private catalogue after owner verification and HF write scope. It does not sync personal annotations or synopsis overrides.

See docs/LOCAL_PERSISTENCE.md, docs/COLLECTIONS.md and docs/DATA_CONTRACTS.md.
