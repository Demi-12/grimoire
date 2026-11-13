/**
 * Bodies of the authentication emails. Pure functions (no SMTP, no `server-only`) so they can be unit-tested.
 *
 * Email clients ignore external stylesheets, web fonts and SVG, so the HTML uses nested tables, inline styles and
 * `bgcolor` attributes (Outlook), with Georgia standing in for Alegreya. Colours follow src/app/tokens.css.
 * Every email also carries a plain-text part for clients that block HTML.
 *
 * Light and dark mode:
 * - The light palette is inline, so it is the baseline everywhere. Gmail drops a whole <style> block when it
 *   meets something it does not support, so nothing may depend on the block below.
 * - Apple Mail, iOS Mail and Outlook (macOS, iOS, Android) honour `prefers-color-scheme`; Outlook.com instead
 *   rewrites colours and marks elements with `data-ogsc` / `data-ogsb`. Both get the dark palette via classes.
 * - Gmail web never darkens the message body. The Gmail apps ignore the media query and invert colours
 *   themselves (partially on Android, fully on iOS). There is no image or colour pairing here that breaks under
 *   inversion: every text colour sits on a background of the opposite lightness, so contrast survives.
 */

export type RenderedEmail = { subject: string; text: string; html: string };

const light = {
  page: "#e6e3ef", // --paper
  card: "#f4f2fa", // --surface
  header: "#241a45", // --leather-deep
  ink: "#1e1a33", // --ink
  muted: "#5b5675", // --muted
  line: "#beb8d6", // --line
  button: "#5a2d9c", // --crimson-fill
  link: "#5a2d9c", // --crimson
  gilt: "#b8962e", // --gilt
  star: "#e0c36a",
  brand: "#eeebf4",
};

/** Dark-theme tokens from tokens.css ("wizard's tower at night"). */
const dark = {
  page: "#110e1f",
  card: "#1a1630",
  header: "#0c0916",
  ink: "#e8e4f5",
  muted: "#b0a8d0",
  line: "#3a3260",
  button: "#6a3bb8",
  link: "#b79cf2",
  gilt: "#e0c36a",
};

const serif = "Georgia, 'Times New Roman', serif";

/** Dark overrides, keyed by the class names used in the markup. */
function darkRules(prefix: string) {
  const rules: [string, string][] = [
    [".g-page", `background-color:${dark.page}!important`],
    [".g-header", `background-color:${dark.header}!important;border-bottom-color:${dark.gilt}!important`],
    [".g-card", `background-color:${dark.card}!important;border-color:${dark.line}!important`],
    [".g-ink", `color:${dark.ink}!important`],
    [".g-muted", `color:${dark.muted}!important`],
    [".g-button", `background-color:${dark.button}!important`],
    [".g-button-text", "color:#ffffff!important"],
    [".g-link", `color:${dark.link}!important`],
    [".g-note", `border-left-color:${dark.gilt}!important`],
    [".g-rule", `border-top-color:${dark.line}!important`],
  ];
  return rules.map(([selector, body]) => `${prefix}${selector}{${body}}`).join("\n");
}

const darkStyle = `<style>
:root{color-scheme:light dark;supported-color-schemes:light dark}
@media (prefers-color-scheme: dark){
${darkRules("")}
}
${darkRules("[data-ogsc] ")}
${darkRules("[data-ogsb] ")}
</style>`;

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
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(subject)}</title>
${darkStyle}
</head>
<body class="g-page" style="margin:0;padding:0;background-color:${light.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;">${escapeHtml(`Elige una nueva contraseña. ${validity}`)}</div>
<table role="presentation" class="g-page" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${light.page}" style="background-color:${light.page};">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td align="center" class="g-header" bgcolor="${light.header}" style="background-color:${light.header};padding:28px 24px 24px;border-radius:10px 10px 0 0;border-bottom:3px solid ${light.gilt};">
            <div style="font-family:${serif};font-size:30px;line-height:1;color:${light.star};">&#10022;</div>
            <div style="margin-top:10px;font-family:${serif};font-size:20px;letter-spacing:6px;color:${light.brand};">GRIMOIRE</div>
          </td>
        </tr>
        <tr>
          <td class="g-card g-ink" bgcolor="${light.card}" style="background-color:${light.card};padding:36px 32px 28px;border:1px solid ${light.line};border-top:0;border-radius:0 0 10px 10px;font-family:${serif};color:${light.ink};">
            <p class="g-muted" style="margin:0 0 6px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${light.muted};">Recuperación de cuenta</p>
            <h1 class="g-ink" style="margin:0 0 20px;font-family:${serif};font-size:26px;line-height:1.25;font-weight:normal;color:${light.ink};">Restablece tu contraseña</h1>
            <p class="g-ink" style="margin:0 0 12px;font-size:16px;line-height:1.6;color:${light.ink};">${escapeHtml(greeting)}</p>
            <p class="g-ink" style="margin:0 0 28px;font-size:16px;line-height:1.6;color:${light.ink};">${escapeHtml(intro)} Pulsa el botón para elegir una nueva.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 28px;">
              <tr>
                <td align="center" class="g-button" bgcolor="${light.button}" style="background-color:${light.button};border-radius:4px;">
                  <a href="${href}" target="_blank" rel="noopener" class="g-button-text" style="display:inline-block;padding:14px 30px;font-family:${serif};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:4px;">Elegir nueva contraseña</a>
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
              <tr>
                <td class="g-note g-muted" style="border-left:3px solid ${light.gilt};padding:4px 0 4px 14px;font-size:14px;line-height:1.55;color:${light.muted};">
                  ${escapeHtml(validity)}
                </td>
              </tr>
            </table>
            <p class="g-muted" style="margin:0 0 24px;font-size:14px;line-height:1.6;color:${light.muted};">${escapeHtml(ignore)}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
              <tr><td class="g-rule" style="border-top:1px solid ${light.line};font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
            <p class="g-muted" style="margin:0 0 6px;font-size:13px;line-height:1.5;color:${light.muted};">¿El botón no funciona? Copia este enlace en tu navegador:</p>
            <p style="margin:0;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${href}" target="_blank" rel="noopener" class="g-link" style="color:${light.link};text-decoration:underline;">${href}</a></p>
          </td>
        </tr>
        <tr>
          <td align="center" class="g-muted" style="padding:20px 24px 0;font-family:${serif};font-size:12px;line-height:1.5;color:${light.muted};">
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
