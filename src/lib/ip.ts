import { clientIpFromRequest } from '@runtime/ip';

/**
 * IP real del cliente: el header que el target considera confiable
 * (`@runtime/ip`) o, si no hay, la dirección de la conexión directa.
 */
export function getClientIp(
  request: Request,
  fallback?: () => string | undefined,
): string | undefined {
  let direct: string | undefined;
  try {
    // `clientAddress` es perezoso en Astro y lanza si el adapter no lo expone.
    direct = fallback?.();
  } catch {
    direct = undefined;
  }
  return clientIpFromRequest(request, direct);
}

/** SHA-256 hex vía Web Crypto: idéntico en Node 22+ y Workers. */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
