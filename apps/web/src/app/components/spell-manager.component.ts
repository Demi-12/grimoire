import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from "@angular/core";
import type { CharacterBuild } from "@grimoire/shared/character-sheet";
import { say } from "@grimoire/shared/dnd2024";
import {
  castingFor, castingTimeName, classSpells, emptySpells, findSpell, MAX_CUSTOM_SPELLS, MAX_SPELL_LEVEL, MAX_SPELL_NAME, spellCounts, spellFacts,
  spellLevelName, spellMeasure, spells as catalogue, type Spell, type SpellChoices,
} from "@grimoire/shared/spells";
import { I18nService } from "../core/i18n.service";

/**
 * The spell picker shared by the creator, the level-up guide and the sheet (SpellManagerComponent), and the
 * rules text of one spell (SpellDetailsComponent). Neither saves anything: the picker is controlled through
 * `value` + `onChange`, and the parent decides what to do with the choices.
 */

const copy = {
  en: {
    ability: "Spellcasting ability", cantrips: "Cantrips", prepared: "Prepared spells", of: "of", tabs: { class: "From your class", book: "Spellbook", extra: "Other spells" },
    classHelp: "Pick the cantrips you know and the spells you have prepared. You can change them later from the sheet.",
    bookHelp: (count: number) => `Spells written in your spellbook that you haven't prepared today. A wizard's book holds ${count} spells at this level (prepared ones included), plus any you copy during your adventures.`,
    extraHelp: "Spells that don't come from your class list: feats such as Magic Initiate, your species or lineage, your subclass's always-prepared spells or magic items. They don't count against your class limits.",
    noCasting: "Your class doesn't cast spells. If a feat, your species or a magic item gives you one, add it here.",
    search: "Search spells", level: "Spell level", all: "All levels", empty: "No spells match.", full: "You've already chosen them all: untick one to swap it.",
    over: "You have more than your class allows: untick some.", details: (name: string) => `Details of ${name}`, loading: "Loading description…",
    failed: "The description couldn't be loaded. It's in your rulebook under the English name.", higher: "At higher levels", material: "Material", trigger: "Trigger",
    concentration: "Concentration", ritual: "Ritual", english: "Description in English, from the SRD 5.2.",
    customTitle: "A spell that isn't in the list?", customHelp: "The list holds the spells of the free rules (SRD 5.2). Write the name of any other one; it counts as a class spell.",
    customHelpOther: "The list holds the spells of the free rules (SRD 5.2). Write the name of any other one.",
    customName: "Spell name", add: "Add", remove: (name: string) => `Remove ${name}`, chosen: "Chosen",
  },
  es: {
    ability: "Característica para lanzar conjuros", cantrips: "Trucos", prepared: "Conjuros preparados", of: "de", tabs: { class: "De tu clase", book: "Libro de conjuros", extra: "Otros conjuros" },
    classHelp: "Elige los trucos que conoces y los conjuros que tienes preparados. Podrás cambiarlos después desde la hoja.",
    bookHelp: (count: number) => `Conjuros apuntados en tu libro que hoy no tienes preparados. A este nivel el libro de un mago tiene ${count} conjuros (contando los preparados), más los que copies en tus aventuras.`,
    extraHelp: "Conjuros que no salen de la lista de tu clase: dotes como Iniciado en la magia, tu especie o linaje, los conjuros siempre preparados de tu subclase u objetos mágicos. No cuentan para los límites de tu clase.",
    noCasting: "Tu clase no lanza conjuros. Si una dote, tu especie o un objeto mágico te da alguno, añádelo aquí.",
    search: "Buscar conjuros", level: "Nivel de conjuro", all: "Todos los niveles", empty: "Ningún conjuro coincide.", full: "Ya los has elegido todos: desmarca uno para cambiarlo.",
    over: "Tienes más de los que permite tu clase: desmarca alguno.", details: (name: string) => `Detalles de ${name}`, loading: "Cargando la descripción…",
    failed: "No se ha podido cargar la descripción. La tienes en tu manual.", higher: "A niveles superiores", material: "Material", trigger: "Desencadenante",
    concentration: "Concentración", ritual: "Ritual", english: "Descripción en inglés, del SRD 5.2.",
    customTitle: "¿Un conjuro que no está en la lista?", customHelp: "La lista trae los conjuros de las reglas gratuitas (SRD 5.2). Escribe el nombre de cualquier otro; cuenta como conjuro de tu clase.",
    customHelpOther: "La lista trae los conjuros de las reglas gratuitas (SRD 5.2). Escribe el nombre de cualquier otro.",
    customName: "Nombre del conjuro", add: "Añadir", remove: (name: string) => `Quitar ${name}`, chosen: "Elegidos",
  },
};

type Detail = { description: string; higherLevel: string; material: string; reaction: string };
const details = new Map<string, Promise<Detail>>();
function loadDetail(id: string): Promise<Detail> {
  let pending = details.get(id);
  if (!pending) {
    pending = fetch(`/api/spells/${id}`).then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json() as Promise<Detail>;
    });
    pending.catch(() => details.delete(id));
    details.set(id, pending);
  }
  return pending;
}

/** The numbers and the rules text of one spell; the text is fetched the first time it is shown. */
@Component({
  selector: "app-spell-details",
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: "./spell-manager.component.css",
  host: { class: "contents" },
  template: `
    <div class="details">
      <p class="facts">{{ facts() }}</p>
      @let shown = current();
      @if (!shown.detail && !shown.failed) { <p class="muted" role="status">{{ c().loading }}</p> }
      @if (shown.failed) { <p class="muted" role="status">{{ c().failed }}</p> }
      @if (shown.detail; as detail) {
        @if (detail.reaction) { <p><b>{{ c().trigger }}:</b> {{ detail.reaction }}</p> }
        @if (detail.material) { <p><b>{{ c().material }}:</b> {{ detail.material }}</p> }
        @for (paragraph of paragraphs(); track $index) { <p lang="en">{{ paragraph }}</p> }
        @if (detail.higherLevel) { <p lang="en"><b [attr.lang]="locale()">{{ c().higher }}:</b> {{ detail.higherLevel }}</p> }
        @if (locale() === "es") { <p class="muted">{{ c().english }}</p> }
      }
    </div>
  `,
})
export class SpellDetailsComponent {
  protected readonly locale = inject(I18nService).locale;
  protected readonly c = computed(() => copy[this.locale()]);

  readonly spell = input.required<Spell>();

  private readonly spellId = computed(() => this.spell().id);
  private readonly state = signal<{ id: string; detail?: Detail; failed?: boolean }>({ id: "" });
  /** A result that arrived for a previous spell doesn't count for this one. */
  protected readonly current = computed<{ id: string; detail?: Detail; failed?: boolean }>(() => {
    const state = this.state();
    const id = this.spellId();
    return state.id === id ? state : { id };
  });
  protected readonly facts = computed(() => spellFacts(this.spell(), this.locale()));
  protected readonly paragraphs = computed(() => this.current().detail?.description.split(/\n+/).filter(Boolean) ?? []);

  constructor() {
    effect((onCleanup) => {
      const id = this.spellId();
      let live = true;
      untracked(() => {
        loadDetail(id).then((detail) => { if (live) this.state.set({ id, detail }); }, () => { if (live) this.state.set({ id, failed: true }); });
      });
      onCleanup(() => { live = false; });
    });
  }
}

type Bucket = "class" | "book" | "extra";

/**
 * Picks the character's spells: class cantrips and prepared spells (with the class limits), the rest of a wizard's spellbook,
 * and spells from anywhere else. Used by the creator, the level-up guide and the sheet.
 */
@Component({
  selector: "app-spell-manager",
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: "./spell-manager.component.css",
  imports: [SpellDetailsComponent],
  host: { class: "contents" },
  templateUrl: "./spell-manager.component.html",
})
export class SpellManagerComponent {
  protected readonly locale = inject(I18nService).locale;
  protected readonly t = inject(I18nService).t;
  protected readonly c = computed(() => copy[this.locale()]);

  readonly build = input.required<Pick<CharacterBuild, "classId" | "useSubclass" | "subclassId">>();
  readonly level = input.required<number>();
  readonly value = input.required<SpellChoices | undefined>();
  readonly onChange = input.required<(next: SpellChoices) => void>();

  private readonly bucket = signal<Bucket>("class");
  protected readonly query = signal("");
  protected readonly filter = signal("all");
  protected readonly open = signal<string | null>(null);
  protected readonly customName = signal("");
  protected readonly customLevel = signal(1);

  protected readonly maxSpellName = MAX_SPELL_NAME;
  protected readonly customLevels = Array.from({ length: MAX_SPELL_LEVEL + 1 }, (_, spellLevel) => spellLevel);

  protected readonly casting = computed(() => castingFor(this.build(), this.level()));
  private readonly choices = computed(() => this.value() ?? emptySpells);
  protected readonly active = computed<Bucket>(() => {
    const casting = this.casting();
    const bucket = this.bucket();
    return casting ? (bucket === "book" && !casting.spellbook ? "class" : bucket) : "extra";
  });

  private readonly counts = computed(() => spellCounts(this.choices()));
  private readonly known = computed(() => this.choices().known);
  private readonly book = computed(() => this.choices().book ?? []);
  private readonly extra = computed(() => this.choices().extra ?? []);
  protected readonly custom = computed(() => this.choices().custom ?? []);
  /** Typed-in spells belong to the tab they were added in: class ones count against the limits, the others don't. */
  protected readonly customHere = computed(() => {
    const extraTab = this.active() === "extra";
    const locale = this.locale();
    return this.custom().map((entry, index) => ({ entry, index, key: `${entry.name}-${index}`, levelName: spellLevelName(entry.level, locale) }))
      .filter(({ entry }) => !!entry.other === extraTab);
  });
  private readonly selected = computed(() => {
    const active = this.active();
    return active === "class" ? this.known() : active === "book" ? this.book() : this.extra();
  });

  private readonly pool = computed(() => {
    const casting = this.casting();
    const active = this.active();
    const available = casting ? classSpells(casting) : [];
    if (active === "class") return available;
    if (active === "book") return available.filter((spell) => spell.level > 0);
    return catalogue;
  });
  private readonly visible = computed(() => {
    const locale = this.locale();
    const active = this.active();
    const known = this.known();
    const book = this.book();
    const filter = this.filter();
    const needle = this.query().trim().toLocaleLowerCase(locale);
    return this.pool().filter((spell) => {
      // A spell lives in one place only: prepared ones leave the book and the "other" list.
      if (active === "book" && known.includes(spell.id)) return false;
      if (active === "extra" && (known.includes(spell.id) || book.includes(spell.id))) return false;
      if (filter !== "all" && spell.level !== Number(filter)) return false;
      return !needle || spell.name.en.toLocaleLowerCase(locale).includes(needle) || spell.name.es.toLocaleLowerCase(locale).includes(needle);
    }).sort((a, b) => a.level - b.level || say(a.name, locale).localeCompare(say(b.name, locale), locale));
  });
  protected readonly levels = computed(() => {
    const locale = this.locale();
    return [...new Set(this.pool().map((spell) => spell.level))].sort((a, b) => a - b).map((level) => ({ level, name: spellLevelName(level, locale) }));
  });
  protected readonly visibleCount = computed(() => this.visible().length);

  /** Class picks stop at the class limits; the other two lists are free. */
  private blocked(spell: Pick<Spell, "level">): boolean {
    const casting = this.casting();
    const counts = this.counts();
    return this.active() === "class" && !!casting && (spell.level === 0 ? counts.cantrips >= casting.cantrips : counts.prepared >= casting.prepared);
  }
  protected readonly customFull = computed(() => this.blocked({ level: this.customLevel() }));

  /** The list, by spell level, with what each row shows. */
  protected readonly groups = computed(() => {
    const locale = this.locale();
    const c = this.c();
    const visible = this.visible();
    const selected = this.selected();
    return [...new Set(visible.map((spell) => spell.level))].map((spellLevel) => ({
      level: spellLevel,
      name: spellLevelName(spellLevel, locale),
      rows: visible.filter((spell) => spell.level === spellLevel).map((spell) => {
        const isOn = selected.includes(spell.id);
        return {
          spell,
          isOn,
          name: say(spell.name, locale),
          blocked: !isOn && this.blocked(spell),
          meta: `${castingTimeName(spell, locale)} · ${spellMeasure(spell.range, locale)}${spell.concentration ? ` · ${c.concentration}` : ""}${spell.ritual ? ` · ${c.ritual}` : ""}`,
        };
      }),
    }));
  });

  protected readonly counters = computed(() => {
    const casting = this.casting();
    if (!casting) return [];
    const c = this.c();
    const counts = this.counts();
    return ([[c.cantrips, counts.cantrips, casting.cantrips], [c.prepared, counts.prepared, casting.prepared]] as const)
      .filter(([, have, limit]) => limit > 0 || have > 0)
      .map(([label, have, limit]) => ({ label, have, limit, state: have > limit ? "bad" : have === limit ? "complete" : "" }));
  });
  protected readonly over = computed(() => {
    const casting = this.casting();
    const counts = this.counts();
    return !!casting && (counts.cantrips > casting.cantrips || counts.prepared > casting.prepared);
  });
  protected readonly tabs = computed(() => {
    const casting = this.casting();
    const c = this.c();
    const tabs: Bucket[] = casting ? ["class", ...(casting.spellbook ? ["book" as const] : []), "extra"] : ["extra"];
    return tabs.map((tab) => {
      const count = tab === "class" ? 0 : (tab === "book" ? this.book() : this.extra()).length;
      return { tab, label: `${c.tabs[tab]}${count > 0 ? ` (${count})` : ""}` };
    });
  });
  protected readonly help = computed(() => {
    const active = this.active();
    const c = this.c();
    return active === "class" ? c.classHelp : active === "book" ? c.bookHelp(6 + (this.level() - 1) * 2) : this.casting() ? c.extraHelp : "";
  });
  protected readonly chosenNames = computed(() => {
    const locale = this.locale();
    return this.selected().map((id) => findSpell(id)).filter((spell): spell is Spell => !!spell)
      .sort((a, b) => a.level - b.level).map((spell) => say(spell.name, locale)).join(" · ");
  });
  protected readonly addDisabled = computed(() => !this.customName().trim() || this.custom().length >= MAX_CUSTOM_SPELLS || this.customFull());

  protected levelName(level: number): string {
    return spellLevelName(level, this.locale());
  }

  protected pickTab(tab: Bucket): void {
    this.bucket.set(tab);
    this.filter.set("all");
    this.open.set(null);
  }

  protected toggle(spell: Spell, on: boolean): void {
    const choices = this.choices();
    const known = this.known();
    const book = this.book();
    const extra = this.extra();
    const without = (ids: string[]) => ids.filter((id) => id !== spell.id);
    const active = this.active();
    if (active === "class") this.onChange()({ ...choices, known: on ? [...known, spell.id] : without(known), book: without(book), extra: without(extra) });
    else if (active === "book") this.onChange()({ ...choices, book: on ? [...book, spell.id] : without(book), extra: without(extra) });
    else this.onChange()({ ...choices, extra: on ? [...extra, spell.id] : without(extra) });
  }

  protected toggleOpen(id: string): void {
    this.open.set(this.open() === id ? null : id);
  }

  protected addCustom(): void {
    const name = this.customName().trim().slice(0, MAX_SPELL_NAME);
    const custom = this.custom();
    if (!name || custom.length >= MAX_CUSTOM_SPELLS || this.customFull()) return;
    this.onChange()({ ...this.choices(), custom: [...custom, { name, level: this.customLevel(), ...(this.active() === "extra" ? { other: true } : {}) }] });
    this.customName.set("");
  }

  protected customKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") { event.preventDefault(); this.addCustom(); }
  }

  protected removeCustom(index: number): void {
    this.onChange()({ ...this.choices(), custom: this.custom().filter((_, position) => position !== index) });
  }
}
