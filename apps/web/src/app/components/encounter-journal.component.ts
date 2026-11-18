import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from "@angular/core";
import { creatureTypeKey, creatureTypeLabel, formatChallenge } from "@grimoire/shared/monster-api";
import { api, type Campaign, type EncounterLine, type SavedEncounter } from "../core/api-client";
import { FeedbackService } from "../core/feedback.service";
import { I18nService } from "../core/i18n.service";
import { SKELETONS } from "./skeleton.component";

const text = {
  en: {
    loading: "Loading the journal…", empty: "No encounters saved yet. Generate one in the encounter builder and save it to this campaign.",
    loadError: "The journal couldn't be loaded.", retry: "Retry", error: "That change couldn't be saved. Try again.",
    dmOnly: "Only the DMs of this campaign can see these encounters.",
    planned: "Planned", played: "Played", xp: "XP", budget: "budget", cr: "CR",
    difficulty: { low: "Low", moderate: "Moderate", high: "High" },
    notes: "Notes", saveNotes: "Save notes", markPlayed: "Mark as played", markPlanned: "Back to planned",
    remove: "Delete", confirmDelete: (title: string) => `Delete “${title}” from the journal?`, cannotUndo: "Its notes are deleted too. This can't be undone.",
    deleted: (title: string) => `“${title}” was deleted.`, notesSaved: "Notes saved.", markedPlayed: (title: string) => `“${title}” marked as played.`, markedPlanned: (title: string) => `“${title}” is planned again.`,
    party: (levels: number[]) => `Party levels ${levels.join(", ")}`, by: (name: string) => `by ${name}`,
  },
  es: {
    loading: "Cargando el diario…", empty: "Aún no hay encuentros guardados. Genera uno en el generador de encuentros y guárdalo en esta campaña.",
    loadError: "No se pudo cargar el diario.", retry: "Reintentar", error: "No se pudo guardar el cambio. Inténtalo de nuevo.",
    dmOnly: "Solo los DMs de esta campaña ven estos encuentros.",
    planned: "Planificados", played: "Jugados", xp: "XP", budget: "presupuesto", cr: "CR",
    difficulty: { low: "Baja", moderate: "Moderada", high: "Alta" },
    notes: "Notas", saveNotes: "Guardar notas", markPlayed: "Marcar como jugado", markPlanned: "Volver a planificado",
    remove: "Borrar", confirmDelete: (title: string) => `¿Borrar «${title}» del diario?`, cannotUndo: "También se borran sus notas. No se puede deshacer.",
    deleted: (title: string) => `«${title}» se ha borrado.`, notesSaved: "Notas guardadas.", markedPlayed: (title: string) => `«${title}» marcado como jugado.`, markedPlanned: (title: string) => `«${title}» vuelve a planificados.`,
    party: (levels: number[]) => `Niveles del grupo ${levels.join(", ")}`, by: (name: string) => `de ${name}`,
  },
};

const byDate = (a: SavedEncounter, b: SavedEncounter) => (a.status === "played" ? (b.playedAt ?? b.createdAt).localeCompare(a.playedAt ?? a.createdAt) : b.createdAt.localeCompare(a.createdAt));

/** DM-only journal of saved encounters for one campaign: planned first, then played. */
@Component({
  selector: "app-encounter-journal",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SKELETONS],
  styleUrl: "./encounter-journal.component.css",
  host: { class: "contents" },
  templateUrl: "./encounter-journal.component.html",
})
export class EncounterJournalComponent {
  private readonly i18n = inject(I18nService);
  private readonly feedback = inject(FeedbackService);
  protected readonly t = computed(() => text[this.i18n.locale()]);

  readonly campaign = input.required<Campaign>();

  protected readonly items = signal<SavedEncounter[] | null>(null);
  protected readonly loadFailed = signal(false);
  protected readonly busyId = signal("");
  protected readonly drafts = signal<Record<string, string>>({});
  private readonly campaignId = computed(() => this.campaign().id);

  protected readonly groups = computed(() => {
    const items = this.items() ?? [];
    const t = this.t();
    return [
      { key: "planned" as const, label: t.planned, list: items.filter((item) => item.status === "planned").sort(byDate) },
      { key: "played" as const, label: t.played, list: items.filter((item) => item.status === "played").sort(byDate) },
    ].filter((group) => group.list.length);
  });

  constructor() {
    effect(() => {
      this.campaignId();
      untracked(() => this.load());
    });
  }

  protected readonly load = (): void => {
    const campaignId = this.campaignId();
    this.loadFailed.set(false);
    this.items.set(null);
    api<{ encounters: SavedEncounter[] }>(`/api/campaigns/${campaignId}/encounters`)
      .then((data) => this.items.set(data.encounters))
      .catch(() => this.loadFailed.set(true));
  };

  private numberLocale(): string {
    return this.i18n.locale() === "es" ? "es-ES" : "en-US";
  }

  protected meta(item: SavedEncounter): string {
    const t = this.t();
    const numberLocale = this.numberLocale();
    return `${t.difficulty[item.difficulty]} · ${item.totalXp.toLocaleString(numberLocale)} / ${item.budget.toLocaleString(numberLocale)} ${t.xp} · ${t.party(item.partyLevels)}${item.createdByName ? ` · ${t.by(item.createdByName)}` : ""}`;
  }

  protected lineDetail(line: EncounterLine): string {
    const t = this.t();
    return [
      line.cr !== undefined ? `${t.cr} ${formatChallenge(line.cr)}` : "",
      line.type ? creatureTypeLabel(creatureTypeKey(line.type), this.i18n.locale()) : "",
      `${line.xp.toLocaleString(this.numberLocale())} ${t.xp}`,
    ].filter(Boolean).map((part) => ` · ${part}`).join("");
  }

  protected setDraft(id: string, value: string): void {
    this.drafts.update((current) => ({ ...current, [id]: value }));
  }

  private async change(id: string, action: () => Promise<SavedEncounter | null>, success: string): Promise<void> {
    this.busyId.set(id);
    try {
      const updated = await action();
      this.items.update((current) => current && (updated ? current.map((item) => item.id === id ? updated : item) : current.filter((item) => item.id !== id)));
      if (updated) this.drafts.update((current) => { const { [id]: _drop, ...rest } = current; return rest; });
      this.feedback.toast.success(success);
    } catch {
      this.feedback.toast.error(this.t().error);
    } finally {
      this.busyId.set("");
    }
  }

  protected patch(item: SavedEncounter, body: { notes?: string; status?: "planned" | "played" }): Promise<void> {
    const t = this.t();
    return this.change(item.id, async () =>
      (await api<{ encounter: SavedEncounter }>(`/api/campaigns/${this.campaignId()}/encounters/${item.id}`, { method: "PATCH", body })).encounter,
    body.status ? (body.status === "played" ? t.markedPlayed(item.title) : t.markedPlanned(item.title)) : t.notesSaved);
  }

  protected async remove(item: SavedEncounter): Promise<void> {
    const t = this.t();
    if (!await this.feedback.confirm({ title: t.confirmDelete(item.title), message: t.cannotUndo, confirmLabel: t.remove, tone: "danger" })) return;
    await this.change(item.id, async () => { await api(`/api/campaigns/${this.campaignId()}/encounters/${item.id}`, { method: "DELETE" }); return null; }, t.deleted(item.title));
  }
}
