import { NgTemplateOutlet } from "@angular/common";
import { booleanAttribute, ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, signal, untracked } from "@angular/core";
import { fetchMonster, sourceLabel, type MonsterAction, type MonsterStatBlock } from "@grimoire/shared/monster-api";
import { translateAbility, translateTerms } from "@grimoire/shared/monster-i18n";
import { I18nService } from "../core/i18n.service";
import { SKELETONS } from "./skeleton.component";

type Locale = "en" | "es";

const labels = {
  en: { source: "D&D 5e", loading: "Consulting the bestiary…", empty: "Choose a creature to reveal its stat block.", error: "The bestiary could not be opened.", errorHint: "Open5e may not be answering right now.", retry: "Try again", noImage: "No illustration available", hp: "Hit Points", ac: "Armor Class", cr: "Challenge", abilities: "Ability Scores", traits: "Traits", actions: "Actions", bonusActions: "Bonus Actions", reactions: "Reactions", legendary: "Legendary Actions", defenses: "Defenses", saves: "Saving Throws", senses: "Senses", languages: "Languages", prof: "Proficiency" },
  es: { source: "D&D 5e", loading: "Consultando el bestiario…", empty: "Elige una criatura para revelar su ficha.", error: "No se ha podido abrir el bestiario.", errorHint: "Puede que Open5e no responda ahora mismo.", retry: "Reintentar", noImage: "Sin ilustración disponible", hp: "Puntos de golpe", ac: "Clase de armadura", cr: "Desafío", abilities: "Características", traits: "Rasgos", actions: "Acciones", bonusActions: "Acciones adicionales", reactions: "Reacciones", legendary: "Acciones legendarias", defenses: "Defensas", saves: "Tiradas de salvación", senses: "Sentidos", languages: "Idiomas", prof: "Competencia" },
} satisfies Record<Locale, Record<string, string>>;

const abilityNames = { en: ["STR", "DEX", "CON", "INT", "WIS", "CHA"], es: ["FUE", "DES", "CON", "INT", "SAB", "CAR"] };
const abilityKeys = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;
const modifier = (score: number) => `${score >= 10 ? "+" : ""}${Math.floor((score - 10) / 2)}`;
const textOf = (description?: string | string[]) => Array.isArray(description) ? description.join("\n") : description ?? "";

const homebrewLabel = (locale: Locale, owner: string) => (locale === "es" ? `Homebrew · de ${owner}` : `Homebrew · by ${owner}`);

function formatArmorClass(value: MonsterStatBlock["armor_class"]) {
  if (typeof value === "number") return String(value);
  if (!Array.isArray(value) || !value.length) return "—";
  return value.map((armor) => `${armor.value ?? "?"}${armor.desc ? ` (${armor.desc})` : ""}`).join(" / ");
}

/** One titled list of traits or actions; lists without entries are left out. */
type TraitSection = { title: string; items: Array<{ name?: string; text: string }> };
const traitList = (title: string, items: MonsterAction[] | undefined): TraitSection[] =>
  items?.length ? [{ title, items: items.map((item) => ({ name: item.name, text: textOf(item.desc) })) }] : [];

/**
 * A 5e-style stat block: fetched by slug from our /api/monsters route (Open5e or homebrew), or drawn
 * straight from a given stat block (the homebrew editor's live preview). Also the empty, loading and
 * error states around it, and the attribution each book's license asks for.
 */
@Component({
  selector: "app-monster-sheet",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, SKELETONS],
  styleUrl: "./monster-sheet.component.css",
  host: { class: "contents" },
  templateUrl: "./monster-sheet.component.html",
})
export class MonsterSheetComponent {
  private readonly i18n = inject(I18nService);

  readonly monsterSlug = input<string | null>();
  /** Render this stat block directly (editor preview) instead of fetching one by slug. */
  readonly monster = input<MonsterStatBlock>();
  /** Leave the illustration out, for narrow side panels where the actions matter most. */
  readonly compact = input(false, { transform: booleanAttribute });

  protected readonly t = computed(() => labels[this.i18n.locale()]);
  private readonly fetched = signal<MonsterStatBlock | null>(null);
  /** The stat block on screen: the given one, else the one fetched by slug. */
  protected readonly current = computed(() => this.monster() ?? this.fetched());
  protected readonly error = signal("");
  private readonly attempt = signal(0);
  /** The illustration failed to load; starts over whenever another stat block (or the portrait itself) appears. */
  protected readonly portraitFailed = linkedSignal({ source: () => [this.current(), this.compact()] as const, computation: () => false });

  /** Everything the stat block shows, worked out once per stat block and language. */
  protected readonly sheet = computed(() => {
    const monster = this.current();
    if (!monster) return null;
    const locale = this.i18n.locale();
    const t = this.t();
    const saves = monster.proficiencies?.filter((item) => item.proficiency?.name?.toLowerCase().includes("saving throw"));
    const defenses = [
      ...(monster.damage_vulnerabilities?.length ? [`${locale === "es" ? "Vulnerabilidad" : "Vulnerabilities"}: ${translateTerms("damage", monster.damage_vulnerabilities.join(", "), locale)}`] : []),
      ...(monster.damage_resistances?.length ? [`${locale === "es" ? "Resistencias" : "Resistances"}: ${translateTerms("damage", monster.damage_resistances.join(", "), locale)}`] : []),
      ...(monster.damage_immunities?.length ? [`${locale === "es" ? "Inmunidades al daño" : "Damage Immunities"}: ${translateTerms("damage", monster.damage_immunities.join(", "), locale)}`] : []),
      ...(monster.condition_immunities?.length ? [`${locale === "es" ? "Inmunidades a estados" : "Condition Immunities"}: ${translateTerms("condition", monster.condition_immunities.map((item) => item.name).filter(Boolean).join(", "), locale)}`] : []),
    ];
    const source = monster.source;
    return {
      monster,
      eyebrow: monster.homebrew ? homebrewLabel(locale, monster.homebrew.ownerName) : `${t.source} · ${sourceLabel(monster.source)}`,
      kind: [translateTerms("size", monster.size, locale), translateTerms("type", monster.type, locale), translateTerms("alignment", monster.alignment, locale)].filter(Boolean).join(" · "),
      ac: formatArmorClass(monster.armor_class),
      xp: monster.xp != null ? `${monster.xp.toLocaleString(locale)} XP` : null,
      abilities: abilityKeys.map((key, index) => { const score = monster[key]; return { key, name: abilityNames[locale][index], score, modifier: score != null ? modifier(score) : null }; }),
      speedLabel: locale === "es" ? "Velocidad" : "Speed",
      speed: Object.entries(monster.speed ?? {}).filter(([, value]) => value).map(([kind, value]) => `${translateTerms("speed", kind, locale)} ${translateTerms("speed", String(value), locale)}`).join(", "),
      saves: saves?.length ? saves.map((item) => { const value = item.value ?? 0; return `${translateAbility(item.proficiency?.name?.replace(/^Saving Throw:\s*/i, "") ?? "", locale)} ${value >= 0 ? "+" : ""}${value}`; }).join(", ") : "",
      defenses: defenses.join(" · "),
      senses: monster.senses ? Object.entries(monster.senses).filter(([, value]) => value).map(([key, value]) => `${translateTerms("sense", key, locale).replaceAll("_", " ")} ${translateTerms("sense", String(value), locale)}`).join(", ") : null,
      languages: monster.languages ? translateTerms("language", monster.languages, locale) : "",
      traits: [
        ...traitList(t.traits, monster.special_abilities),
        ...traitList(t.actions, monster.actions),
        ...traitList(t.bonusActions, monster.bonus_actions),
        ...traitList(t.reactions, monster.reactions),
        ...traitList(t.legendary, monster.legendary_actions),
      ],
      homebrewNote: locale === "es"
        ? "Contenido homebrew creado por los usuarios de este servidor; no forma parte del SRD ni está avalado por Wizards of the Coast."
        : "Homebrew content made by users of this server; it is not part of the SRD and is not endorsed by Wizards of the Coast.",
      sourceLine: `${t.source} · ${sourceLabel(monster.source)} · ${monster.index ?? this.monsterSlug() ?? ""}`,
      // Attribution the book's license asks for, under each stat block.
      notice: source?.key === "srd-2014" ? "srd51" as const : !source || source.key === "srd-2024" ? "srd52" as const : "book" as const,
      book: source ? { name: source.name, url: source.url, publisher: source.publisher ? ` (${source.publisher})` : "", ccBy: Boolean(source.licenses?.includes("cc-by-40")) } : null,
    };
  });

  constructor() {
    effect((onCleanup) => {
      const given = this.monster();
      const monsterSlug = this.monsterSlug();
      this.attempt();
      const errorText = this.t().error;
      untracked(() => {
        if (given || !monsterSlug) { this.fetched.set(null); this.error.set(""); return; }
        const controller = new AbortController();
        this.fetched.set(null);
        this.error.set("");
        fetchMonster(monsterSlug, controller.signal).then((monster) => this.fetched.set(monster)).catch((cause: unknown) => {
          if (!controller.signal.aborted) this.error.set(cause instanceof Error ? cause.message : errorText);
        });
        onCleanup(() => controller.abort());
      });
    });
  }

  protected retry(): void {
    this.attempt.update((n) => n + 1);
  }
}
