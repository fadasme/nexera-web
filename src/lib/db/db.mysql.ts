/**
 * Driver MySQL — SOLO entra al bundle del target node
 * (alias @driver/db en astro.config.mjs).
 */
import mysql from 'mysql2/promise';
import type { DbEnv, NuevoContacto } from './types';

// Pool singleton a nivel de módulo: se crea una vez, no por request.
let pool: mysql.Pool | undefined;

function str(env: DbEnv, key: string): string | undefined {
  const v = env[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function getPool(env: DbEnv): mysql.Pool {
  if (!pool) {
    const host = str(env, 'MYSQL_HOST');
    const user = str(env, 'MYSQL_USER');
    const database = str(env, 'MYSQL_DATABASE');
    if (!host || !user || !database) {
      throw new Error(
        'MySQL sin configurar: faltan MYSQL_HOST / MYSQL_USER / MYSQL_DATABASE (corre `npm run setup`).',
      );
    }
    pool = mysql.createPool({
      host,
      port: Number(str(env, 'MYSQL_PORT') ?? 3306),
      user,
      password: str(env, 'MYSQL_PASSWORD') ?? '',
      database,
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 5,
    });
  }
  return pool;
}

export async function saveContacto(env: DbEnv, c: NuevoContacto): Promise<void> {
  await getPool(env).execute(
    `INSERT INTO contactos
       (nombre, email, telefono, empresa, tamano_empresa, servicio, mensaje, origen, ip_hash, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
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
    ],
  );
}

export async function countRecentByIpHash(
  env: DbEnv,
  ipHash: string,
  windowSec: number,
): Promise<number> {
  const [rows] = await getPool(env).execute(
    'SELECT COUNT(*) AS n FROM contactos WHERE ip_hash = ? AND created_at > NOW() - INTERVAL ? SECOND',
    [ipHash, windowSec],
  );
  const first = (rows as Array<{ n: number | string }>)[0];
  return Number(first?.n ?? 0);
}
