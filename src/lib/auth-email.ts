import "server-only";
import nodemailer from "nodemailer";

type AuthEmail = {
  to: string;
  subject: string;
  text: string;
};

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM;
  const port = Number(process.env.SMTP_PORT ?? "587");

  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_HOST, SMTP_PORT and SMTP_FROM must be configured to send authentication emails.");
  }

  if (!transporter) {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
  }

  return { transporter, from };
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
