-- Who may edit. Created on first magic-link sign-in.
CREATE TABLE user (
  id         TEXT NOT NULL PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  color      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen  TEXT
);

-- A magic link. Stored hashed; single use; 20 minute life.
CREATE TABLE login_token (
  token_hash TEXT NOT NULL PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);
CREATE INDEX idx_login_token_expires ON login_token (expires_at);
