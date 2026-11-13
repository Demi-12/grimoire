import "server-only";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { passkey } from "@better-auth/passkey";
import { twoFactor } from "better-auth/plugins";
import { sendAuthEmail } from "@/lib/auth-email";
import { pool } from "@/lib/db";
import { parseAdminEmails } from "@/lib/permissions";

const baseURL = process.env.BETTER_AUTH_URL?.trim() || "http://localhost:3000";
/** Extra origins allowed to sign in, e.g. the LAN address alongside a public HTTPS URL. */
const extraOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
  .split(",").map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean);

/** Without SMTP (e.g. a fresh home server) accounts work but password reset by email is off. */

export const auth = betterAuth({
  appName: "Grimoire",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins: [...new Set([baseURL, ...extraOrigins])],
  database: pool,
  user: {
    // Managed only by the server (sign-up hook and admin panel); clients can't set them.
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "player", input: false },
      status: { type: "string", required: false, defaultValue: "pending", input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // New accounts wait for an admin, except the owners listed in GRIMOIRE_ADMIN_EMAILS.
          const isOwner = parseAdminEmails(process.env.GRIMOIRE_ADMIN_EMAILS).has(user.email.toLowerCase());
          return { data: { ...user, role: isOwner ? "admin" : "user", status: isOwner ? "approved" : "pending" } };
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const result = await pool.query<{ status: string }>('SELECT "status" FROM "user" WHERE "id" = $1', [session.userId]);
          if (result.rows[0]?.status === "blocked") {
            throw new APIError("FORBIDDEN", { message: "This account has been blocked by an administrator." });
          }
          return { data: session };
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 30 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: "Restablece tu contraseña de Grimoire",
        text: `Has solicitado restablecer la contraseña de tu cuenta de Grimoire. Abre este enlace antes de 30 minutos y úsalo una sola vez:\n\n${url}\n\nSi no lo solicitaste, ignora este correo.`,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      // Read-only and called on every page load, tab focus and sign-in step. Throttling it (100/min per IP by
      // default, and per *proxy* IP if the client IP isn't resolved) made signed-in people look signed out.
      "/get-session": false,
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
    },
  },
  plugins: [
    twoFactor({ issuer: "Grimoire", allowPasswordless: true, twoFactorTable: "two_factor" }),
    passkey({
      rpID: process.env.PASSKEY_RP_ID?.trim() || new URL(baseURL).hostname,
      rpName: "Grimoire",
      origin: baseURL,
    }),
  ],
  advanced: {
    // Browsers drop Secure cookies over plain HTTP (e.g. http://192.168.x.x:3000), which would break sign-in.
    useSecureCookies: baseURL.startsWith("https://"),
    // Client IP for rate limits. Behind the Cloudflare tunnel, CF-Connecting-IP is the visitor (one value, set by
    // Cloudflare); X-Forwarded-For can hold a chain, which better-auth rejects, so every visitor would share one
    // bucket. Without either (LAN, `next dev`), Next fills X-Forwarded-For with the socket address.
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] },
  },
});
