import { describe, expect, it } from "vitest";
import { smtpSettings } from "./auth-email-config.js";

// Placeholders only: never a real server, sender or credential.
const HOST = "smtp.example.invalid";
const FROM = "Grimoire <no-reply@example.invalid>";
const USER = "placeholder-user";
const PASSWORD = "placeholder-password";
const minimal = { SMTP_HOST: HOST, SMTP_FROM: FROM };

describe("smtpSettings", () => {
  it("needs a host and a sender, and defaults to port 587 without TLS from the start", () => {
    expect(smtpSettings(minimal)).toEqual({ from: FROM, transport: { host: HOST, port: 587, secure: false } });
  });

  it("switches email off without a host or a sender", () => {
    expect(smtpSettings({})).toBeNull();
    expect(smtpSettings({ SMTP_FROM: FROM })).toBeNull();
    expect(smtpSettings({ SMTP_HOST: HOST })).toBeNull();
    expect(smtpSettings({ SMTP_HOST: "", SMTP_FROM: FROM })).toBeNull();
    expect(smtpSettings({ SMTP_HOST: HOST, SMTP_FROM: "" })).toBeNull();
  });

  it("switches email off when the port is not a whole number from 1 to 65535", () => {
    for (const SMTP_PORT of ["", "0", "65536", "-25", "587.5", "smtp"]) {
      expect(smtpSettings({ ...minimal, SMTP_PORT })).toBeNull();
    }
    expect(smtpSettings({ ...minimal, SMTP_PORT: "1" })?.transport.port).toBe(1);
    expect(smtpSettings({ ...minimal, SMTP_PORT: "65535" })?.transport.port).toBe(65535);
  });

  it("uses implicit TLS on port 465 only", () => {
    expect(smtpSettings({ ...minimal, SMTP_PORT: "465" })?.transport).toEqual({ host: HOST, port: 465, secure: true });
    expect(smtpSettings({ ...minimal, SMTP_PORT: "2525" })?.transport.secure).toBe(false);
  });

  it("signs in only when both the user and the password are set", () => {
    expect(smtpSettings({ ...minimal, SMTP_USER: USER, SMTP_PASSWORD: PASSWORD })?.transport.auth).toEqual({ user: USER, pass: PASSWORD });
    expect(smtpSettings({ ...minimal, SMTP_USER: USER })?.transport).not.toHaveProperty("auth");
    expect(smtpSettings({ ...minimal, SMTP_PASSWORD: PASSWORD })?.transport).not.toHaveProperty("auth");
    expect(smtpSettings({ ...minimal, SMTP_USER: "", SMTP_PASSWORD: PASSWORD })?.transport).not.toHaveProperty("auth");
  });
});
