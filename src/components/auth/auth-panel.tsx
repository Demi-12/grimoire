"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "reset-password" | "two-factor";
type Locale = "en" | "es";

const copy = {
  en: {
    title: "Enter the Grimoire", kicker: "YOUR CAMPAIGN BOOK", name: "Adventurer name", email: "Email",
    password: "Password", confirm: "Confirm password", signIn: "Sign in", signUp: "Create account",
    createAccount: "Create an account", already: "Already have an account? Sign in", forgot: "Forgot password?",
    sendReset: "Send recovery link", resetTitle: "Choose a new password", updatePassword: "Set new password",
    checkEmail: "If an account can receive mail at that address, we’ve sent the next step. Check your inbox.",
    verifyEmail: "Check your email for a verification link before signing in.", twoFactor: "Authenticator code",
    verify: "Verify code", backup: "Use a backup code", useTotp: "Use an authenticator code", passkey: "Sign in with a passkey",
    processing: "Working…", passwordMismatch: "The passwords do not match.", genericError: "We could not complete that request. Check the details and try again.",
    settings: "Account security", addPasskey: "Add a passkey", passkeys: "Saved passkeys", noPasskeys: "No passkeys saved yet.",
    remove: "Remove", enableTwoFactor: "Set up authenticator 2FA", disableTwoFactor: "Turn off 2FA",
    changePassword: "Change password", currentPassword: "Current password", newPassword: "New password", savePassword: "Update password", rotateCodes: "Generate new backup codes",
    enterPassword: "Confirm your password", setup: "Scan the code with an authenticator app, or enter this key manually:",
    totpCode: "6-digit authenticator code", confirmSetup: "Confirm and enable 2FA", backupCodes: "Save these backup codes somewhere safe. Each can be used once.",
    twoFactorOn: "Authenticator-based 2FA is enabled.", signedIn: "Signed in as", signOut: "Sign out", copySecret: "Copy setup key",
  },
  es: {
    title: "Abre el grimorio", kicker: "TU CUADERNO DE CAMPAÑA", name: "Nombre de aventurero", email: "Correo electrónico",
    password: "Contraseña", confirm: "Confirmar contraseña", signIn: "Iniciar sesión", signUp: "Crear cuenta",
    createAccount: "Crear una cuenta", already: "¿Ya tienes cuenta? Inicia sesión", forgot: "¿Has olvidado la contraseña?",
    sendReset: "Enviar enlace de recuperación", resetTitle: "Elige una contraseña nueva", updatePassword: "Guardar contraseña",
    checkEmail: "Si existe una cuenta que pueda recibir correo en esa dirección, hemos enviado el siguiente paso. Revisa tu bandeja.",
    verifyEmail: "Revisa tu correo y confirma la dirección antes de iniciar sesión.", twoFactor: "Código de la app autenticadora",
    verify: "Verificar código", backup: "Usar un código de recuperación", useTotp: "Usar código de autenticación", passkey: "Iniciar con una clave de acceso",
    processing: "Procesando…", passwordMismatch: "Las contraseñas no coinciden.", genericError: "No se pudo completar la solicitud. Revisa los datos e inténtalo de nuevo.",
    settings: "Seguridad de la cuenta", addPasskey: "Añadir clave de acceso", passkeys: "Claves guardadas", noPasskeys: "Todavía no hay claves guardadas.",
    remove: "Eliminar", enableTwoFactor: "Configurar autenticación en dos pasos", disableTwoFactor: "Desactivar 2FA",
    changePassword: "Cambiar contraseña", currentPassword: "Contraseña actual", newPassword: "Contraseña nueva", savePassword: "Actualizar contraseña", rotateCodes: "Generar nuevos códigos de recuperación",
    enterPassword: "Confirma tu contraseña", setup: "Escanea el código con una app autenticadora o introduce esta clave manualmente:",
    totpCode: "Código autenticador de 6 cifras", confirmSetup: "Confirmar y activar 2FA", backupCodes: "Guarda estos códigos de recuperación en un lugar seguro. Cada uno se puede usar una vez.",
    twoFactorOn: "La autenticación en dos pasos está activada.", signedIn: "Sesión iniciada como", signOut: "Cerrar sesión", copySecret: "Copiar clave de configuración",
  },
} as const;

const panelStyle = {
  width: "min(100%, 460px)", margin: "32px auto", padding: "clamp(22px, 5vw, 38px)",
  border: "1px solid #bda36d", borderRadius: "4px 14px 4px 14px", background: "rgba(251, 244, 229, .94)",
  boxShadow: "0 16px 45px rgba(54, 39, 19, .13)",
} as const;

const inputStyle = {
  width: "100%", minHeight: 44, padding: "10px 12px", border: "1px solid #c7b58e", borderRadius: 3,
  background: "#fffaf0", color: "#30261d",
} as const;

function errorText(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label style={{ display: "grid", gap: 6, color: "#574832", fontSize: 13 }}>{label}{children}</label>;
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
    const showTwoFactor = () => setMode("two-factor");
    window.addEventListener("grimoire:two-factor-required", showTwoFactor);
    return () => window.removeEventListener("grimoire:two-factor-required", showTwoFactor);
  }, [locale]);

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
        const result = await authClient.signUp.email({ name: name.trim(), email: email.trim(), password, callbackURL: window.location.origin });
        if (result.error) throw result.error;
        notice(t.verifyEmail);
      } else if (mode === "sign-in") {
        const result = await authClient.signIn.email({ email: email.trim(), password, callbackURL: window.location.origin });
        if (result.error) throw result.error;
        if (result.data && "twoFactorRedirect" in result.data && (result.data as { twoFactorRedirect?: boolean }).twoFactorRedirect) setMode("two-factor");
        else window.location.assign("/");
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
        const result = backupMode
          ? await authClient.twoFactor.verifyBackupCode({ code: code.trim() })
          : await authClient.twoFactor.verifyTotp({ code: code.trim(), trustDevice: false });
        if (result.error) throw result.error;
        window.location.assign("/");
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
      window.location.assign("/");
    } catch (cause) {
      setError(errorText(cause, t.genericError));
    } finally {
      setBusy(false);
    }
  }

  if (session?.user) {
    return <AccountSecurity locale={language} email={session.user.email} onSignOut={async () => { await authClient.signOut(); window.location.assign("/"); }} />;
  }

  const title = mode === "reset-password" ? t.resetTitle : mode === "two-factor" ? t.twoFactor : mode === "sign-up" ? t.createAccount : t.title;
  const needsPassword = mode === "sign-in" || mode === "sign-up" || mode === "reset-password";

  return (
    <section aria-labelledby="auth-title" style={panelStyle}>
      <p className="eyebrow"><span />{t.kicker}</p>
      <h1 id="auth-title" style={{ font: "500 28px/1.2 var(--serif)", margin: "8px 0 22px", color: "#30261d" }}>{title}</h1>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 15 }}>
        {mode === "sign-up" && <Field label={t.name}><input style={inputStyle} autoComplete="name" maxLength={100} required value={name} onChange={event => setName(event.target.value)} /></Field>}
        {(["sign-in", "sign-up", "forgot-password"].includes(mode)) && <Field label={t.email}><input style={inputStyle} type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></Field>}
        {needsPassword && <Field label={t.password}><input style={inputStyle} type="password" autoComplete={mode === "sign-in" ? "current-password webauthn" : "new-password"} minLength={12} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} /></Field>}
        {(mode === "sign-up" || mode === "reset-password") && <Field label={t.confirm}><input style={inputStyle} type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></Field>}
        {(mode === "two-factor") && <>
          <Field label={backupMode ? t.backup : t.twoFactor}><input style={inputStyle} inputMode={backupMode ? "text" : "numeric"} autoComplete="one-time-code" required value={code} onChange={event => setCode(event.target.value)} /></Field>
          <button type="button" className="button button-quiet" onClick={() => { setBackupMode(value => !value); setCode(""); }}>{backupMode ? t.useTotp : t.backup}</button>
        </>}
        {message && <p role="status" style={{ margin: 0, color: "#526245", lineHeight: 1.5 }}>{message}</p>}
        {error && <p role="alert" style={{ margin: 0, color: "#9b3a29", lineHeight: 1.5 }}>{error}</p>}
        <button className="button button-primary" type="submit" disabled={busy}>
          {busy ? t.processing : mode === "sign-in" ? t.signIn : mode === "sign-up" ? t.signUp : mode === "forgot-password" ? t.sendReset : mode === "reset-password" ? t.updatePassword : t.verify}
        </button>
      </form>
      {mode === "sign-in" && <div style={{ display: "grid", gap: 12, marginTop: 15 }}>
        <button type="button" className="button button-quiet" onClick={signInWithPasskey} disabled={busy}>{t.passkey}</button>
        <button type="button" className="button button-quiet" onClick={() => { setMessage(""); setError(""); setMode("forgot-password"); }}>{t.forgot}</button>
        <button type="button" className="button button-quiet" onClick={() => { setMessage(""); setError(""); setMode("sign-up"); }}>{t.createAccount}</button>
      </div>}
      {mode === "sign-up" && <button type="button" className="button button-quiet" style={{ marginTop: 15, width: "100%" }} onClick={() => setMode("sign-in")}>{t.already}</button>}
      {(mode === "forgot-password" || mode === "reset-password" || mode === "two-factor") && <button type="button" className="button button-quiet" style={{ marginTop: 15, width: "100%" }} onClick={() => { setMessage(""); setError(""); setMode("sign-in"); }}>{t.signIn}</button>}
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
    <section aria-labelledby="auth-security-title" style={panelStyle}>
      <p className="eyebrow"><span />{t.kicker}</p>
      <h1 id="auth-security-title" style={{ font: "500 27px/1.2 var(--serif)", margin: "8px 0 5px", color: "#30261d" }}>{t.settings}</h1>
      <p style={{ color: "#746451", marginTop: 0 }}>{t.signedIn} <strong>{email}</strong></p>

      <div style={{ display: "grid", gap: 18, marginTop: 24 }}>
        <section style={{ borderTop: "1px solid #d2bd91", paddingTop: 16 }}>
          <h2 style={{ font: "500 18px var(--serif)", margin: "0 0 10px" }}>{t.passkeys}</h2>
          {passkeys.length === 0 ? <p style={{ color: "#746451" }}>{t.noPasskeys}</p> : <ul style={{ paddingLeft: 20, display: "grid", gap: 8 }}>
            {passkeys.map(key => <li key={key.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <span>{key.name || (locale === "es" ? "Clave de acceso" : "Passkey")}</span>
              <button type="button" className="button button-quiet" disabled={busy} onClick={() => void removePasskey(key.id)}>{t.remove}</button>
            </li>)}
          </ul>}
          <button type="button" className="button button-primary" disabled={busy} onClick={() => void addPasskey()}>{busy ? t.processing : t.addPasskey}</button>
        </section>

        <section style={{ borderTop: "1px solid #d2bd91", paddingTop: 16 }}>
          <h2 style={{ font: "500 18px var(--serif)", margin: "0 0 10px" }}>2FA · TOTP</h2>
          {twoFactorEnabled ? <>
            <p style={{ color: "#526245" }}>{t.twoFactorOn}</p>
            <Field label={t.enterPassword}><input style={inputStyle} type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></Field>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              <button type="button" className="button button-quiet" disabled={busy || password.length < 12} onClick={() => void turnOffTwoFactor()}>{t.disableTwoFactor}</button>
              <button type="button" className="button button-quiet" disabled={busy || password.length < 12} onClick={() => void rotateBackupCodes()}>{t.rotateCodes}</button>
            </div>
          </> : <>
            <Field label={t.enterPassword}><input style={inputStyle} type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></Field>
            <button type="button" className="button button-primary" disabled={busy || password.length < 12 || Boolean(totpUri)} onClick={() => void startTwoFactor()}>{t.enableTwoFactor}</button>
          </>}
          {totpUri && <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <p>{t.setup}</p>
            <code style={{ overflowWrap: "anywhere", padding: 10, background: "#efe3ca", border: "1px solid #d2bd91" }}>{new URLSearchParams(totpUri.split("?")[1] ?? "").get("secret") ?? totpUri}</code>
            <button type="button" className="button button-quiet" onClick={() => { const key = new URLSearchParams(totpUri.split("?")[1] ?? "").get("secret") ?? totpUri; void navigator.clipboard?.writeText(key); }}>{t.copySecret}</button>
            <Field label={t.totpCode}><input style={inputStyle} inputMode="numeric" autoComplete="one-time-code" value={totpCode} onChange={event => setTotpCode(event.target.value)} /></Field>
            <button type="button" className="button button-primary" disabled={busy || totpCode.length < 6} onClick={() => void confirmTwoFactor()}>{t.confirmSetup}</button>
          </div>}
          {backupCodes.length > 0 && <div role="status" style={{ marginTop: 12 }}><p>{t.backupCodes}</p><code style={{ display: "block", whiteSpace: "pre-wrap", padding: 10, background: "#efe3ca" }}>{backupCodes.join("\n")}</code></div>}
        </section>

        <section style={{ borderTop: "1px solid #d2bd91", paddingTop: 16 }}>
          <h2 style={{ font: "500 18px var(--serif)", margin: "0 0 10px" }}>{t.changePassword}</h2>
          <form onSubmit={event => void changePassword(event)} style={{ display: "grid", gap: 12 }}>
            <Field label={t.currentPassword}><input style={inputStyle} type="password" autoComplete="current-password" minLength={12} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} /></Field>
            <Field label={t.newPassword}><input style={inputStyle} type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={newPassword} onChange={event => setNewPassword(event.target.value)} /></Field>
            <Field label={t.confirm}><input style={inputStyle} type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={newPasswordConfirm} onChange={event => setNewPasswordConfirm(event.target.value)} /></Field>
            <button type="submit" className="button button-primary" disabled={busy}>{busy ? t.processing : t.savePassword}</button>
          </form>
        </section>
      </div>
      {message && <p role="status" style={{ color: "#526245" }}>{message}</p>}
      {error && <p role="alert" style={{ color: "#9b3a29" }}>{error}</p>}
      <button type="button" className="button button-quiet" style={{ marginTop: 20, width: "100%" }} onClick={onSignOut}>{t.signOut}</button>
    </section>
  );
}
