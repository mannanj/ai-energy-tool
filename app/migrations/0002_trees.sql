CREATE TABLE tree (
  id         TEXT NOT NULL PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  pdf_key    TEXT
);
INSERT INTO tree (id, name, created_at, created_by, pdf_key) VALUES ('main', 'Rates went up (example)', '2026-09-26T00:00:00.000Z', 'seed', NULL);
