export interface NuevoContacto {
  nombre: string;
  email: string;
  telefono?: string | null;
  empresa?: string | null;
  tamano_empresa?: string | null;
  servicio?: string | null;
  mensaje: string;
  origen?: string | null;
  ip_hash?: string | null;
  user_agent?: string | null;
}

/** Entorno de servidor: process.env (node) o locals.runtime.env (cloudflare). */
export type DbEnv = Record<string, unknown>;
