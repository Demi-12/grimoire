"use client";

import { useCallback, useEffect, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { Spinner } from "@/components/skeleton";

type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "reset-password" | "two-factor";
type Locale = "en" | "es";

const copy = {
  en: {
    kickerSignIn: "BACK AT THE TABLE", kickerSignUp: "A NEW ADVENTURER", kickerForgot: "A LOST KEY", kickerReset: "A NEW KEY", kickerTwoFactor: "THE SECOND SEAL",
    forgotTitle: "Recover your password", twoFactorTitle: "Two-step verification", backupLabel: "Backup code", or: "or",
    ledeSignUp: "An admin approves new accounts before they can enter.", ledeForgot: "Enter your account email and we’ll send you a link to choose a new password.",
    ledeReset: "A phrase of a few words is easy to remember and hard to guess.",
    ledeTotp: "Open your authenticator app and enter the code it shows for Grimoire.", ledeBackup: "Enter one of the backup codes you saved when you turned on 2FA. Each one works once.",
    newHere: "New to the Grimoire?", haveAccount: "Already have an account?", backToSignIn: "Back to sign in", showPassword: "Show password",
    passwordHint: "At least 12 characters.", account: "Account",
    title: "Enter the Grimoire", kicker: "YOUR CAMPAIGN BOOK", name: "Adventurer name", email: "Email",
    password: "Password", confirm: "Confirm password", signIn: "Sign in", signUp: "Create account",
    createAccount: "Create an account", already: "Already have an account? Sign in", forgot: "Forgot password?",
    sendReset: "Send recovery link", resetTitle: "Choose a new password", updatePassword: "Set new password",
    checkEmail: "If an account can receive mail at that address, we’ve sent the next step. Check your inbox.",
    created: "Account created. An admin has to approve it before you can enter.", twoFactor: "Authenticator code",
    verify: "Verify code", backup: "Use a backup code", useTotp: "Use an authenticator code", passkey: "Sign in with a passkey",
    processing: "Working…", passwordMismatch: "The passwords do not match.", genericError: "We could not complete that request. Check the details and try again.",
    settings: "Account security", addPasskey: "Add a passkey", passkeys: "Saved passkeys", noPasskeys: "No passkeys saved yet.",
    remove: "Remove", enableTwoFactor: "Set up authenticator 2FA", disableTwoFactor: "Turn off 2FA",
    changePassword: "Change password", currentPassword: "Current password", newPassword: "New password", savePassword: "Update password", rotateCodes: "Generate new backup codes",
    enterPassword: "Confirm your password", setup: "Scan the code with an authenticator app, or enter this key manually:",
    totpCode: "6-digit authenticator code", confirmSetup: "Confirm and enable 2FA", backupCodes: "Save these backup codes somewhere safe. Each can be used once.",
    twoFactorOn: "Authenticator-based 2FA is enabled.", signedIn: "Signed in as", signOut: "Sign out", copySecret: "Copy setup key",
    invalidCode: "That code isn't valid. Check it and try again.", twoFactorExpired: "That sign-in attempt has expired. Enter your email and password again.",
    tooManyRequests: "Too many attempts. Wait a few seconds and try again.", accountLocked: "Too many wrong codes. Your account is locked for a few minutes.",
    sessionNotLoaded: "You're signed in, but the session couldn't be loaded. Reload the page.",
  },
  es: {
    kickerSignIn: "DE VUELTA A LA MESA", kickerSignUp: "UNA NUEVA AVENTURA", kickerForgot: "UNA LLAVE PERDIDA", kickerReset: "UNA LLAVE NUEVA", kickerTwoFactor: "EL SEGUNDO SELLO",
    forgotTitle: "Recupera tu contraseña", twoFactorTitle: "Verificación en dos pasos", backupLabel: "Código de recuperación", or: "o",
    ledeSignUp: "Un admin aprueba las cuentas nuevas antes de que puedan entrar.", ledeForgot: "Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.",
    ledeReset: "Una frase de varias palabras es fácil de recordar y difícil de adivinar.",
    ledeTotp: "Abre tu app autenticadora y escribe el código de 6 cifras que muestra para Grimoire.", ledeBackup: "Escribe uno de los códigos de recuperación que guardaste al activar 2FA. Cada uno sirve una sola vez.",
    newHere: "¿Primera vez en el grimorio?", haveAccount: "¿Ya tienes cuenta?", backToSignIn: "Volver a iniciar sesión", showPassword: "Mostrar contraseña",
    passwordHint: "Mínimo 12 caracteres.", account: "Cuenta",
    title: "Abre el grimorio", kicker: "TU CUADERNO DE CAMPAÑA", name: "Nombre de aventurero", email: "Correo electrónico",
    password: "Contraseña", confirm: "Confirmar contraseña", signIn: "Iniciar sesión", signUp: "Crear cuenta",
    createAccount: "Crear una cuenta", already: "¿Ya tienes cuenta? Inicia sesión", forgot: "¿Has olvidado la contraseña?",
    sendReset: "Enviar enlace de recuperación", resetTitle: "Elige una contraseña nueva", updatePassword: "Guardar contraseña",
    checkEmail: "Si existe una cuenta que pueda recibir correo en esa dirección, hemos enviado el siguiente paso. Revisa tu bandeja.",
    created: "Cuenta creada. Un admin tendrá que aprobarla para que puedas entrar.", twoFactor: "Código de la app autenticadora",
    verify: "Verificar código", backup: "Usar un código de recuperación", useTotp: "Usar código de autenticación", passkey: "Iniciar con una clave de acceso",
    processing: "Procesando…", passwordMismatch: "Las contraseñas no coinciden.", genericError: "No se pudo completar la solicitud. Revisa los datos e inténtalo de nuevo.",
    settings: "Seguridad de la cuenta", addPasskey: "Añadir clave de acceso", passkeys: "Claves guardadas", noPasskeys: "Todavía no hay claves guardadas.",
    remove: "Eliminar", enableTwoFactor: "Configurar autenticación en dos pasos", disableTwoFactor: "Desactivar 2FA",
    changePassword: "Cambiar contraseña", currentPassword: "Contraseña actual", newPassword: "Contraseña nueva", savePassword: "Actualizar contraseña", rotateCodes: "Generar nuevos códigos de recuperación",
    enterPassword: "Confirma tu contraseña", setup: "Escanea el código con una app autenticadora o introduce esta clave manualmente:",
    totpCode: "Código autenticador de 6 cifras", confirmSetup: "Confirmar y activar 2FA", backupCodes: "Guarda estos códigos de recuperación en un lugar seguro. Cada uno se puede usar una vez.",
    twoFactorOn: "La autenticación en dos pasos está activada.", signedIn: "Sesión iniciada como", signOut: "Cerrar sesión", copySecret: "Copiar clave de configuración",
    invalidCode: "El código no es válido. Revísalo e inténtalo de nuevo.", twoFactorExpired: "Ese inicio de sesión ha caducado. Vuelve a introducir tu correo y contraseña.",
    tooManyRequests: "Demasiados intentos. Espera unos segundos y vuelve a probar.", accountLocked: "Demasiados códigos incorrectos. La cuenta queda bloqueada unos minutos.",
    sessionNotLoaded: "Has iniciado sesión, pero no se pudo cargar la sesión. Recarga la página.",
  },
} as const;


function errorText(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}

/** Map a failed 2FA verification to our own (translated) message; better-auth's messages are English-only. */
function twoFactorProblem(error: { code?: string; status?: number }): "expired" | "invalidCode" | "tooManyRequests" | "accountLocked" | null {
  switch (error.code) {
    case "INVALID_TWO_FACTOR_COOKIE":
    case "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE":
      return "expired";
    case "INVALID_CODE":
    case "INVALID_BACKUP_CODE":
      return "invalidCode";
    case "ACCOUNT_TEMPORARILY_LOCKED":
      return "accountLocked";
  }
  return error.status === 429 ? "tooManyRequests" : null;
}

/**
 * One labelled control. The input sits alone in `.auth-control` (a flex row with no gap), so the icons and
 * anchors that password managers inject next to it (LastPass, Dashlane, 1Password…) add no row and no
 * spacing, and nothing around the field moves when an extension loads. `aside` (e.g. "Forgot password?")
 * is drawn on the label row but comes after the input in tab order.
 */
function Field({ id, label, hint, aside, className = "", children }: { id: string; label: string; hint?: string; aside?: ReactNode; className?: string; children: ReactNode }) {
  return <div className={`auth-field ${className}`.trim()}>
    <label className="auth-label" htmlFor={id}>{label}</label>
    <div className="auth-control">{children}</div>
    {aside}
    {hint && <p className="auth-hint" id={`${id}-hint`}>{hint}</p>}
  </div>;
}

function Glyph({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>;
}

/**
 * Password input with a show/hide button. The button sits outside the input box (joined to its right edge),
 * so it never collides with the icon a password manager overlays inside the input; revealing only flips
 * `type`, the element stays mounted so a manager's fill and React's value survive.
 */
function PasswordInput({ id, showLabel, hint, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> & { id: string; showLabel: string; hint?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  return <>
    <input {...props} id={id} type={revealed ? "text" : "password"} className="auth-input auth-input-joined" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby={hint ? `${id}-hint` : undefined} />
    <button type="button" className="auth-reveal" aria-label={showLabel} aria-pressed={revealed} aria-controls={id} onClick={() => setRevealed((value) => !value)}>
      <Glyph>{revealed
        ? <><path d="M3 3l18 18" /><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c5.5 0 9 5.5 9.6 7a14 14 0 0 1-3 3.9M6.6 6.6A14.5 14.5 0 0 0 2.4 12c.6 1.5 4.1 7 9.6 7a10 10 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>
        : <><path d="M2.4 12C3 10.5 6.5 5 12 5s9 5.5 9.6 7c-.6 1.5-4.1 7-9.6 7s-9-5.5-9.6-7z" /><circle cx="12" cy="12" r="3" /></>}</Glyph>
    </button>
  </>;
}

export function AuthPanel({ initialMode = "sign-in", locale }: { initialMode?: AuthMode; locale?: Locale }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [language, setLanguage] = useState<Locale>(locale ?? "en");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [backupMode, setBackupMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const t = copy[language];
  const sessionState = authClient.useSession();
  const session = sessionState.data;

  useEffect(() => {
    if (!locale) setLanguage(navigator.language.toLowerCase().startsWith("es") ? "es" : "en");
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setResetToken(token);
      setMode("reset-password");
    }
  }, [locale]);

  /**
   * Load the new session into better-auth's store; Toolkit then swaps this panel for the app (no full reload,
   * so the URL the person opened is kept). The sign-in calls pass `disableSignal` so better-auth doesn't fire
   * its own refetch in parallel; this is the one that counts. If get-session fails (e.g. rate-limited), say so
   * instead of silently showing the sign-in form again while the cookie is already set.
   */
  async function finishSignIn() {
    await sessionState.refetch();
    const loaded = (authClient.$store.atoms.session?.get() as { data?: { user?: unknown } | null } | undefined)?.data?.user;
    if (!loaded) throw new Error(t.sessionNotLoaded);
  }

  function startTwoFactor() {
    // The password is no longer needed: the server keeps the challenge in its short-lived two_factor cookie.
    setPassword("");
    setCode("");
    setBackupMode(false);
    setMode("two-factor");
  }

  const notice = useCallback((text: string) => {
    setError("");
    setMessage(text);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "sign-up") {
        if (password !== confirmation) throw new Error(t.passwordMismatch);
        const result = await authClient.signUp.email({ name: name.trim(), email: email.trim(), password, fetchOptions: { disableSignal: true } });
        if (result.error) throw result.error;
        // The server signs the new account in directly.
        if (result.data && "token" in result.data && result.data.token) await finishSignIn();
        else notice(t.created);
      } else if (mode === "sign-in") {
        // No callbackURL: with one, better-auth's redirect plugin navigates away on success and races this flow.
        const result = await authClient.signIn.email({ email: email.trim(), password, fetchOptions: { disableSignal: true } });
        if (result.error) throw result.error;
        if (result.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect) startTwoFactor();
        else await finishSignIn();
      } else if (mode === "forgot-password") {
        const result = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: `${window.location.origin}/?auth=reset-password` });
        if (result.error) throw result.error;
        notice(t.checkEmail);
      } else if (mode === "reset-password") {
        if (!resetToken) throw new Error(t.genericError);
        if (password !== confirmation) throw new Error(t.passwordMismatch);
        const result = await authClient.resetPassword({ newPassword: password, token: resetToken });
        if (result.error) throw result.error;
        notice(language === "es" ? "Contraseña actualizada. Ya puedes iniciar sesión." : "Password updated. You can sign in now.");
        setMode("sign-in");
      } else if (mode === "two-factor") {
        const fetchOptions = { disableSignal: true };
        const result = backupMode
          ? await authClient.twoFactor.verifyBackupCode({ code: code.trim(), fetchOptions })
          // Authenticator apps often show "123 456".
          : await authClient.twoFactor.verifyTotp({ code: code.replace(/\s+/g, ""), trustDevice: false, fetchOptions });
        if (result.error) {
          const problem = twoFactorProblem(result.error);
          if (problem === "expired") {
            // The server consumed or expired the challenge: only a new password sign-in can start another one.
            setCode("");
            setMode("sign-in");
            setError(t.twoFactorExpired);
            return;
          }
          throw problem ? new Error(t[problem]) : result.error;
        }
        await finishSignIn();
      }
    } catch (cause) {
      setError(errorText(cause, t.genericError));
    } finally {
      setBusy(false);
    }
  }

  async function signInWithPasskey() {
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.passkey({});
      const responseError = result.data && "error" in result.data ? result.data.error : undefined;
      if (result.error || responseError) throw result.error ?? responseError;
      await finishSignIn();
    } catch (cause) {
      setError(errorText(cause, t.genericError));
    } finally {
      setBusy(false);
    }
  }

  if (session?.user) {
    return <AccountSecurity locale={language} email={session.user.email} onSignOut={async () => { await authClient.signOut(); window.location.assign("/"); }} />;
  }

  const title = mode === "reset-password" ? t.resetTitle : mode === "two-factor" ? t.twoFactorTitle : mode === "sign-up" ? t.createAccount : mode === "forgot-password" ? t.forgotTitle : t.title;
  const kicker = mode === "reset-password" ? t.kickerReset : mode === "two-factor" ? t.kickerTwoFactor : mode === "sign-up" ? t.kickerSignUp : mode === "forgot-password" ? t.kickerForgot : t.kickerSignIn;
  const lede = mode === "reset-password" ? t.ledeReset : mode === "two-factor" ? (backupMode ? t.ledeBackup : t.ledeTotp) : mode === "sign-up" ? t.ledeSignUp : mode === "forgot-password" ? t.ledeForgot : "";
  const submitLabel = mode === "sign-in" ? t.signIn : mode === "sign-up" ? t.signUp : mode === "forgot-password" ? t.sendReset : mode === "reset-password" ? t.updatePassword : t.verify;
  const backToSignIn = () => { setMessage(""); setError(""); setMode("sign-in"); };

  return (
    <section className="auth-panel" aria-labelledby="auth-title" data-mode={mode}>
      <header className="auth-head">
        <p className="eyebrow"><span />{kicker}</p>
        <h1 id="auth-title" className="auth-title">{title}</h1>
        {lede && <p className="auth-lede" id="auth-lede">{lede}</p>}
      </header>
      {/* Live regions stay mounted across steps so a message set while switching step is still announced. */}
      <div className="auth-feedback" role="status" aria-live="polite">{message && <p className="auth-notice auth-notice-ok">{message}</p>}</div>
      <div className="auth-feedback" role="alert">{error && <p className="auth-notice auth-notice-error">{error}</p>}</div>
      {/* One form per step (keyed by mode): password managers see a fresh form with the right autocomplete
          tokens instead of one form whose fields change meaning under them. */}
      <form key={mode} id={`auth-${mode}`} name={`auth-${mode}`} className="auth-form" method="post" onSubmit={handleSubmit} aria-describedby={lede ? "auth-lede" : undefined}>
        {mode === "two-factor" && email && <div className="auth-account">
          <Glyph><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Glyph>
          <label className="sr-only" htmlFor="auth-account">{t.account}</label>
          {/* The account this code is for, as `username`, so managers offer the TOTP saved with that login. */}
          <input id="auth-account" name="username" className="auth-account-input" type="email" autoComplete="username" value={email} readOnly tabIndex={-1} />
        </div>}
        {mode === "sign-up" && <Field id="auth-name" label={t.name}>
          <input id="auth-name" name="name" className="auth-input" autoComplete="nickname" autoCapitalize="words" maxLength={100} required value={name} onChange={event => setName(event.target.value)} />
        </Field>}
        {(mode === "sign-in" || mode === "sign-up" || mode === "forgot-password") && <Field id="auth-email" label={t.email}>
          <input id="auth-email" name="email" className="auth-input" type="email" inputMode="email" autoComplete={mode === "sign-up" ? "email" : "username"} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} />
        </Field>}
        {mode === "sign-in" && <Field id="auth-password" label={t.password} aside={<button type="button" className="auth-link auth-field-aside" onClick={() => { setMessage(""); setError(""); setMode("forgot-password"); }}>{t.forgot}</button>}>
          <PasswordInput id="auth-password" name="password" showLabel={t.showPassword} autoComplete="current-password webauthn" maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} />
        </Field>}
        {(mode === "sign-up" || mode === "reset-password") && <>
          <Field id="auth-new-password" label={mode === "reset-password" ? t.newPassword : t.password} hint={t.passwordHint}>
            <PasswordInput id="auth-new-password" name="new-password" showLabel={t.showPassword} hint autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} />
          </Field>
          <Field id="auth-confirm-password" label={t.confirm}>
            <PasswordInput id="auth-confirm-password" name="confirm-password" showLabel={t.showPassword} autoComplete="new-password" minLength={12} maxLength={128} required value={confirmation} onChange={event => setConfirmation(event.target.value)} />
          </Field>
        </>}
        {mode === "two-factor" && <Field id="auth-code" label={backupMode ? t.backupLabel : t.twoFactor} className="auth-field-code">
          {/* A single input so OTP autofill (managers, SMS, iOS) can fill all six digits at once. */}
          <input id="auth-code" name="code" className={`auth-input auth-code ${backupMode ? "is-backup" : "is-totp"}`} inputMode={backupMode ? "text" : "numeric"} autoComplete="one-time-code" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="go" autoFocus required minLength={backupMode ? undefined : 6} maxLength={backupMode ? 64 : undefined} value={code} onChange={event => setCode(backupMode ? event.target.value : event.target.value.replace(/\D/g, "").slice(0, 6))} />
        </Field>}
        <button className="button button-primary auth-submit" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? <><Spinner />{t.processing}</> : submitLabel}
        </button>
      </form>
      {mode === "sign-in" && <>
        <div className="auth-divider" aria-hidden="true"><span>{t.or}</span></div>
        <button type="button" className="button button-quiet auth-alt" onClick={signInWithPasskey} disabled={busy}>
          <Glyph><circle cx="8" cy="15" r="4.5" /><path d="M11.2 11.8 20 3M16.5 6.5l3 3M18.5 4.5l2 2" /></Glyph>{t.passkey}
        </button>
      </>}
      <footer className="auth-foot">
        {mode === "sign-in" && <p>{t.newHere} <button type="button" className="auth-link" onClick={() => { setMessage(""); setError(""); setMode("sign-up"); }}>{t.createAccount}</button></p>}
        {mode === "sign-up" && <p>{t.haveAccount} <button type="button" className="auth-link" onClick={() => setMode("sign-in")}>{t.signIn}</button></p>}
        {mode === "two-factor" && <button type="button" className="auth-link" onClick={() => { setBackupMode(value => !value); setCode(""); document.getElementById("auth-code")?.focus(); }}>{backupMode ? t.useTotp : t.backup}</button>}
        {(mode === "forgot-password" || mode === "reset-password" || mode === "two-factor") && <button type="button" className="auth-link auth-back" onClick={backToSignIn}>
          <Glyph><path d="M19 12H5M11 6l-6 6 6 6" /></Glyph>{t.backToSignIn}
        </button>}
      </footer>
    </section>
  );
}

function AccountSecurity({ locale, email, onSignOut }: { locale: Locale; email: string; onSignOut: () => void }) {
  const t = copy[locale];
  const session = authClient.useSession();
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [passkeys, setPasskeys] = useState<Array<{ id: string; name?: string | null }>>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const twoFactorEnabled = Boolean(session.data?.user.twoFactorEnabled);

  const loadPasskeys = useCallback(async () => {
    const result = await authClient.passkey.listUserPasskeys();
    if (result.data) setPasskeys(result.data);
  }, []);

  useEffect(() => { void loadPasskeys(); }, [loadPasskeys]);

  const startTwoFactor = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await authClient.twoFactor.enable({ password, method: "totp", issuer: "Grimoire" });
      if (result.error) throw result.error;
      if (result.data?.method === "totp") {
        setTotpUri(result.data.totpURI);
        setBackupCodes(result.data.backupCodes);
        setMessage(t.setup);
      }
    } catch (cause) { setError(errorText(cause, t.genericError)); }
    finally { setBusy(false); }
  };

  const confirmTwoFactor = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await authClient.twoFactor.verifyTotp({ code: totpCode });
      if (result.error) throw result.error;
      setTotpUri(""); setTotpCode(""); setPassword("");
      setMessage(t.twoFactorOn);
      await session.refetch();
    } catch (cause) { setError(errorText(cause, t.genericError)); }
    finally { setBusy(false); }
  };

  const turnOffTwoFactor = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await authClient.twoFactor.disable({ password });
      if (result.error) throw result.error;
      setPassword(""); setMessage(locale === "es" ? "La autenticación en dos pasos se ha desactivado." : "Two-factor authentication has been disabled.");
      await session.refetch();
    } catch (cause) { setError(errorText(cause, t.genericError)); }
    finally { setBusy(false); }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (newPassword !== newPasswordConfirm) throw new Error(locale === "es" ? "Las contraseñas nuevas no coinciden." : "The new passwords do not match.");
      const result = await authClient.changePassword({ newPassword, currentPassword: password, revokeOtherSessions: true });
      if (result.error) throw result.error;
      setPassword(""); setNewPassword(""); setNewPasswordConfirm("");
      setMessage(locale === "es" ? "Contraseña actualizada; se cerraron las demás sesiones." : "Password updated; other sessions were signed out.");
    } catch (cause) { setError(errorText(cause, t.genericError)); }
    finally { setBusy(false); }
  };

  const rotateBackupCodes = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await authClient.twoFactor.generateBackupCodes({ password });
      if (result.error) throw result.error;
      setBackupCodes(result.data?.backupCodes ?? []);
      setMessage(locale === "es" ? "Los códigos anteriores ya no sirven." : "The previous backup codes are no longer valid.");
    } catch (cause) { setError(errorText(cause, t.genericError)); }
    finally { setBusy(false); }
  };

  const addPasskey = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await authClient.passkey.addPasskey({ name: `Grimoire · ${new Date().toLocaleDateString()}` });
      const responseError = result.data && "error" in result.data ? result.data.error : undefined;
      if (result.error || responseError) throw result.error ?? responseError;
      setMessage(locale === "es" ? "Clave de acceso guardada." : "Passkey saved.");
      await loadPasskeys();
    } catch (cause) { setError(errorText(cause, t.genericError)); }
    finally { setBusy(false); }
  };

  const removePasskey = async (id: string) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await authClient.passkey.deletePasskey({ id });
      if (result.error) throw result.error;
      await loadPasskeys();
    } catch (cause) { setError(errorText(cause, t.genericError)); }
    finally { setBusy(false); }
  };

  return (
    <section className="auth-panel auth-panel-account" aria-labelledby="auth-security-title">
      <header className="auth-head">
        <p className="eyebrow"><span />{t.kicker}</p>
        <h1 id="auth-security-title" className="auth-title">{t.settings}</h1>
        <p className="auth-lede">{t.signedIn} <strong>{email}</strong></p>
      </header>

      <div className="auth-sections">
        <section className="auth-section">
          <h2 className="auth-section-title">{t.passkeys}</h2>
          {passkeys.length === 0 ? <p className="auth-section-note">{t.noPasskeys}</p> : <ul className="auth-keys">
            {passkeys.map(key => <li key={key.id}>
              <span>{key.name || (locale === "es" ? "Clave de acceso" : "Passkey")}</span>
              <button type="button" className="button button-quiet" disabled={busy} onClick={() => void removePasskey(key.id)}>{t.remove}</button>
            </li>)}
          </ul>}
          <button type="button" className="button button-primary" disabled={busy} onClick={() => void addPasskey()}>{busy ? t.processing : t.addPasskey}</button>
        </section>

        <section className="auth-section">
          <h2 className="auth-section-title">2FA · TOTP</h2>
          {twoFactorEnabled && <p className="auth-section-note auth-section-ok">{t.twoFactorOn}</p>}
          <Field id="security-2fa-password" label={t.enterPassword}>
            <PasswordInput id="security-2fa-password" name="password" showLabel={t.showPassword} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} />
          </Field>
          {twoFactorEnabled ? <div className="auth-actions">
            <button type="button" className="button button-quiet" disabled={busy || password.length < 12} onClick={() => void turnOffTwoFactor()}>{t.disableTwoFactor}</button>
            <button type="button" className="button button-quiet" disabled={busy || password.length < 12} onClick={() => void rotateBackupCodes()}>{t.rotateCodes}</button>
          </div> : <div className="auth-actions">
            <button type="button" className="button button-primary" disabled={busy || password.length < 12 || Boolean(totpUri)} onClick={() => void startTwoFactor()}>{t.enableTwoFactor}</button>
          </div>}
          {totpUri && <div className="auth-setup">
            <p>{t.setup}</p>
            <code className="auth-secret">{new URLSearchParams(totpUri.split("?")[1] ?? "").get("secret") ?? totpUri}</code>
            <button type="button" className="button button-quiet" onClick={() => { const key = new URLSearchParams(totpUri.split("?")[1] ?? "").get("secret") ?? totpUri; void navigator.clipboard?.writeText(key); }}>{t.copySecret}</button>
            <Field id="security-totp" label={t.totpCode} className="auth-field-code">
              <input id="security-totp" name="code" className="auth-input auth-code is-totp" inputMode="numeric" autoComplete="one-time-code" autoCorrect="off" spellCheck={false} value={totpCode} onChange={event => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
            </Field>
            <button type="button" className="button button-primary" disabled={busy || totpCode.length < 6} onClick={() => void confirmTwoFactor()}>{t.confirmSetup}</button>
          </div>}
          {backupCodes.length > 0 && <div role="status" className="auth-setup"><p>{t.backupCodes}</p><code className="auth-secret auth-backup-codes">{backupCodes.join("\n")}</code></div>}
        </section>

        <section className="auth-section">
          <h2 className="auth-section-title">{t.changePassword}</h2>
          <form id="auth-change-password" className="auth-form" method="post" onSubmit={event => void changePassword(event)}>
            {/* Tells password managers which saved login to update. */}
            <input className="sr-only" type="email" name="username" autoComplete="username" value={email} readOnly tabIndex={-1} aria-hidden="true" />
            <Field id="security-current-password" label={t.currentPassword}>
              <PasswordInput id="security-current-password" name="current-password" showLabel={t.showPassword} autoComplete="current-password" minLength={12} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} />
            </Field>
            <Field id="security-new-password" label={t.newPassword} hint={t.passwordHint}>
              <PasswordInput id="security-new-password" name="new-password" showLabel={t.showPassword} hint autoComplete="new-password" minLength={12} maxLength={128} required value={newPassword} onChange={event => setNewPassword(event.target.value)} />
            </Field>
            <Field id="security-confirm-password" label={t.confirm}>
              <PasswordInput id="security-confirm-password" name="confirm-password" showLabel={t.showPassword} autoComplete="new-password" minLength={12} maxLength={128} required value={newPasswordConfirm} onChange={event => setNewPasswordConfirm(event.target.value)} />
            </Field>
            <button type="submit" className="button button-primary auth-submit" disabled={busy}>{busy ? <><Spinner />{t.processing}</> : t.savePassword}</button>
          </form>
        </section>
      </div>
      <div className="auth-feedback" role="status" aria-live="polite">{message && <p className="auth-notice auth-notice-ok">{message}</p>}</div>
      <div className="auth-feedback" role="alert">{error && <p className="auth-notice auth-notice-error">{error}</p>}</div>
      <button type="button" className="button button-quiet auth-signout" onClick={onSignOut}>{t.signOut}</button>
    </section>
  );
}
