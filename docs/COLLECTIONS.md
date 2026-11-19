# Personal collections: architecture and scope

- One versioned browser-local collection document at `taiyou-manga:personal-collections:v1`, storing revision, stable collection IDs, parent links and manga IDs.
- Create, rename, move and confirmed subtree deletion with a hard ban on parent cycles, missing parents, duplicate sibling names, duplicate IDs and duplicate memberships.
- Direct Add to Collection on Manga Details shows existing memberships and a green success toast; removal requires a separate application confirmation.
- All Manga and header Collections dropdown can filter imported sample labels or personal collections.
- Deleting a collection never deletes manga, reader progress, notes or offline downloads.
- Revision-guarded updates detect stale tabs, though cross-tab writes are still best-effort, not transactional cloud sync.
- v2 personal backup now optionally includes the validated nested collection tree. Import never overwrites existing collections; new IDs are merged when parents exist and names do not conflict. Older v1 progress-only and v2 pre-collection backups remain supported. Real-time cross-device sync is not implemented.
