import {
  afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, signal, viewChild,
} from "@angular/core";
import { signed } from "@grimoire/shared/character-view";
import { say, type Text } from "@grimoire/shared/dnd2024";
import { abilityModifier, proficiencyBonus } from "@grimoire/shared/rules";
import {
  castingFor, cleanSpells, sheetSpells, slotRows, spellLevelName, spellsLeft, withSlotUsed, type Casting, type SheetSpell, type SpellChoices,
} from "@grimoire/shared/spells";
import type { Character } from "../core/api-client";
import { FeedbackService } from "../core/feedback.service";
import { I18nService } from "../core/i18n.service";
import { SpellDetailsComponent, SpellManagerComponent } from "./spell-manager.component";

/**
 * The Spells panel of the on-screen character sheet (CharacterSpellsComponent) and its expandable spell
 * rows (SpellRowComponent), plus `castingNumbers`, which the printed sheet also uses.
 * Picking spells happens in SpellManagerComponent, opened here in a modal dialog.
 */

/* The same panel and stat tiles as the rest of the sheet (character-sheet-view.component.ts). */
const panel = "panel min-w-0 px-4 pt-3.5 pb-4";
const panelTitle = "m-0 font-display text-[16px] font-semibold text-accent";
const statBox = "grid justify-items-center gap-0.5 rounded-control border border-line bg-paper px-1.5 py-2.5 text-center";
const statLabel = "font-label text-xs font-semibold tracking-[.06em] text-muted uppercase";
const statValue = "font-display text-2xl font-bold text-ink";

const copy = {
  en: {
    title: "Spells", ability: "Ability", dc: "Spell save DC", attack: "Spell attack", slots: "Spell slots", pact: "Pact Magic slots", pactHelp: "They come back on a Short Rest.",
    slotsHelp: "Tap a slot when you spend it.", readOnlySlot: (level: number, left: number, total: number) => `Level ${level}: ${left} of ${total} left`,
    slot: (level: number, index: number, spent: boolean) => `Level ${level} slot ${index}: ${spent ? "spent, tap to recover" : "available, tap to spend"}`,
    rest: "Long Rest: recover all", manage: "Manage spells", add: "Choose spells", none: "No spells chosen yet.", close: "Close", save: "Save spells", cancel: "Cancel",
    saved: "Spells saved.", failed: "The spells couldn't be saved.", concentration: "Concentration", ritual: "Ritual", custom: "Not in the free rules: look it up in your book.",
    sources: { class: "", book: "Spellbook", extra: "Other source", custom: "" } as Record<string, string>,
    missing: (cantrips: number, prepared: number) => `You can still choose ${[cantrips ? `${cantrips} ${cantrips === 1 ? "cantrip" : "cantrips"}` : "", prepared ? `${prepared} ${prepared === 1 ? "spell" : "spells"}` : ""].filter(Boolean).join(" and ")}.`,
    left: "left",
  },
  es: {
    title: "Conjuros", ability: "Característica", dc: "CD de conjuros", attack: "Ataque de conjuro", slots: "Espacios de conjuro", pact: "Espacios de Magia del pacto", pactHelp: "Se recuperan con un descanso corto.",
    slotsHelp: "Toca un espacio cuando lo gastes.", readOnlySlot: (level: number, left: number, total: number) => `Nivel ${level}: quedan ${left} de ${total}`,
    slot: (level: number, index: number, spent: boolean) => `Espacio ${index} de nivel ${level}: ${spent ? "gastado, toca para recuperarlo" : "disponible, toca para gastarlo"}`,
    rest: "Descanso largo: recuperar todos", manage: "Gestionar conjuros", add: "Elegir conjuros", none: "Aún no has elegido conjuros.", close: "Cerrar", save: "Guardar conjuros", cancel: "Cancelar",
    saved: "Conjuros guardados.", failed: "No se han podido guardar los conjuros.", concentration: "Concentración", ritual: "Ritual", custom: "No está en las reglas gratuitas: consúltalo en tu manual.",
    sources: { class: "", book: "Libro", extra: "Otra fuente", custom: "" } as Record<string, string>,
    missing: (cantrips: number, prepared: number) => `Aún puedes elegir ${[cantrips ? `${cantrips} ${cantrips === 1 ? "truco" : "trucos"}` : "", prepared ? `${prepared} ${prepared === 1 ? "conjuro" : "conjuros"}` : ""].filter(Boolean).join(" y ")}.`,
    left: "quedan",
  },
};

/** Spell save DC and attack bonus for the ability the character casts with. */
export function castingNumbers(casting: Casting, score: number, level: number): { dc: number; attack: number } {
  const bonus = proficiencyBonus(level) + abilityModifier(score);
  return { dc: 8 + bonus, attack: bonus };
}

/** One spell of the list: its name and tags, opening onto its rules text. */
@Component({
  selector: "li[appSpellRow]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpellDetailsComponent],
  styleUrl: "./character-spells.component.css",
  template: `
    <button type="button" class="spell" [attr.aria-expanded]="open()" (click)="open.set(!open())">
      <span>{{ say(entry().name) }}</span>@if (tags().length > 0) {<small>{{ tags().join(" · ") }}</small>}<i aria-hidden="true">{{ open() ? "−" : "+" }}</i>
    </button>
    @if (open()) {
      @if (entry().spell; as spell) { <app-spell-details [spell]="spell" /> } @else { <p class="help">{{ c().custom }}</p> }
    }
  `,
})
class SpellRowComponent {
  private readonly i18n = inject(I18nService);
  protected readonly c = computed(() => copy[this.i18n.locale()]);

  readonly entry = input.required<SheetSpell>();

  protected readonly open = signal(false);
  protected readonly tags = computed(() => {
    const c = this.c();
    const entry = this.entry();
    return [c.sources[entry.source], entry.spell?.concentration ? c.concentration : "", entry.spell?.ritual ? c.ritual : ""].filter(Boolean);
  });

  protected say(text: Text): string {
    return say(text, this.i18n.locale());
  }
}

/** The Spells panel of the on-screen sheet: casting numbers, slots to tick off, and the spells with their rules text. */
@Component({
  selector: "app-character-spells",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpellRowComponent, SpellManagerComponent],
  styleUrl: "./character-spells.component.css",
  host: { class: "contents" },
  templateUrl: "./character-spells.component.html",
})
export class CharacterSpellsComponent {
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(FeedbackService).toast;
  protected readonly c = computed(() => copy[this.i18n.locale()]);
  protected readonly translate = this.i18n.t;

  readonly character = input.required<Character>();
  readonly scores = input.required<Character["scores"]>();
  /** Only passed when the viewer may change the character. */
  readonly onSave = input<(spells: SpellChoices | undefined) => Promise<void>>();

  /** Shown while a change is on its way to the server, so slots react at once. */
  protected readonly pending = signal<{ spells: SpellChoices | undefined } | null>(null);
  protected readonly draft = signal<{ spells: SpellChoices | undefined } | null>(null);
  protected readonly saving = signal(false);
  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>("dialog");

  protected readonly build = computed(() => this.character().build);
  protected readonly casting = computed(() => { const build = this.build(); return build ? castingFor(build, this.character().level) : null; });
  protected readonly choices = computed(() => { const pending = this.pending(); return pending ? pending.spells : this.build()?.spells; });
  protected readonly groups = computed(() => sheetSpells(this.choices(), this.i18n.locale()));
  /** Nothing to show for a character who neither casts nor has picked up any spell. */
  protected readonly visible = computed(() => Boolean(this.build()) && (Boolean(this.casting()) || this.groups().length > 0));
  protected readonly numbers = computed(() => { const casting = this.casting(); return casting ? castingNumbers(casting, this.scores()[casting.ability], this.character().level) : null; });
  protected readonly slots = computed(() => {
    const casting = this.casting();
    return (casting ? slotRows(casting, this.choices()) : []).map((row) => ({ ...row, pips: Array.from({ length: row.total }, (_, index) => index) }));
  });
  protected readonly anySpent = computed(() => this.slots().some((row) => row.used > 0));
  protected readonly missing = computed(() => {
    const build = this.build();
    return build ? spellsLeft({ ...build, spells: this.choices() }, this.character().level) : { cantrips: 0, prepared: 0 };
  });
  protected readonly slotsHelp = computed(() => [this.onSave() ? this.c().slotsHelp : "", this.casting()?.pact ? this.c().pactHelp : ""].filter(Boolean).join(" "));

  protected readonly panel = panel;
  protected readonly panelTitle = panelTitle;
  protected readonly statBox = statBox;
  protected readonly statLabel = statLabel;
  protected readonly statValue = statValue;
  protected readonly signed = signed;

  constructor() {
    afterRenderEffect(() => {
      const dialog = this.dialogRef()?.nativeElement;
      if (this.draft() && dialog && !dialog.open) dialog.showModal();
    });
  }

  protected levelName(level: number): string {
    return spellLevelName(level, this.i18n.locale());
  }

  protected readonly changeDraft = (spells: SpellChoices): void => this.draft.set({ spells });

  protected openManager(): void {
    this.draft.set({ spells: this.choices() });
  }

  protected closeDialog(): void {
    this.dialogRef()?.nativeElement.close();
  }

  protected async store(next: SpellChoices | undefined, announce = false): Promise<void> {
    const onSave = this.onSave();
    if (!onSave) return;
    this.pending.set({ spells: next });
    try {
      await onSave(next);
      if (announce) this.toast.success(this.c().saved);
    } catch {
      this.toast.error(this.c().failed);
    } finally {
      this.pending.set(null);
    }
  }

  protected recoverAll(): void {
    const choices = this.choices();
    void this.store(choices ? { ...choices, used: undefined } : undefined);
  }

  protected spend(level: number, index: number, used: number): void {
    const casting = this.casting();
    if (!casting) return;
    // Tapping an available slot spends up to it; tapping a spent one recovers from it on.
    void this.store(withSlotUsed(this.choices(), casting, level, index < used ? index : index + 1));
  }

  protected async saveDraft(): Promise<void> {
    const draft = this.draft();
    const build = this.build();
    if (!draft || !build) return;
    const choices = this.choices();
    this.saving.set(true);
    await this.store(cleanSpells({ ...build, spells: draft.spells ? { ...draft.spells, used: choices?.used } : undefined }, this.character().level), true);
    this.saving.set(false);
    this.draft.set(null);
  }
}
