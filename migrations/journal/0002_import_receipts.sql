-- A single monotonically increasing change counter protects import preview/commit.
CREATE TABLE IF NOT EXISTS journal_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  revision INTEGER NOT NULL CHECK (revision >= 0)
);
INSERT OR IGNORE INTO journal_state VALUES (1, 0);
CREATE TRIGGER IF NOT EXISTS journal_insert_revision AFTER INSERT ON journal_entries
BEGIN UPDATE journal_state SET revision = revision + 1 WHERE singleton = 1; END;
CREATE TRIGGER IF NOT EXISTS journal_update_revision AFTER UPDATE ON journal_entries
BEGIN UPDATE journal_state SET revision = revision + 1 WHERE singleton = 1; END;
CREATE TABLE IF NOT EXISTS journal_import_receipts (
  batch_id TEXT PRIMARY KEY NOT NULL,
  entry_count INTEGER NOT NULL CHECK (entry_count BETWEEN 1 AND 50),
  committed_at TEXT NOT NULL,
  snapshot_valid INTEGER NOT NULL CHECK (snapshot_valid = 1)
);
