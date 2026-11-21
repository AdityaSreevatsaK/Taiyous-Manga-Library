# Personal collections

Collections are a browser-local organisation feature, separate from imported source collection labels and the private HF catalogue.

## Storage model

One versioned document is stored at taiyou-manga:personal-collections:v1. It contains schemaVersion, mediaKind, a monotonically increasing local revision and an array of records with:

- Stable collection ID.
- Name.
- Parent collection ID or null.
- Manga ID membership list.

## Behaviour and invariants

- Create, rename, move, add/remove manga membership and delete a collection subtree.
- IDs are immutable; names are display values.
- Reject duplicate IDs, missing parents, duplicate sibling names, duplicate memberships and cyclic parent relationships.
- Writes compare the expected revision and fail on stale state.
- Invalid stored collection data is preserved rather than silently replaced.
- Removing a manga membership does not delete the manga, original media, progress, notes, ratings, tags or offline sample downloads.
- Deleting a collection subtree requires an in-app confirmation and does not cascade into manga or personal records.
- Collection filtering is performed locally against the already-loaded catalogue and the local membership document.

The version-2 personal JSON backup can include the validated nested collection tree. Import merges compatible collection IDs and preserves existing/conflicting local collections; older v1 and pre-collection v2 backups remain supported.

Collections are not synchronised across devices. Manual JSON backup/restore is the current transfer path.
