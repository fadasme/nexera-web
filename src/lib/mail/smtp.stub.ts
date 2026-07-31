/**
 * Stub de SMTP para el target cloudflare: nodemailer no corre en Workers.
 * `npm run setup` nunca ofrece smtp en cloudflare; llegar aquí es un
 * error de configuración manual.
 */
import type { Env } from '../env';
import type { MailMessage } from './types';

export async function sendSmtp(_env: Env, _msg: MailMessage): Promise<void> {
  throw new Error(
    'SMTP no está disponible en el target cloudflare (nodemailer no corre en Workers); usa MAIL_PROVIDER=resend o none.',
  );
}
