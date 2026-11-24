import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Only the network edge is replaced: nodemailer's transport records what it would have sent.
const smtp = vi.hoisted(() => ({
  created: [] as unknown[],
  sent: [] as unknown[],
  fail: false,
}));
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn((options: unknown) => {
      smtp.created.push(options);
      return {
        sendMail: vi.fn(async (mail: unknown) => {
          smtp.sent.push(mail);
          if (smtp.fail) throw new Error("connection refused by smtp.example.invalid");
        }),
      };
    }),
  },
}));

// Placeholders only: never a real server, sender or credential.
const SMTP = {
  SMTP_HOST: "smtp.example.invalid",
  SMTP_FROM: "Grimoire <no-reply@example.invalid>",
  SMTP_USER: "placeholder-user",
  SMTP_PASSWORD: "placeholder-password",
};
const message = { to: "player@example.invalid", subject: "Subject", text: "Body" };

/** A fresh copy of the module, so its cached transport starts empty. */
async function load() {
  vi.resetModules();
  return (await import("./auth-email.js")).sendAuthEmail;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
let errors: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  smtp.created.length = 0;
  smtp.sent.length = 0;
  smtp.fail = false;
  for (const name of [...Object.keys(SMTP), "SMTP_PORT"]) vi.stubEnv(name, undefined);
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  errors.mockRestore();
});

function configure(env: Partial<Record<keyof typeof SMTP | "SMTP_PORT", string>>) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
}

describe("sendAuthEmail", () => {
  it("sends through the configured server, from the configured sender, on port 587 by default", async () => {
    configure(SMTP);
    (await load())(message);
    await flush();
    expect(smtp.created).toEqual([{ host: SMTP.SMTP_HOST, port: 587, secure: false, auth: { user: SMTP.SMTP_USER, pass: SMTP.SMTP_PASSWORD } }]);
    expect(smtp.sent).toEqual([{ ...message, from: SMTP.SMTP_FROM }]);
    expect(errors).not.toHaveBeenCalled();
  });

  it("uses implicit TLS on port 465, and connects without signing in unless both user and password are set", async () => {
    configure({ ...SMTP, SMTP_PORT: "465", SMTP_PASSWORD: "" });
    (await load())(message);
    await flush();
    expect(smtp.created).toEqual([{ host: SMTP.SMTP_HOST, port: 465, secure: true }]);
  });

  it("reuses one transport for every email", async () => {
    configure(SMTP);
    const send = await load();
    send(message);
    send(message);
    await flush();
    expect(smtp.created).toHaveLength(1);
    expect(smtp.sent).toHaveLength(2);
  });

  it("does nothing but log a fixed line when email is not configured, and never throws", async () => {
    const send = await load();
    expect(() => send(message)).not.toThrow();
    await flush();
    expect(smtp.created).toEqual([]);
    expect(errors).toHaveBeenCalledWith("Grimoire authentication email is not configured.");
  });

  it("logs a fixed line, with no address or server details, when the server refuses the email", async () => {
    configure(SMTP);
    smtp.fail = true;
    (await load())(message);
    await flush();
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith("Grimoire could not dispatch an authentication email.");
  });
});
