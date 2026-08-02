-- Schema D1 / SQLite (target cloudflare)
-- Misma forma lógica que db/schema.mysql.sql.
CREATE TABLE IF NOT EXISTS contactos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre         TEXT NOT NULL,
  email          TEXT NOT NULL,
  telefono       TEXT,
  empresa        TEXT,
  tamano_empresa TEXT,
  servicio       TEXT,
  mensaje        TEXT NOT NULL,
  origen         TEXT,             -- utm_source / referer
  ip_hash        TEXT,             -- SHA-256 de IP + salt, nunca la IP en claro
  user_agent     TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_created ON contactos (created_at);
CREATE INDEX IF NOT EXISTS idx_email ON contactos (email);
CREATE INDEX IF NOT EXISTS idx_iphash_created ON contactos (ip_hash, created_at);
