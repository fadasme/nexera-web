/**
 * Driver SMTP (nodemailer) — SOLO entra al bundle del target node
 * (alias @driver/smtp en astro.config.mjs).
 */
import nodemailer from 'nodemailer';
import { envStr, type Env } from '../env';
import type { MailMessage } from './types';

export async function sendSmtp(env: Env, msg: MailMessage): Promise<void> {
  const host = envStr(env, 'SMTP_HOST');
  if (!host) throw new Error('MAIL_PROVIDER=smtp pero falta SMTP_HOST');

  const user = envStr(env, 'SMTP_USER');
  const transporter = nodemailer.createTransport({
    host,
    port: Number(envStr(env, 'SMTP_PORT') ?? 587),
    secure: envStr(env, 'SMTP_SECURE') === 'true',
    auth: user ? { user, pass: envStr(env, 'SMTP_PASS') ?? '' } : undefined,
  });

  await transporter.sendMail({
    from: msg.from,
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    replyTo: msg.replyTo,
  });
}
