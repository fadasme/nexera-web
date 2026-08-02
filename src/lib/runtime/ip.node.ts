/**
 * Astro valida los headers del proxy contra `security.allowedDomains` y
 * expone la IP resuelta como `clientAddress`. El proceso Node se mantiene
 * detrás del listener loopback definido en systemd/nginx.
 */
export function clientIpFromRequest(
  _request: Request,
  direct: string | undefined,
): string | undefined {
  return direct;
}
