/** Cloudflare fija CF-Connecting-IP en el borde e ignora headers proxy del cliente. */
export function clientIpFromRequest(
  request: Request,
  direct: string | undefined,
): string | undefined {
  return request.headers.get('cf-connecting-ip')?.trim() || direct;
}
