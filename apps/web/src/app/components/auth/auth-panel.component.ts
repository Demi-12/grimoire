import {
  afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, model, OnInit, signal, viewChild,
} from "@angular/core";
import { authErrorKind } from "@grimoire/shared/error-text";
import { authClient } from "../../core/auth-client";
import { I18nService } from "../../core/i18n.service";
import { SessionService } from "../../core/session.service";
import { SpinnerComponent } from "../skeleton.component";

/**
 * The sign-in gate (sign in, create an account, forgot / reset password, the two-factor step, passkeys) and,
 * once signed in, the account security section (change password, authenticator 2FA with backup codes,
 * passkeys, sign out). Everything goes through better-auth's client; this file only gathers and shows.
 */

export type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "reset-password" | "two-factor";

const copy = {
  en: {
    kickerSignIn: "BACK AT THE TABLE", kickerSignUp: "A NEW ADVENTURER", kickerForgot: "A LOST KEY", kickerReset: "A NEW KEY", kickerTwoFactor: "THE SECOND SEAL",
    forgotTitle: "Recover your password", twoFactorTitle: "Two-step verification", backupLabel: "Backup code", or: "or",
    ledeSignUp: "An admin approves new accounts before they can enter.", ledeForgot: "Enter your account email and we’ll send you a link to choose a new password.",
    ledeReset: "A phrase of a few words is easy to remember and hard to guess.",
    ledeTotp: "Open your authenticator app and enter the code it shows for Grimoire.", ledeBackup: "Enter one of the backup codes you saved when you turned on two-step verification. Each one works once.",
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
    remove: "Remove", enableTwoFactor: "Set up two-step verification", disableTwoFactor: "Turn off two-step verification", twoFactorSection: "Two-step verification",
    changePassword: "Change password", currentPassword: "Current password", newPassword: "New password", savePassword: "Update password", rotateCodes: "Generate new backup codes",
    enterPassword: "Confirm your password", setup: "Scan the code with an authenticator app, or enter this key manually:",
    totpCode: "6-digit authenticator code", confirmSetup: "Confirm and turn on", backupCodes: "Save these backup codes somewhere safe. Each can be used once.",
    twoFactorOn: "Two-step verification with an authenticator app is on.", signedIn: "Signed in as", signOut: "Sign out", copySecret: "Copy setup key",
    sessionNotLoaded: "You're signed in, but the session couldn't be loaded. Reload the page.",
    twoFactorOff: "Two-step verification has been turned off.", newPasswordMismatch: "The new passwords do not match.", passwordChanged: "Password updated; other sessions were signed out.",
    codesRotated: "The previous backup codes are no longer valid.", passkeySaved: "Passkey saved.", passkeyName: "Passkey", passwordReset: "Password updated. You can sign in now.",
  },
  es: {
    kickerSignIn: "DE VUELTA A LA MESA", kickerSignUp: "UNA NUEVA AVENTURA", kickerForgot: "UNA LLAVE PERDIDA", kickerReset: "UNA LLAVE NUEVA", kickerTwoFactor: "EL SEGUNDO SELLO",
    forgotTitle: "Recupera tu contraseña", twoFactorTitle: "Verificación en dos pasos", backupLabel: "Código de recuperación", or: "o",
    ledeSignUp: "Un admin aprueba las cuentas nuevas antes de que puedan entrar.", ledeForgot: "Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.",
    ledeReset: "Una frase de varias palabras es fácil de recordar y difícil de adivinar.",
    ledeTotp: "Abre tu app autenticadora y escribe el código de 6 cifras que muestra para Grimoire.", ledeBackup: "Escribe uno de los códigos de recuperación que guardaste al activar la verificación en dos pasos. Cada uno sirve una sola vez.",
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
    remove: "Eliminar", enableTwoFactor: "Configurar la verificación en dos pasos", disableTwoFactor: "Desactivar la verificación en dos pasos", twoFactorSection: "Verificación en dos pasos",
    changePassword: "Cambiar contraseña", currentPassword: "Contraseña actual", newPassword: "Contraseña nueva", savePassword: "Actualizar contraseña", rotateCodes: "Generar nuevos códigos de recuperación",
    enterPassword: "Confirma tu contraseña", setup: "Escanea el código con una app autenticadora o introduce esta clave manualmente:",
    totpCode: "Código de 6 cifras de la app autenticadora", confirmSetup: "Confirmar y activar", backupCodes: "Guarda estos códigos de recuperación en un lugar seguro. Cada uno se puede usar una vez.",
    twoFactorOn: "La verificación en dos pasos con app autenticadora está activada.", signedIn: "Sesión iniciada como", signOut: "Cerrar sesión", copySecret: "Copiar clave de configuración",
    sessionNotLoaded: "Has iniciado sesión, pero no se pudo cargar la sesión. Recarga la página.",
    twoFactorOff: "La verificación en dos pasos se ha desactivado.", newPasswordMismatch: "Las contraseñas nuevas no coinciden.", passwordChanged: "Contraseña actualizada; se cerraron las demás sesiones.",
    codesRotated: "Los códigos anteriores ya no sirven.", passkeySaved: "Clave de acceso guardada.", passkeyName: "Clave de acceso", passwordReset: "Contraseña actualizada. Ya puedes iniciar sesión.",
  },
} as const;

/** A problem this file found itself (passwords that don't match…), already in the interface language. */
class Shown extends Error {}

/** An authenticator code keeps only digits, six at most. */
const totpDigits = (value: string) => value.replace(/\D/g, "").slice(0, 6);

/**
 * A field's control row (`div.auth-control`) holding a password input with a show/hide button. The button sits
 * outside the input box (joined to its right edge), so it never collides with the icon a password manager
 * overlays inside the input; revealing only flips `type`, the element stays mounted so a manager's fill and
 * the typed value survive. The host is the control row itself, so `.auth-control > .auth-input` selectors hold.
 *
 * Fields are written out in the templates below as `div.auth-field` > `label.auth-label` + `div.auth-control`
 * (+ aside, + `p.auth-hint`). The input sits alone in `.auth-control` (a flex row with no gap), so the icons
 * and anchors that password managers inject next to it (LastPass, Dashlane, 1Password…) add no row and no
 * spacing, and nothing around the field moves when an extension loads. An aside (e.g. "Forgot password?")
 * is drawn on the label row but comes after the input in tab order.
 */
@Component({
  selector: "div[appPasswordInput]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "auth-control" },
  template: `
    <input #field [id]="inputId()" [attr.name]="inputName()" [attr.autocomplete]="autocomplete()" [attr.minlength]="minLength()" [attr.maxlength]="maxLength()"
      [required]="required()" [value]="value()" (input)="value.set(field.value)"
      [type]="revealed() ? 'text' : 'password'" class="auth-input auth-input-joined" autocapitalize="none" autocorrect="off" spellcheck="false"
      [attr.aria-describedby]="hint() ? inputId() + '-hint' : null" />
    <button type="button" class="auth-reveal" [attr.aria-label]="showLabel()" [attr.aria-pressed]="revealed()" [attr.aria-controls]="inputId()" (click)="revealed.set(!revealed())">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        @if (revealed()) {
          <svg:path d="M3 3l18 18" /><svg:path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c5.5 0 9 5.5 9.6 7a14 14 0 0 1-3 3.9M6.6 6.6A14.5 14.5 0 0 0 2.4 12c.6 1.5 4.1 7 9.6 7a10 10 0 0 0 5.4-1.6" /><svg:path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        } @else {
          <svg:path d="M2.4 12C3 10.5 6.5 5 12 5s9 5.5 9.6 7c-.6 1.5-4.1 7-9.6 7s-9-5.5-9.6-7z" /><svg:circle cx="12" cy="12" r="3" />
        }
      </svg>
    </button>
  `,
})
class PasswordInputComponent {
  readonly inputId = input.required<string>();
  readonly inputName = input.required<string>();
  readonly showLabel = input.required<string>();
  readonly autocomplete = input.required<string>();
  readonly minLength = input<number | null>(null);
  readonly maxLength = input<number | null>(null);
  readonly required = input(false);
  /** The field has a hint paragraph (`<id>-hint`) that describes it. */
  readonly hint = input(false);
  readonly value = model.required<string>();

  protected readonly revealed = signal(false);
}

/** The signed-in view: password, authenticator 2FA, passkeys and sign out. */
@Component({
  selector: "app-account-security",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PasswordInputComponent, SpinnerComponent],
  host: { class: "contents" },
  template: `
    <section class="auth-panel auth-panel-account" aria-labelledby="auth-security-title">
      <header class="auth-head">
        <h2 id="auth-security-title" class="auth-title">{{ t().settings }}</h2>
        <p class="auth-lede">{{ t().signedIn }} <strong>{{ email() }}</strong></p>
      </header>

      <div class="auth-sections">
        <section class="auth-section">
          <h3 class="auth-section-title">{{ t().passkeys }}</h3>
          @if (passkeys().length === 0) {
            <p class="auth-section-note">{{ t().noPasskeys }}</p>
          } @else {
            <ul class="auth-keys">
              @for (key of passkeys(); track key.id) {
                <li>
                  <span>{{ key.name || t().passkeyName }}</span>
                  <button type="button" class="button button-quiet" [disabled]="busy()" (click)="removePasskey(key.id)">{{ t().remove }}</button>
                </li>
              }
            </ul>
          }
          <button type="button" class="button button-primary" [disabled]="busy()" (click)="addPasskey()">{{ busy() ? t().processing : t().addPasskey }}</button>
        </section>

        <section class="auth-section">
          <h3 class="auth-section-title">{{ t().twoFactorSection }}</h3>
          @if (twoFactorEnabled()) { <p class="auth-section-note auth-section-ok">{{ t().twoFactorOn }}</p> }
          <div class="auth-field">
            <label class="auth-label" for="security-2fa-password">{{ t().enterPassword }}</label>
            <div appPasswordInput [inputId]="'security-2fa-password'" [inputName]="'password'" [showLabel]="t().showPassword" [autocomplete]="'current-password'" [(value)]="password"></div>
          </div>
          @if (twoFactorEnabled()) {
            <div class="auth-actions">
              <button type="button" class="button button-quiet" [disabled]="busy() || password().length < 12" (click)="turnOffTwoFactor()">{{ t().disableTwoFactor }}</button>
              <button type="button" class="button button-quiet" [disabled]="busy() || password().length < 12" (click)="rotateBackupCodes()">{{ t().rotateCodes }}</button>
            </div>
          } @else {
            <div class="auth-actions">
              <button type="button" class="button button-primary" [disabled]="busy() || password().length < 12 || !!totpUri()" (click)="startTwoFactor()">{{ t().enableTwoFactor }}</button>
            </div>
          }
          @if (totpUri()) {
            <div class="auth-setup">
              <p>{{ t().setup }}</p>
              <code class="auth-secret">{{ totpSecret() }}</code>
              <button type="button" class="button button-quiet" (click)="copySecret()">{{ t().copySecret }}</button>
              <div class="auth-field auth-field-code">
                <label class="auth-label" for="security-totp">{{ t().totpCode }}</label>
                <div class="auth-control">
                  <input #totp id="security-totp" name="code" class="auth-input auth-code is-totp" inputmode="numeric" autocomplete="one-time-code" autocorrect="off" spellcheck="false"
                    [value]="totpCode()" (input)="changeTotpCode(totp)" />
                </div>
              </div>
              <button type="button" class="button button-primary" [disabled]="busy() || totpCode().length < 6" (click)="confirmTwoFactor()">{{ t().confirmSetup }}</button>
            </div>
          }
          @if (backupCodes().length > 0) { <div role="status" class="auth-setup"><p>{{ t().backupCodes }}</p><code class="auth-secret auth-backup-codes">{{ backupText() }}</code></div> }
        </section>

        <section class="auth-section">
          <h3 class="auth-section-title">{{ t().changePassword }}</h3>
          <form id="auth-change-password" class="auth-form" method="post" (submit)="changePassword($event)">
            <!-- Tells password managers which saved login to update. -->
            <input class="sr-only" type="email" name="username" autocomplete="username" [value]="email()" readonly tabindex="-1" aria-hidden="true" />
            <div class="auth-field">
              <label class="auth-label" for="security-current-password">{{ t().currentPassword }}</label>
              <div appPasswordInput [inputId]="'security-current-password'" [inputName]="'current-password'" [showLabel]="t().showPassword" [autocomplete]="'current-password'"
                [minLength]="12" [maxLength]="128" [required]="true" [(value)]="password"></div>
            </div>
            <div class="auth-field">
              <label class="auth-label" for="security-new-password">{{ t().newPassword }}</label>
              <div appPasswordInput [inputId]="'security-new-password'" [inputName]="'new-password'" [showLabel]="t().showPassword" [hint]="true" [autocomplete]="'new-password'"
                [minLength]="12" [maxLength]="128" [required]="true" [(value)]="newPassword"></div>
              <p class="auth-hint" id="security-new-password-hint">{{ t().passwordHint }}</p>
            </div>
            <div class="auth-field">
              <label class="auth-label" for="security-confirm-password">{{ t().confirm }}</label>
              <div appPasswordInput [inputId]="'security-confirm-password'" [inputName]="'confirm-password'" [showLabel]="t().showPassword" [autocomplete]="'new-password'"
                [minLength]="12" [maxLength]="128" [required]="true" [(value)]="newPasswordConfirm"></div>
            </div>
            <button type="submit" class="button button-primary auth-submit" [disabled]="busy()">
              @if (busy()) { <span appSpinner></span> }{{ busy() ? t().processing : t().savePassword }}
            </button>
          </form>
        </section>
      </div>
      <div class="auth-feedback" role="status" aria-live="polite">@if (message()) { <p class="auth-notice auth-notice-ok">{{ message() }}</p> }</div>
      <div class="auth-feedback" role="alert">@if (error()) { <p class="auth-notice auth-notice-error">{{ error() }}</p> }</div>
      <button type="button" class="button button-quiet auth-signout" (click)="onSignOut()()">{{ t().signOut }}</button>
    </section>
  `,
})
class AccountSecurityComponent {
  protected readonly i18n = inject(I18nService);
  private readonly session = inject(SessionService);
  protected readonly t = computed(() => copy[this.i18n.locale()]);

  readonly email = input.required<string>();
  readonly onSignOut = input.required<() => void>();

  protected readonly password = signal("");
  protected readonly newPassword = signal("");
  protected readonly newPasswordConfirm = signal("");
  protected readonly totpCode = signal("");
  protected readonly totpUri = signal("");
  protected readonly backupCodes = signal<string[]>([]);
  protected readonly passkeys = signal<Array<{ id: string; name?: string | null }>>([]);
  protected readonly busy = signal(false);
  protected readonly message = signal("");
  protected readonly error = signal("");
  protected readonly twoFactorEnabled = computed(() => Boolean(this.session.data()?.user.twoFactorEnabled));
  protected readonly backupText = computed(() => this.backupCodes().join("\n"));
  /** The manual-entry key inside the otpauth:// URI (the whole URI if it has none). */
  protected readonly totpSecret = computed(() => new URLSearchParams(this.totpUri().split("?")[1] ?? "").get("secret") ?? this.totpUri());

  constructor() {
    void this.loadPasskeys();
  }

  private async loadPasskeys(): Promise<void> {
    const result = await authClient.passkey.listUserPasskeys();
    if (result.data) this.passkeys.set(result.data);
  }

  private refetchSession(): Promise<void> {
    return authClient.useSession.get().refetch();
  }

  private begin(): void {
    this.busy.set(true); this.error.set(""); this.message.set("");
  }

  private fail(cause: unknown): void {
    this.error.set(cause instanceof Shown ? cause.message : this.i18n.authErrorText(cause, this.t().genericError));
  }

  protected changeTotpCode(field: HTMLInputElement): void {
    const next = totpDigits(field.value);
    // Rejected characters leave the state as it was, so put the cleaned value back in the box by hand.
    if (field.value !== next) field.value = next;
    this.totpCode.set(next);
  }

  protected copySecret(): void {
    void navigator.clipboard?.writeText(this.totpSecret());
  }

  protected async startTwoFactor(): Promise<void> {
    this.begin();
    try {
      const result = await authClient.twoFactor.enable({ password: this.password(), method: "totp", issuer: "Grimoire" });
      if (result.error) throw result.error;
      if (result.data?.method === "totp") {
        this.totpUri.set(result.data.totpURI);
        this.backupCodes.set(result.data.backupCodes);
        this.message.set(this.t().setup);
      }
    } catch (cause) { this.fail(cause); }
    finally { this.busy.set(false); }
  }

  protected async confirmTwoFactor(): Promise<void> {
    this.begin();
    try {
      const result = await authClient.twoFactor.verifyTotp({ code: this.totpCode() });
      if (result.error) throw result.error;
      this.totpUri.set(""); this.totpCode.set(""); this.password.set("");
      this.message.set(this.t().twoFactorOn);
      await this.refetchSession();
    } catch (cause) { this.fail(cause); }
    finally { this.busy.set(false); }
  }

  protected async turnOffTwoFactor(): Promise<void> {
    this.begin();
    try {
      const result = await authClient.twoFactor.disable({ password: this.password() });
      if (result.error) throw result.error;
      this.password.set(""); this.message.set(this.t().twoFactorOff);
      await this.refetchSession();
    } catch (cause) { this.fail(cause); }
    finally { this.busy.set(false); }
  }

  protected async changePassword(event: Event): Promise<void> {
    event.preventDefault(); this.begin();
    try {
      if (this.newPassword() !== this.newPasswordConfirm()) throw new Shown(this.t().newPasswordMismatch);
      const result = await authClient.changePassword({ newPassword: this.newPassword(), currentPassword: this.password(), revokeOtherSessions: true });
      if (result.error) throw result.error;
      this.password.set(""); this.newPassword.set(""); this.newPasswordConfirm.set("");
      this.message.set(this.t().passwordChanged);
    } catch (cause) { this.fail(cause); }
    finally { this.busy.set(false); }
  }

  protected async rotateBackupCodes(): Promise<void> {
    this.begin();
    try {
      const result = await authClient.twoFactor.generateBackupCodes({ password: this.password() });
      if (result.error) throw result.error;
      this.backupCodes.set(result.data?.backupCodes ?? []);
      this.message.set(this.t().codesRotated);
    } catch (cause) { this.fail(cause); }
    finally { this.busy.set(false); }
  }

  protected async addPasskey(): Promise<void> {
    this.begin();
    try {
      const result = await authClient.passkey.addPasskey({ name: `Grimoire · ${new Date().toLocaleDateString()}` });
      const responseError = result.data && "error" in result.data ? result.data.error : undefined;
      if (result.error || responseError) throw result.error ?? responseError;
      this.message.set(this.t().passkeySaved);
      await this.loadPasskeys();
    } catch (cause) { this.fail(cause); }
    finally { this.busy.set(false); }
  }

  protected async removePasskey(id: string): Promise<void> {
    this.begin();
    try {
      const result = await authClient.passkey.deletePasskey({ id });
      if (result.error) throw result.error;
      await this.loadPasskeys();
    } catch (cause) { this.fail(cause); }
    finally { this.busy.set(false); }
  }
}

/** The sign-in gate's steps, or the account security section once there is a session. */
@Component({
  selector: "app-auth-panel",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccountSecurityComponent, PasswordInputComponent, SpinnerComponent],
  host: { class: "contents" },
  templateUrl: "./auth-panel.component.html",
})
export class AuthPanelComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  protected readonly session = inject(SessionService);
  protected readonly t = computed(() => copy[this.i18n.locale()]);

  readonly initialMode = input<AuthMode>("sign-in");

  protected readonly mode = signal<AuthMode>("sign-in");
  protected readonly email = signal("");
  protected readonly name = signal("");
  protected readonly password = signal("");
  protected readonly confirmation = signal("");
  protected readonly code = signal("");
  private readonly resetToken = signal("");
  protected readonly backupMode = signal(false);
  protected readonly busy = signal(false);
  protected readonly message = signal("");
  protected readonly error = signal("");

  private readonly codeInput = viewChild<ElementRef<HTMLInputElement>>("codeInput");

  protected readonly title = computed(() => {
    const t = this.t(), mode = this.mode();
    return mode === "reset-password" ? t.resetTitle : mode === "two-factor" ? t.twoFactorTitle : mode === "sign-up" ? t.createAccount : mode === "forgot-password" ? t.forgotTitle : t.title;
  });
  protected readonly kicker = computed(() => {
    const t = this.t(), mode = this.mode();
    return mode === "reset-password" ? t.kickerReset : mode === "two-factor" ? t.kickerTwoFactor : mode === "sign-up" ? t.kickerSignUp : mode === "forgot-password" ? t.kickerForgot : t.kickerSignIn;
  });
  protected readonly lede = computed(() => {
    const t = this.t(), mode = this.mode();
    return mode === "reset-password" ? t.ledeReset : mode === "two-factor" ? (this.backupMode() ? t.ledeBackup : t.ledeTotp) : mode === "sign-up" ? t.ledeSignUp : mode === "forgot-password" ? t.ledeForgot : "";
  });
  protected readonly submitLabel = computed(() => {
    const t = this.t(), mode = this.mode();
    return mode === "sign-in" ? t.signIn : mode === "sign-up" ? t.signUp : mode === "forgot-password" ? t.sendReset : mode === "reset-password" ? t.updatePassword : t.verify;
  });

  constructor() {
    // The code field takes focus when its step appears (it is created anew with each step's form).
    afterRenderEffect(() => this.codeInput()?.nativeElement.focus());
  }

  ngOnInit(): void {
    this.mode.set(this.initialMode());
    // A reset-password link lands here with `?token=…`.
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      this.resetToken.set(token);
      this.mode.set("reset-password");
    }
  }

  protected readonly signOut = async () => {
    await authClient.signOut();
    window.location.assign("/");
  };

  /**
   * Load the new session into better-auth's store; the shell then swaps this panel for the app (no full reload,
   * so the URL the person opened is kept). The sign-in calls pass `disableSignal` so better-auth doesn't fire
   * its own refetch in parallel; this is the one that counts. If get-session fails (e.g. rate-limited), say so
   * instead of silently showing the sign-in form again while the cookie is already set.
   */
  private async finishSignIn(): Promise<void> {
    await authClient.useSession.get().refetch();
    const loaded = (authClient.$store.atoms.session?.get() as { data?: { user?: unknown } | null } | undefined)?.data?.user;
    if (!loaded) throw new Shown(this.t().sessionNotLoaded);
  }

  private startTwoFactor(): void {
    // The password is no longer needed: the server keeps the challenge in its short-lived two_factor cookie.
    this.password.set("");
    this.code.set("");
    this.backupMode.set(false);
    this.mode.set("two-factor");
  }

  private fail(cause: unknown): void {
    this.error.set(cause instanceof Shown ? cause.message : this.i18n.authErrorText(cause, this.t().genericError));
  }

  private notice(text: string): void {
    this.error.set("");
    this.message.set(text);
  }

  /** Leave the current step for another one, clearing what the last step said. */
  protected goTo(mode: AuthMode): void {
    this.message.set("");
    this.error.set("");
    this.mode.set(mode);
  }

  protected changeCode(field: HTMLInputElement): void {
    const next = this.backupMode() ? field.value : totpDigits(field.value);
    // Rejected characters leave the state as it was, so put the cleaned value back in the box by hand.
    if (field.value !== next) field.value = next;
    this.code.set(next);
  }

  protected toggleBackupMode(): void {
    this.backupMode.update((value) => !value);
    this.code.set("");
    document.getElementById("auth-code")?.focus();
  }

  protected async handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const t = this.t();
    this.busy.set(true);
    this.error.set("");
    this.message.set("");
    try {
      const mode = this.mode();
      if (mode === "sign-up") {
        if (this.password() !== this.confirmation()) throw new Shown(t.passwordMismatch);
        const result = await authClient.signUp.email({ name: this.name().trim(), email: this.email().trim(), password: this.password(), fetchOptions: { disableSignal: true } });
        if (result.error) throw result.error;
        // The server signs the new account in directly.
        if (result.data && "token" in result.data && result.data.token) await this.finishSignIn();
        else this.notice(t.created);
      } else if (mode === "sign-in") {
        // No callbackURL: with one, better-auth's redirect plugin navigates away on success and races this flow.
        const result = await authClient.signIn.email({ email: this.email().trim(), password: this.password(), fetchOptions: { disableSignal: true } });
        if (result.error) throw result.error;
        if (result.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect) this.startTwoFactor();
        else await this.finishSignIn();
      } else if (mode === "forgot-password") {
        const result = await authClient.requestPasswordReset({ email: this.email().trim(), redirectTo: `${window.location.origin}/?auth=reset-password` });
        if (result.error) throw result.error;
        this.notice(t.checkEmail);
      } else if (mode === "reset-password") {
        if (!this.resetToken()) throw new Shown(t.genericError);
        if (this.password() !== this.confirmation()) throw new Shown(t.passwordMismatch);
        const result = await authClient.resetPassword({ newPassword: this.password(), token: this.resetToken() });
        if (result.error) throw result.error;
        this.notice(t.passwordReset);
        this.mode.set("sign-in");
      } else if (mode === "two-factor") {
        const fetchOptions = { disableSignal: true };
        const result = this.backupMode()
          ? await authClient.twoFactor.verifyBackupCode({ code: this.code().trim(), fetchOptions })
          // Authenticator apps often show "123 456".
          : await authClient.twoFactor.verifyTotp({ code: this.code().replace(/\s+/g, ""), trustDevice: false, fetchOptions });
        if (result.error) {
          if (authErrorKind(result.error) === "expired") {
            // The server consumed or expired the challenge: only a new password sign-in can start another one.
            this.code.set("");
            this.mode.set("sign-in");
            this.fail(result.error);
            return;
          }
          throw result.error;
        }
        await this.finishSignIn();
      }
    } catch (cause) {
      this.fail(cause);
    } finally {
      this.busy.set(false);
    }
  }

  protected async signInWithPasskey(): Promise<void> {
    this.busy.set(true);
    this.error.set("");
    try {
      const result = await authClient.signIn.passkey({});
      const responseError = result.data && "error" in result.data ? result.data.error : undefined;
      if (result.error || responseError) throw result.error ?? responseError;
      await this.finishSignIn();
    } catch (cause) {
      this.fail(cause);
    } finally {
      this.busy.set(false);
    }
  }
}
