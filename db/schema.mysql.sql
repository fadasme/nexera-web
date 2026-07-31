-- Schema MySQL (target node / VPS)
-- utf8mb4 obligatorio: tildes, ñ, emoji.
CREATE TABLE IF NOT EXISTS contactos (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre         VARCHAR(120)  NOT NULL,
  email          VARCHAR(180)  NOT NULL,
  telefono       VARCHAR(40)   NULL,
  empresa        VARCHAR(160)  NULL,
  tamano_empresa VARCHAR(20)   NULL,
  servicio       VARCHAR(80)   NULL,
  mensaje        TEXT          NOT NULL,
  origen         VARCHAR(120)  NULL,      -- utm_source / referer
  ip_hash        CHAR(64)      NULL,      -- SHA-256 de IP + salt, nunca la IP en claro
  user_agent     VARCHAR(255)  NULL,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created (created_at),
  INDEX idx_email (email),
  INDEX idx_iphash_created (ip_hash, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
