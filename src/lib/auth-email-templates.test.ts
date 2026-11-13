import { describe, expect, it } from "vitest";
import { escapeHtml, resetPasswordEmail } from "./auth-email-templates";

const url = "https://grimoire.example/api/auth/reset-password/abc123?callbackURL=https%3A%2F%2Fgrimoire.example%2F%3Fauth%3Dreset-password&x=1";

describe("resetPasswordEmail", () => {
  it("puts the link in both the plain-text and HTML parts", () => {
    const email = resetPasswordEmail({ name: "Ana", url, expiresInMinutes: 30 });
    expect(email.subject).toBe("Restablece tu contraseña de Grimoire");
    expect(email.text).toContain(url);
    expect(email.text).toContain("30 minutos");
    // Ampersands in the query string are escaped inside href and link text.
    expect(email.html).toContain(`href="${escapeHtml(url)}"`);
    expect(email.html).not.toContain("&x=1");
  });

  it("greets by first name and escapes it", () => {
    expect(resetPasswordEmail({ name: "Ana María López", url, expiresInMinutes: 30 }).text).toMatch(/^Hola, Ana:/);
    const html = resetPasswordEmail({ name: "<script>alert(1)</script>", url, expiresInMinutes: 30 }).html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("falls back to a nameless greeting", () => {
    expect(resetPasswordEmail({ name: "  ", url, expiresInMinutes: 30 }).text).toMatch(/^Hola:/);
    expect(resetPasswordEmail({ url, expiresInMinutes: 30 }).text).toMatch(/^Hola:/);
  });
});
