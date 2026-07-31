/**
 * IP real del cliente:
 *   - Cloudflare → CF-Connecting-IP
 *   - detrás de nginx → primer valor de X-Forwarded-For
 *   - fallback → clientAddress del adapter (lazy, puede lanzar)
 */
export function getClientIp(
  request: Request,
  fallback?: () => string | undefined,
): string | undefined {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();

  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  try {
    return fallback?.();
  } catch {
    return undefined;
  }
}

/** SHA-256 hex vía Web Crypto: idéntico en Node 20+ y Workers. */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
