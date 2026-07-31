/**
 * Router de correo por MAIL_PROVIDER: resend (HTTP, ambos targets),
 * smtp (@driver/smtp: nodemailer en node, stub en cloudflare), none.
 */
import { envStr, type Env } from '../env';
import type { NuevoContacto } from '../db/types';
import type { MailMessage } from './types';
import { sendSmtp } from '@driver/smtp';

function componer(env: Env, c: NuevoContacto): MailMessage | null {
  const to = envStr(env, 'MAIL_TO');
  if (!to) {
    console.error('[mail] MAIL_PROVIDER activo pero falta MAIL_TO; no se envía');
    return null;
  }
  const lines = [
    `Nombre: ${c.nombre}`,
    c.empresa ? `Empresa: ${c.empresa}` : null,
    c.tamano_empresa ? `Tamaño de empresa: ${c.tamano_empresa}` : null,
    c.servicio ? `Servicio de interés: ${c.servicio}` : null,
    `Email: ${c.email}`,
    c.telefono ? `Teléfono: ${c.telefono}` : null,
    c.origen ? `Origen: ${c.origen}` : null,
    '',
    c.mensaje,
  ].filter((l): l is string => l !== null);

  return {
    from: envStr(env, 'MAIL_FROM') ?? 'Nexera <no-reply@localhost>',
    to,
    subject: `Nuevo contacto: ${c.nombre}`,
    text: lines.join('\n'),
    replyTo: c.email,
  };
}

export async function sendContactoMail(env: Env, c: NuevoContacto): Promise<void> {
  const provider = envStr(env, 'MAIL_PROVIDER') ?? 'none';
  if (provider === 'none') return;

  const msg = componer(env, c);
  if (!msg) return;

  if (provider === 'resend') {
    const key = envStr(env, 'RESEND_API_KEY');
    if (!key) {
      console.error('[mail] MAIL_PROVIDER=resend pero falta RESEND_API_KEY; no se envía');
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: msg.from,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        reply_to: msg.replyTo,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend respondió ${res.status}: ${await res.text()}`);
    }
    return;
  }

  if (provider === 'smtp') {
    await sendSmtp(env, msg);
    return;
  }

  console.error(`[mail] MAIL_PROVIDER desconocido: "${provider}"; no se envía`);
}
