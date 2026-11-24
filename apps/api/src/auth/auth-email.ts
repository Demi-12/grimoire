/**
 * Sends the authentication emails (password reset) through SMTP, never throwing and never logging their
 * content. Which server, sender and credentials come from auth-email-config.ts; the bodies from
 * auth-email-templates.ts.
 */
import nodemailer from "nodemailer";
import { smtpSettings } from "./auth-email-config.js";

type AuthEmail = {
  to: string;
  subject: string;
  text: string;
  /** Optional rich version; the plain-text part is always sent for clients that block HTML. */
  html?: string;
};

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;

function getTransporter() {
  const settings = smtpSettings(process.env);
  if (!settings) {
    throw new Error("SMTP_HOST, SMTP_PORT and SMTP_FROM must be configured to send authentication emails.");
  }
  // Created once, with the settings of the first email sent.
  transporter ??= nodemailer.createTransport(settings.transport);
  return { transporter, from: settings.from };
}

export function sendAuthEmail(message: AuthEmail) {
  try {
    const { transporter: mailer, from } = getTransporter();
    void mailer.sendMail({ ...message, from }).catch(() => {
      // Never log message bodies, reset URLs, recipient addresses, or SMTP details.
      console.error("Grimoire could not dispatch an authentication email.");
    });
  } catch {
    // Keep reset and registration responses independent of address existence/configuration.
    console.error("Grimoire authentication email is not configured.");
  }
}
