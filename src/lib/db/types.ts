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

/** Entorno de servidor: process.env (Node) o cloudflare:workers env (Workers). */
export type DbEnv = Record<string, unknown>;
