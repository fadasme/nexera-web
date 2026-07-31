import type { APIRoute } from 'astro';
import { getEnv, envStr, envNum } from '@/lib/env';
import { getClientIp, sha256Hex } from '@/lib/ip';
import { contactoSchema, firstErrorCode, type ErrorCode } from '@/lib/schema';
import { verifyCaptcha } from '@/lib/captcha';
import { saveContacto, countRecentByIpHash, type NuevoContacto } from '@/lib/db';
import { sendContactoMail } from '@/lib/mail';

// Único código del proyecto que se ejecuta en el servidor.
export const prerender = false;

const MIN_MS = 3000; // time-trap: envíos más rápidos se descartan
const MAX_MS = 24 * 60 * 60 * 1000; // y formularios de más de 24 h también

function ok(request: Request): Response {
  if (request.headers.get('accept')?.includes('application/json')) {
    return Response.json({ ok: true });
  }
  return new Response(null, { status: 303, headers: { Location: '/gracias' } });
}

function fail(request: Request, code: ErrorCode, status: number): Response {
  if (request.headers.get('accept')?.includes('application/json')) {
    return Response.json({ ok: false, error: code }, { status });
  }
  return new Response(null, {
    status: 303,
    headers: { Location: `/?e=${code}#contacto` },
  });
}

export const POST: APIRoute = async (ctx) => {
  const { request } = ctx;
  const env = getEnv(ctx.locals);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(request, 'invalido', 400);
  }

  const get = (key: string): string => {
    const v = form.get(key);
    return typeof v === 'string' ? v : '';
  };

  // 1 · Honeypot: campo oculto lleno ⇒ éxito falso, se descarta.
  if (get('sitio_web') !== '') return ok(request);

  // 2 · Time-trap: solo se valida si _ts viene presente (lo pone JS al
  //     cargar; sin JS no viene y no bloquea al usuario legítimo).
  const ts = get('_ts');
  if (ts !== '') {
    const t = Number(ts);
    const delta = Date.now() - t;
    if (!Number.isFinite(t) || delta < MIN_MS || delta > MAX_MS) return ok(request);
  }

  // 3 · Validación Zod (límites espejo de los atributos HTML).
  const parsed = contactoSchema.safeParse({
    nombre: get('nombre'),
    email: get('email'),
    telefono: get('telefono'),
    empresa: get('empresa'),
    tamano_empresa: get('tamano_empresa'),
    servicio: get('servicio'),
    mensaje: get('mensaje'),
  });
  if (!parsed.success) return fail(request, firstErrorCode(parsed.error), 400);

  const ip = getClientIp(request, () => ctx.clientAddress);
  const ipHash = ip ? await sha256Hex(ip + (envStr(env, 'IP_HASH_SALT') ?? '')) : null;

  // 4 · Captcha (si está configurado; con 'none' no se valida nada).
  const captchaToken = get('cf-turnstile-response') || get('g-recaptcha-response') || null;
  if (!(await verifyCaptcha(env, captchaToken, ip))) {
    return fail(request, 'captcha', 400);
  }

  // 5 · Rate limit por ip_hash contra la propia tabla. Si el conteo
  //     falla (p. ej. DB caída) no bloqueamos: el guardado decidirá.
  if (ipHash) {
    try {
      const recientes = await countRecentByIpHash(
        env,
        ipHash,
        envNum(env, 'RATE_LIMIT_WINDOW', 3600),
      );
      if (recientes >= envNum(env, 'RATE_LIMIT_MAX', 5)) {
        return fail(request, 'limite', 429);
      }
    } catch (err) {
      console.error('[contacto] rate-limit no disponible:', err);
    }
  }

  let origen: string | null = null;
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const u = new URL(referer);
      origen = u.searchParams.get('utm_source') ?? u.host;
    } catch {
      origen = null;
    }
  }

  const contacto: NuevoContacto = {
    ...parsed.data,
    telefono: parsed.data.telefono ?? null,
    empresa: parsed.data.empresa ?? null,
    tamano_empresa: parsed.data.tamano_empresa ?? null,
    servicio: parsed.data.servicio ?? null,
    origen: origen?.slice(0, 120) ?? null,
    ip_hash: ipHash,
    user_agent: request.headers.get('user-agent')?.slice(0, 255) ?? null,
  };

  // 6 · Primero guardar en la base…
  try {
    await saveContacto(env, contacto);
  } catch (err) {
    console.error('[contacto] error guardando:', err);
    return fail(request, 'servidor', 500);
  }

  // 7 · …después el correo: si falla se registra, pero el lead ya está
  //     guardado y la respuesta al usuario sigue siendo exitosa.
  try {
    await sendContactoMail(env, contacto);
  } catch (err) {
    console.error('[contacto] correo falló (lead ya guardado):', err);
  }

  return ok(request);
};
