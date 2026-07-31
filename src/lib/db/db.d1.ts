/**
 * Driver D1 — SOLO entra al bundle del target cloudflare
 * (alias @driver/db en astro.config.mjs).
 *
 * Tipos D1 declarados localmente para no arrastrar los tipos globales
 * de @cloudflare/workers-types al chequeo del target node.
 */
import type { DbEnv, NuevoContacto } from './types';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
  first<T = unknown>(colName?: string): Promise<T | null>;
}

interface D1Like {
  prepare(query: string): D1PreparedStatement;
}

function getDb(env: DbEnv): D1Like {
  const db = env.DB as D1Like | undefined;
  if (!db || typeof db.prepare !== 'function') {
    throw new Error(
      'Binding D1 "DB" no disponible: revisa wrangler.jsonc (corre `npm run setup`).',
    );
  }
  return db;
}

export async function saveContacto(env: DbEnv, c: NuevoContacto): Promise<void> {
  await getDb(env)
    .prepare(
      `INSERT INTO contactos
         (nombre, email, telefono, empresa, tamano_empresa, servicio, mensaje, origen, ip_hash, user_agent)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    )
    .bind(
      c.nombre,
      c.email,
      c.telefono ?? null,
      c.empresa ?? null,
      c.tamano_empresa ?? null,
      c.servicio ?? null,
      c.mensaje,
      c.origen ?? null,
      c.ip_hash ?? null,
      c.user_agent ?? null,
    )
    .run();
}

export async function countRecentByIpHash(
  env: DbEnv,
  ipHash: string,
  windowSec: number,
): Promise<number> {
  const n = await getDb(env)
    .prepare(
      "SELECT COUNT(*) AS n FROM contactos WHERE ip_hash = ?1 AND created_at > datetime('now', ?2)",
    )
    .bind(ipHash, `-${windowSec} seconds`)
    .first<number>('n');
  return Number(n ?? 0);
}
