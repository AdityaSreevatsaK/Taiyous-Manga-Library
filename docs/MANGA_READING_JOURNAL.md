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
This foundation does not supply a Journal route, UI, spreadsheet parser, idempotent import, export, metadata enrichment, or local-data reconciliation. These remain follow-up work and are required before release.
Rollback the code by reverting its PR; no production migration has been applied. Once provisioned, retain database backups and tombstones rather than dropping tables.
