import type { Env } from '@/lib/env';

export function getRuntimeEnv(): Env {
  return process.env as Env;
}
