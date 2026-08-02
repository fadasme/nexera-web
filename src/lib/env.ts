import { getRuntimeEnv } from '@runtime/env';

/**
 * Trampa de portabilidad nº2: este helper es el ÚNICO punto de acceso a
 * secretos del runtime. El alias de build resuelve:
 *   - Workers → `env` de cloudflare:workers
 *   - Node    → process.env
 * Las PUBLIC_* son la excepción: van por import.meta.env (inline de Vite).
 */
export type Env = Record<string, unknown>;

export function getEnv(_locals: App.Locals): Env {
  return getRuntimeEnv();
}

export function envStr(env: Env, key: string): string | undefined {
  const v = env[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export function envNum(env: Env, key: string, fallback: number): number {
  const v = Number(envStr(env, key));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
