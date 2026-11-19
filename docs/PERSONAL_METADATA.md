# Device-local personal annotations (19 November 2026)

Personal reading status and personal annotations are distinct from imported publication metadata.

- `taiyou-manga:personal-shelf:v1:<mangaId>`: Trying Out, Finished or To Be Read.
- `taiyou-manga:personal-annotation:v1:<mangaId>`: 1–10 personal rating, personal notes up to 5,000 characters, up to 24 unique case-insensitive Title Case personal tags (48 characters maximum).
- All records are JSON envelopes with `schemaVersion:1`, `mediaKind:'manga'` and immutable series IDs. Invalid existing data is preserved and never silently overwritten.
- Public fixture genres remain distinct from the personal tag collection. The UI lets users filter by either.
- No personal annotation is shipped in public JavaScript, logged to external analytics or synchronised to a provider.
- Browser storage can be evicted. Back up personal data before clearing site data. The v2 personal JSON export includes progress, reader settings, reading shelves, ratings, notes and tags. It does not contain manga images. The importer also accepts legacy v1 reader-only backups. Users explicitly opt in to personal metadata restoration. Existing nonempty shelves and newer personal annotations are never overwritten; invalid local data stays intact.

## Regression contract
Do not change continuous full-chapter scrolling, saved progress IDs, bounded image decode or explicit offline downloads. Never import a damaged record over valid local state.
