import "server-only";
import { betterAuth } from "better-auth";
import { passkey } from "@better-auth/passkey";
import { Pool } from "pg";
import { twoFactor } from "better-auth/plugins";
import { sendAuthEmail } from "@/lib/auth-email";

const globalForAuth = globalThis as typeof globalThis & { grimoireAuthPool?: Pool };

const pool =
  globalForAuth.grimoireAuthPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") globalForAuth.grimoireAuthPool = pool;

export const auth = betterAuth({
  appName: "Grimoire",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  trustedOrigins: process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : undefined,
  database: pool,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
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
  emailVerification: {
    sendOnSignUp: true,
    expiresIn: 60 * 60,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: "Verifica tu correo de Grimoire",
        text: `Confirma tu correo para activar tu cuenta de Grimoire. Este enlace caduca en una hora:\n\n${url}\n\nSi no creaste la cuenta, ignora este correo.`,
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
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
    },
  },
  plugins: [
    twoFactor({ issuer: "Grimoire", allowPasswordless: true, twoFactorTable: "two_factor" }),
    passkey({
      rpID: process.env.PASSKEY_RP_ID?.trim() || new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").hostname,
      rpName: "Grimoire",
      origin: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    }),
  ],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
});
