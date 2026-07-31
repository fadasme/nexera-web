/**
 * Trampa de portabilidad nº2: las variables de entorno se leen distinto
 * en cada runtime. Este helper es el ÚNICO punto de acceso:
 *   - Workers → locals.runtime.env (inyectado por @astrojs/cloudflare)
 *   - Node    → process.env
 * Las PUBLIC_* son la excepción: van por import.meta.env (inline de Vite).
 */
export type Env = Record<string, unknown>;

export function getEnv(locals: App.Locals): Env {
  if (locals.runtime?.env) return locals.runtime.env;
  return typeof process !== 'undefined' ? (process.env as Env) : {};
}

export function envStr(env: Env, key: string): string | undefined {
  const v = env[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export function envNum(env: Env, key: string, fallback: number): number {
  const v = Number(envStr(env, key));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
