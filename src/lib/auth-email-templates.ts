/**
 * Bodies of the authentication emails. Pure functions (no SMTP, no `server-only`) so they can be unit-tested.
 *
 * Email clients ignore stylesheets, web fonts and SVG, so the HTML uses nested tables, inline styles and
 * `bgcolor` attributes (Outlook), with Georgia standing in for Alegreya. Colours follow src/app/tokens.css.
 * Every email also carries a plain-text part for clients that block HTML.
 */

export type RenderedEmail = { subject: string; text: string; html: string };

const colors = {
  page: "#e6e3ef", // --paper
  card: "#f4f2fa", // --surface
  header: "#241a45", // --leather-deep
  ink: "#1e1a33",
  muted: "#5b5675",
  line: "#beb8d6",
  accent: "#5a2d9c", // --crimson
  gilt: "#b8962e",
  giltLight: "#e0c36a",
};

const serif = "Georgia, 'Times New Roman', serif";

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** First word of the display name, trimmed to something that fits a greeting. */
function greetingName(name: string | null | undefined) {
  const first = name?.trim().split(/\s+/)[0]?.slice(0, 40);
  return first || undefined;
}

type ResetPasswordInput = { name?: string | null; url: string; expiresInMinutes: number };

export function resetPasswordEmail({ name, url, expiresInMinutes }: ResetPasswordInput): RenderedEmail {
  const subject = "Restablece tu contraseña de Grimoire";
  const who = greetingName(name);
  const greeting = who ? `Hola, ${who}:` : "Hola:";
  const intro = "Hemos recibido una solicitud para restablecer la contraseña de tu cuenta de Grimoire.";
  const validity = `El enlace caduca en ${expiresInMinutes} minutos y solo puede usarse una vez.`;
  const ignore = "Si no lo has solicitado tú, puedes ignorar este correo: tu contraseña no cambiará.";

  const text = [
    greeting,
    "",
    intro,
    "Abre este enlace para elegir una nueva contraseña:",
    "",
    url,
    "",
    validity,
    ignore,
    "",
    "— Grimoire",
  ].join("\n");

  const href = escapeHtml(url);
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${colors.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${colors.page};">${escapeHtml(`Elige una nueva contraseña. ${validity}`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${colors.page}" style="background-color:${colors.page};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td align="center" bgcolor="${colors.header}" style="background-color:${colors.header};padding:28px 24px 24px;border-radius:10px 10px 0 0;border-bottom:3px solid ${colors.gilt};">
            <div style="font-family:${serif};font-size:30px;line-height:1;color:${colors.giltLight};">&#10022;</div>
            <div style="margin-top:10px;font-family:${serif};font-size:20px;letter-spacing:6px;color:#eeebf4;">GRIMOIRE</div>
          </td>
        </tr>
        <tr>
          <td bgcolor="${colors.card}" style="background-color:${colors.card};padding:36px 36px 28px;border:1px solid ${colors.line};border-top:0;border-radius:0 0 10px 10px;font-family:${serif};color:${colors.ink};">
            <p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${colors.muted};">Recuperación de cuenta</p>
            <h1 style="margin:0 0 20px;font-family:${serif};font-size:26px;line-height:1.25;font-weight:normal;color:${colors.ink};">Restablece tu contraseña</h1>
            <p style="margin:0 0 12px;font-size:16px;line-height:1.6;">${escapeHtml(greeting)}</p>
            <p style="margin:0 0 28px;font-size:16px;line-height:1.6;">${escapeHtml(intro)} Pulsa el botón para elegir una nueva.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 28px;">
              <tr>
                <td align="center" bgcolor="${colors.accent}" style="background-color:${colors.accent};border-radius:4px;">
                  <a href="${href}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 30px;font-family:${serif};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:4px;">Elegir nueva contraseña</a>
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
              <tr>
                <td style="border-left:3px solid ${colors.gilt};padding:4px 0 4px 14px;font-size:14px;line-height:1.55;color:${colors.muted};">
                  ${escapeHtml(validity)}
                </td>
              </tr>
            </table>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:${colors.muted};">${escapeHtml(ignore)}</p>
            <hr style="border:0;border-top:1px solid ${colors.line};margin:0 0 18px;">
            <p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:${colors.muted};">¿El botón no funciona? Copia este enlace en tu navegador:</p>
            <p style="margin:0;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${href}" target="_blank" rel="noopener" style="color:${colors.accent};text-decoration:underline;">${href}</a></p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 24px 0;font-family:${serif};font-size:12px;line-height:1.5;color:${colors.muted};">
            Correo automático de Grimoire, tu grimorio de D&amp;D. No respondas a este mensaje.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}
