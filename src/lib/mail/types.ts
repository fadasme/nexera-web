export interface MailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}
