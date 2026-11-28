# Manga Reading Journal: foundation candidate

Status: partially implemented on the feature branch; not deployed or accepted.
Base: 2e210f17014a5e305b4da8a574d329ee851c7491. No changes to media or browser-local personal state.

## Separation and API

Journal IDs are jrn_ plus 32 lowercase hexadecimal characters, independent of Controller IDs.
The dedicated D1 migration is migrations/journal/0001_journal.sql. The proposed runtime binding is JOURNAL_DB.
The server accepts a sealed, unexpired exact-owner session and does not ask HF for the dataset or write scope.
All responses are private no-store. Mutations require the production Origin, JSON and X-Taiyou-Request: journal.
Existing login still checks HF dataset access; a fresh login during dataset outage is not supported by this foundation.
Existing session expiry bounds revocation; fresh owner verification strategy needs review before release.

- GET /api/journal: 100 active records per page, optional after cursor; deleted=true lists tombstones.
- POST /api/journal: validated fields; server generates identity/timestamps.
- PATCH /api/journal/:id: revision plus editable field patch; restore:true restores a tombstone.
- DELETE /api/journal/:id: JSON revision, soft delete only.
- Stale revision or duplicate active archive link returns 409. No automatic title matching.
- An archive link is syntax validated, not evidence of current availability. UI reconciliation is pending.
- Unknown chapter counts and ratings remain null; a real zero is preserved. Publication and reading statuses are separate.

## Before enabling

Do not create or bind production D1, apply migrations, change OAuth, or import real reading history without explicit operational authorisation.
Use an isolated disposable test database and synthetic fixtures first. Validate the actual Pages routing, real D1 CRUD, concurrent edits, tombstone restore, backup/export/recovery, API non-caching and owner session acceptance. Never log private rows.
Production-only origin checks are inherited from the app; test through isolated synthetic requests, not production credentials.
A lazy-loaded /journal route provides core list/search/filter/sort, editable records, explicit soft removal/restore, archive links and client-side JSON/CSV export of the loaded active or removed records. No data is saved in localStorage. The CSV import candidate below supports additions-only batches; XLSX, full backup/recovery round trip, conflict updates, external provider, local-data reconciliation and browser acceptance remain follow-up work. The UI does not yet edit external metadata IDs.
Rollback the code by reverting its PR; no production migration has been applied. Once provisioned, retain database backups and tombstones rather than dropping tables.

## CSV import candidate
The generic CSV parser supports quoted cells, manual column mapping, physical source-row numbers, explicit status normalisation and null counts. It rejects malformed cells and formula-like mapped values. The client identifies duplicate candidates across the uploaded file; the server checks existing titles and aliases including removed entries. Import is additions-only; existing or ambiguous rows are not changed. The dedicated 0002 migration creates an atomic change counter and receipt. Each confirmed batch is limited to 50 rows and the existing 64 KiB request limit. Retry of the same canonical batch returns its receipt. A changed database revision invalidates the preview. The D1 batch transaction must be verified in a disposable database before release. No XLSX dependency or final real-file mapping is supplied yet. No complete backup restore or conflict-update flow is claimed.
