-- Dedicated Journal database only. Never apply to a media store.
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36 AND substr(id, 1, 4) = 'jrn_'),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  library_manga_id TEXT,
  payload TEXT NOT NULL CHECK (json_valid(payload) AND json_type(payload) = 'object')
);
CREATE UNIQUE INDEX IF NOT EXISTS journal_active_library_link
  ON journal_entries(library_manga_id)
  WHERE deleted_at IS NULL AND library_manga_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS journal_active_id
  ON journal_entries(id) WHERE deleted_at IS NULL;
