import { env } from 'cloudflare:workers';

import type { Env } from '@/lib/env';

export function getRuntimeEnv(): Env {
  return env as Env;
}
