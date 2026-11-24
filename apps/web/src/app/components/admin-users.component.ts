import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from "@angular/core";
import type { AccountStatus, SiteRole } from "@grimoire/shared/permissions";
import { api, type AdminUser, type Me } from "../core/api-client";
import { FeedbackService } from "../core/feedback.service";
import { I18nService } from "../core/i18n.service";
import { SKELETONS } from "./skeleton.component";

const text = {
  en: {
    pending: "Waiting for approval", approved: "Members", blocked: "Blocked",
    noPending: "No one is waiting. New sign-ups appear here until you approve them.",
    approve: "Approve", reject: "Block", unblock: "Unblock", block: "Block", signOut: "Sign out everywhere", delete: "Delete",
    role: "Role", roles: { admin: "Admin", user: "Member" } as Record<SiteRole, string>,
    joined: (date: string) => `joined ${date}`, you: "you",
    stats: (campaigns: number, characters: number) => `${campaigns} campaign${campaigns === 1 ? "" : "s"} · ${characters} character${characters === 1 ? "" : "s"}`,
    twoFactor: "2FA",
    deleteConfirm: (name: string) => `Delete ${name}'s account?`,
    deleteBody: "Their characters and the campaigns they created are deleted too. This can't be undone.",
    blockConfirm: (name: string) => `Block ${name}?`,
    blockBody: "They'll be signed out and can't sign in until you unblock them.",
    approvedDone: (name: string) => `${name} can now use the Grimoire.`, blockedDone: (name: string) => `${name} is blocked.`,
    unblocked: (name: string) => `${name} is unblocked.`, deleted: (name: string) => `${name}'s account was deleted.`,
    roleChanged: (name: string, role: string) => `${name} is now ${role}.`,
    revoked: "Sessions closed.", error: "That change couldn't be saved.", loading: "Reading the roll of names…",
    roleHelp: "New sign-ups wait here until an admin approves them. Admins manage accounts; being a DM or a player depends on each campaign (its creator is the DM).",
  },
  es: {
    pending: "Pendientes de aprobación", approved: "Miembros", blocked: "Bloqueados",
    noPending: "No hay nadie esperando. Los registros nuevos aparecen aquí hasta que los apruebes.",
    approve: "Aprobar", reject: "Bloquear", unblock: "Desbloquear", block: "Bloquear", signOut: "Cerrar sus sesiones", delete: "Eliminar",
    role: "Rol", roles: { admin: "Admin", user: "Miembro" } as Record<SiteRole, string>,
    joined: (date: string) => `desde ${date}`, you: "tú",
    stats: (campaigns: number, characters: number) => `${campaigns} campaña${campaigns === 1 ? "" : "s"} · ${characters} personaje${characters === 1 ? "" : "s"}`,
    twoFactor: "2FA",
    deleteConfirm: (name: string) => `¿Eliminar la cuenta de ${name}?`,
    deleteBody: "También se borran sus personajes y las campañas que creó. No se puede deshacer.",
    blockConfirm: (name: string) => `¿Bloquear a ${name}?`,
    blockBody: "Se cerrarán sus sesiones y no podrá entrar hasta que lo desbloquees.",
    approvedDone: (name: string) => `${name} ya puede usar el Grimorio.`, blockedDone: (name: string) => `${name} está bloqueado.`,
    unblocked: (name: string) => `${name} está desbloqueado.`, deleted: (name: string) => `Se ha eliminado la cuenta de ${name}.`,
    roleChanged: (name: string, role: string) => `${name} ahora es ${role}.`,
    revoked: "Sesiones cerradas.", error: "No se pudo guardar el cambio.", loading: "Leyendo el registro de nombres…",
    roleHelp: "Los registros nuevos esperan aquí hasta que un admin los apruebe. Los admins gestionan cuentas; ser DM o jugador depende de cada campaña (quien la crea es el DM).",
  },
};

type Change = { role?: SiteRole; status?: AccountStatus; revokeSessions?: boolean } | "delete";

/** Account approval, roles, blocking and cleanup for site admins. */
@Component({
  selector: "app-admin-users",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SKELETONS],
  host: { class: "contents" },
  templateUrl: "./admin-users.component.html",
})
export class AdminUsersComponent {
  private readonly i18n = inject(I18nService);
  private readonly feedback = inject(FeedbackService);
  protected readonly t = computed(() => text[this.i18n.locale()]);

  readonly me = input.required<Me>();
  readonly onPendingCount = input<(count: number) => void>();

  protected readonly users = signal<AdminUser[] | null>(null);
  protected readonly busyId = signal("");
  /** Only a failed first load is shown inline; the outcome of each action is a toast. */
  protected readonly error = signal("");
  protected readonly placeholders = [0, 1, 2, 3];
  protected readonly roles = ["user", "admin"] as const;

  protected readonly groups = computed(() => {
    const users = this.users() ?? [];
    const me = this.me();
    const busyId = this.busyId();
    const t = this.t();
    const dateFormat = new Intl.DateTimeFormat(this.i18n.locale() === "es" ? "es-ES" : "en-US", { dateStyle: "medium" });
    const groups: { status: AccountStatus; title: string }[] = [
      { status: "pending", title: t.pending },
      { status: "approved", title: t.approved },
      { status: "blocked", title: t.blocked },
    ];
    return groups.flatMap(({ status, title }) => {
      const members = users.filter((user) => user.status === status);
      if (status !== "pending" && !members.length) return [];
      return [{
        status,
        title,
        members: members.map((user) => ({
          user,
          isMe: user.id === me.id,
          busy: busyId === user.id,
          seal: user.name.slice(0, 1).toLocaleUpperCase(),
          meta: `${t.joined(dateFormat.format(new Date(user.createdAt)))} · ${t.stats(user.campaignCount, user.characterCount)}`,
        })),
      }];
    });
  });

  constructor() {
    // Loads again whenever the callback or the language changes; a failure is reported in the language of that attempt.
    effect(() => {
      const message = this.t().error;
      this.onPendingCount();
      untracked(() => { this.load().catch(() => this.error.set(message)); });
    });
  }

  private async load(): Promise<void> {
    const data = await api<{ users: AdminUser[] }>("/api/admin/users");
    this.users.set(data.users);
    this.onPendingCount()?.(data.users.filter((user) => user.status === "pending").length);
  }

  protected async change(user: AdminUser, body: Change): Promise<void> {
    const t = this.t();
    this.busyId.set(user.id);
    try {
      if (body === "delete") await api(`/api/admin/users/${user.id}`, { method: "DELETE" });
      else await api(`/api/admin/users/${user.id}`, { method: "PATCH", body });
      this.feedback.toast.success(body === "delete" ? t.deleted(user.name)
        : body.revokeSessions ? t.revoked
        : body.role ? t.roleChanged(user.name, t.roles[body.role])
        : body.status === "blocked" ? t.blockedDone(user.name)
        : user.status === "blocked" ? t.unblocked(user.name) : t.approvedDone(user.name));
      await this.load();
    } catch (cause) {
      this.feedback.toast.error(this.i18n.errorText(cause, t.error));
    } finally {
      this.busyId.set("");
    }
  }

  protected changeRole(user: AdminUser, select: HTMLSelectElement): void {
    const role = select.value as SiteRole;
    // The select shows the saved role: put it back until the reload brings the new one (or the change fails).
    select.value = user.role;
    void this.change(user, { role });
  }

  protected async block(user: AdminUser): Promise<void> {
    const t = this.t();
    if (await this.feedback.confirm({ title: t.blockConfirm(user.name), message: t.blockBody, confirmLabel: t.block, tone: "danger" })) await this.change(user, { status: "blocked" });
  }

  protected async remove(user: AdminUser): Promise<void> {
    const t = this.t();
    if (await this.feedback.confirm({ title: t.deleteConfirm(user.name), message: t.deleteBody, confirmLabel: t.delete, tone: "danger" })) await this.change(user, "delete");
  }
}
