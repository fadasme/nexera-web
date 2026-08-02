/**
 * Fachada de base de datos. El resto del código importa SOLO de aquí.
 * '@driver/db' se resuelve por alias de Vite según DEPLOY_TARGET:
 *   node       → ./db.mysql.ts
 *   cloudflare → ./db.d1.ts
 */
export { saveContacto, countRecentByIpHash } from '@driver/db';
export type { DbEnv, NuevoContacto } from './types';
