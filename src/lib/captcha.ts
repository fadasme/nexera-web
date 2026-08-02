import { envStr, type Env } from './env';

const ENDPOINTS = {
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  recaptcha: 'https://www.google.com/recaptcha/api/siteverify',
} as const;

/**
 * Verificación server-side del captcha. Con provider 'none' (o ausente)
 * no se valida nada. El provider es constante de build (PUBLIC_*): así
 * coincide siempre con el widget que renderizó el cliente.
 */
export async function verifyCaptcha(
  env: Env,
  token: string | null,
  ip?: string,
): Promise<boolean> {
  const provider = import.meta.env.PUBLIC_CAPTCHA_PROVIDER ?? 'none';
  if (provider === 'none') return true;
  if (provider !== 'turnstile' && provider !== 'recaptcha') {
    console.error(`[captcha] provider desconocido: "${provider}"; envío rechazado`);
    return false;
  }

  const secret = envStr(env, 'CAPTCHA_SECRET');
  if (!secret) {
    console.error('[captcha] provider configurado pero falta CAPTCHA_SECRET; envío rechazado');
    return false;
  }
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);

  try {
    const res = await fetch(ENDPOINTS[provider], {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error('[captcha] error verificando:', err);
    return false;
  }
}
