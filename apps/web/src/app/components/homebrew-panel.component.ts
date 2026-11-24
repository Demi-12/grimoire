import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from "@angular/core";
import { homebrewSlug } from "@grimoire/shared/homebrew";
import { api, type Campaign, type CatalogCreature, type HomebrewMonster, type Me } from "../core/api-client";
import { FeedbackService } from "../core/feedback.service";
import { I18nService } from "../core/i18n.service";
import { HomebrewEditorComponent } from "./homebrew-editor.component";
import { MonsterSheetComponent } from "./monster-sheet.component";
import { SkeletonComponent, SkeletonRegionComponent } from "./skeleton.component";

const copy = {
  en: {
    title: "Homebrew monsters", intro: "Build your own monsters with a full stat block. They are private until you share them with a campaign or publish them to everyone on this server.",
    create: "New monster", search: "Search homebrew", scopes: { all: "All", mine: "Mine", shared: "Shared with me" }, scopesLabel: "Show",
    empty: "No homebrew monsters here yet.", emptyMine: "You have not made any yet.", loading: "Opening the homebrew shelf…", loadError: "Could not load the homebrew monsters.", retry: "Retry",
    by: (name: string) => `by ${name}`, cr: "CR", visibility: { private: "Private", campaign: "Campaign", instance: "Server" }, locked: "Locked",
    edit: "Edit", remove: "Delete", confirmRemove: (name: string) => `Delete “${name}” for good?`,
    removeBody: "Everyone you shared it with loses it too. This can't be undone.", removed: (name: string) => `“${name}” was deleted.`,
    saved: (name: string) => `“${name}” saved.`, lockedDone: (name: string) => `“${name}” is locked and private.`, unlockedDone: (name: string) => `“${name}” is unlocked.`,
    add: "Add to encounter list", adding: "Adding…", added: "Added to encounter list",
    lock: "Lock and unpublish", unlock: "Unlock", moderation: "Moderation",
    lockedNote: "An admin locked this monster; it stays private until they unlock it.",
    actionError: "That did not work.",
  },
  es: {
    title: "Monstruos homebrew", intro: "Crea tus propios monstruos con una ficha completa. Son privados hasta que los compartes con una campaña o los publicas para todos en este servidor.",
    create: "Nuevo monstruo", search: "Buscar homebrew", scopes: { all: "Todos", mine: "Míos", shared: "Compartidos conmigo" }, scopesLabel: "Mostrar",
    empty: "Aún no hay monstruos homebrew aquí.", emptyMine: "Todavía no has creado ninguno.", loading: "Abriendo la estantería homebrew…", loadError: "No se han podido cargar los monstruos homebrew.", retry: "Reintentar",
    by: (name: string) => `de ${name}`, cr: "VD", visibility: { private: "Privado", campaign: "Campaña", instance: "Servidor" }, locked: "Bloqueado",
    edit: "Editar", remove: "Borrar", confirmRemove: (name: string) => `¿Borrar «${name}» para siempre?`,
    removeBody: "Quien lo tuviera compartido también lo pierde. No se puede deshacer.", removed: (name: string) => `«${name}» se ha borrado.`,
    saved: (name: string) => `«${name}» guardado.`, lockedDone: (name: string) => `«${name}» está bloqueado y es privado.`, unlockedDone: (name: string) => `«${name}» está desbloqueado.`,
    add: "Añadir al catálogo de encuentros", adding: "Añadiendo…", added: "Añadido al catálogo de encuentros",
    lock: "Bloquear y retirar", unlock: "Desbloquear", moderation: "Moderación",
    lockedNote: "Un admin ha bloqueado este monstruo; sigue privado hasta que lo desbloquee.",
    actionError: "No se ha podido completar.",
  },
} as const;

type Scope = "all" | "mine" | "shared";
const scopes: Scope[] = ["all", "mine", "shared"];
const ratingLabel = (value: number) => (value === 0.125 ? "1/8" : value === 0.25 ? "1/4" : value === 0.5 ? "1/2" : String(value));

/**
 * The Homebrew tab of the bestiary: the monsters the person can see (their own, shared with their
 * campaigns, published to the server), the stat block of the one selected with its actions (add to the
 * encounter list, edit, delete, and an admin's lock), and the editor in place of the list while editing.
 */
@Component({
  selector: "app-homebrew-panel",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HomebrewEditorComponent, MonsterSheetComponent, SkeletonComponent, SkeletonRegionComponent],
  styleUrl: "./homebrew.component.css",
  host: { class: "contents" },
  templateUrl: "./homebrew-panel.component.html",
})
export class HomebrewPanelComponent {
  private readonly i18n = inject(I18nService);
  private readonly feedback = inject(FeedbackService);

  readonly me = input.required<Pick<Me, "id" | "name" | "role">>();
  readonly campaigns = input.required<Campaign[]>();
  /** Adds a monster to the encounter generator's catalog (the same hook the SRD bestiary uses). */
  readonly onAddCreature = input<(creature: Omit<CatalogCreature, "id">) => void>();

  protected readonly t = computed(() => copy[this.i18n.locale()]);
  protected readonly monsters = signal<HomebrewMonster[] | null>(null);
  protected readonly loadError = signal(false);
  private readonly attempt = signal(0);
  protected readonly scope = signal<Scope>("all");
  protected readonly query = signal("");
  protected readonly selectedId = signal<string | null>(null);
  protected readonly editing = signal<{ monster: HomebrewMonster | null } | null>(null);
  protected readonly busy = signal(false);
  protected readonly addedId = signal("");

  protected readonly scopes = scopes;
  protected readonly ratingLabel = ratingLabel;
  protected readonly homebrewSlug = homebrewSlug;

  protected readonly visible = computed(() => {
    const locale = this.i18n.locale();
    const scope = this.scope();
    const needle = this.query().trim().toLocaleLowerCase(locale);
    return (this.monsters() ?? []).filter((monster) =>
      (scope === "all" || (scope === "mine" ? monster.mine : !monster.mine))
      && (!needle || `${monster.name} ${monster.type} ${monster.ownerName}`.toLocaleLowerCase(locale).includes(needle)));
  });
  protected readonly selected = computed(() => this.monsters()?.find((monster) => monster.id === this.selectedId()) ?? null);
  protected readonly noneOfMine = computed(() => !(this.monsters() ?? []).some((monster) => monster.mine));

  constructor() {
    effect((onCleanup) => {
      this.attempt();
      let cancelled = false;
      untracked(() => {
        this.loadError.set(false);
        api<{ monsters: HomebrewMonster[] }>("/api/homebrew")
          .then((data) => { if (!cancelled) this.monsters.set(data.monsters); })
          .catch(() => { if (!cancelled) this.loadError.set(true); });
      });
      onCleanup(() => { cancelled = true; });
    });
  }

  protected retry(): void {
    this.attempt.update((n) => n + 1);
  }

  private replace(monster: HomebrewMonster): void {
    this.monsters.update((current) => (current ?? []).some((item) => item.id === monster.id)
      ? (current ?? []).map((item) => (item.id === monster.id ? monster : item))
      : [monster, ...(current ?? [])]);
  }

  private async run(work: () => Promise<void>, success: string): Promise<void> {
    this.busy.set(true);
    try { await work(); this.feedback.toast.success(success); } catch (cause) { this.feedback.toast.error(this.i18n.errorText(cause, this.t().actionError)); } finally { this.busy.set(false); }
  }

  protected async remove(monster: HomebrewMonster): Promise<void> {
    const t = this.t();
    if (!await this.feedback.confirm({ title: t.confirmRemove(monster.name), message: t.removeBody, confirmLabel: t.remove, tone: "danger" })) return;
    await this.run(async () => {
      await api(`/api/homebrew/${monster.id}`, { method: "DELETE" });
      this.monsters.update((current) => (current ?? []).filter((item) => item.id !== monster.id));
      this.selectedId.set(null);
    }, t.removed(monster.name));
  }

  protected setLocked(monster: HomebrewMonster, locked: boolean): void {
    const t = this.t();
    void this.run(async () => {
      const { monster: updated } = await api<{ monster: HomebrewMonster }>(`/api/homebrew/${monster.id}`, { method: "PATCH", body: { locked } });
      // Locking makes the monster private, so it leaves everyone else's list (an admin keeps seeing it to unlock it).
      this.replace(updated);
    }, locked ? t.lockedDone(monster.name) : t.unlockedDone(monster.name));
  }

  protected addToEncounters(monster: HomebrewMonster): void {
    const onAddCreature = this.onAddCreature();
    if (!onAddCreature) return;
    onAddCreature({ name: monster.name, xp: monster.xp, source: "Homebrew", monsterSlug: homebrewSlug(monster.id), cr: monster.cr, type: monster.type || undefined, roleTags: monster.roleTags });
    this.addedId.set(monster.id);
  }

  protected readonly cancelEditing = (): void => {
    this.editing.set(null);
  };

  protected readonly saved = (monster: HomebrewMonster): void => {
    this.replace(monster);
    this.selectedId.set(monster.id);
    this.editing.set(null);
    this.addedId.set("");
    this.feedback.toast.success(this.t().saved(monster.name));
  };
}
