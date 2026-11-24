/**
 * Which SMTP server the authentication emails go through, read from the environment (SMTP_HOST, SMTP_PORT,
 * SMTP_USER, SMTP_PASSWORD, SMTP_FROM; see .env.example). Pure (no nodemailer, no process.env) so it can be
 * unit-tested; sending is in auth-email.ts.
 */

/** Connection options handed to nodemailer's SMTP transport. */
export interface SmtpTransportOptions {
  host: string;
  port: number;
  /** TLS from the first byte (port 465); other ports upgrade with STARTTLS when the server offers it. */
  secure: boolean;
  auth?: { user: string; pass: string };
}

export interface SmtpSettings {
  /** Sender of every authentication email. */
  from: string;
  transport: SmtpTransportOptions;
}

const DEFAULT_PORT = "587";

/**
 * The SMTP settings, or null when email is switched off: no host, no sender, or a port that is not a whole
 * number from 1 to 65535. Credentials are sent only when both the user and the password are set.
 */
export function smtpSettings(env: Readonly<Record<string, string | undefined>>): SmtpSettings | null {
  const host = env.SMTP_HOST;
  const from = env.SMTP_FROM;
  const port = Number(env.SMTP_PORT ?? DEFAULT_PORT);
  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) return null;

  const user = env.SMTP_USER;
  const pass = env.SMTP_PASSWORD;
  return { from, transport: { host, port, secure: port === 465, ...(user && pass ? { auth: { user, pass } } : {}) } };
}
