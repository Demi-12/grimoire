import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { attackList } from "@grimoire/shared/character-sheet";
import { characterIdentity, featureList, sheetFor, signed, speciesTraits, startingItems } from "@grimoire/shared/character-view";
import { findClass, say, skillKeys, standardLanguages, type Text } from "@grimoire/shared/dnd2024";
import { MAX_LEVEL } from "@grimoire/shared/levelup";
import { abilities, abilityModifier, proficiencyBonus } from "@grimoire/shared/rules";
import type { SpellChoices } from "@grimoire/shared/spells";
import type { Character } from "../core/api-client";
import { I18nService } from "../core/i18n.service";
import { CharacterSpellsComponent } from "./character-spells.component";

/**
 * The on-screen character sheet: everything the app knows about a character, readable at any width.
 * The printable PDF sheet is separate (it lives in CharacterBuilderComponent's cards).
 */

/* Tailwind class lists for the repeated pieces of the sheet. */
const panel = "panel min-w-0 px-4 pt-3.5 pb-4";
const panelTitle = "m-0 mb-2.5 font-display text-[16px] font-semibold text-accent";
const statBox = "grid justify-items-center rounded-control border border-line bg-paper px-1.5 py-2.5 text-center";
const statLabel = "font-label text-xs font-semibold tracking-[.06em] text-muted";
const statValue = "font-display text-2xl font-bold text-ink";
const lineList = "m-0 grid list-none p-0";
const lineItem = "grid grid-cols-[14px_1fr_auto] items-center gap-2 border-b border-dotted border-line py-1.5 text-[15px] text-ink last:border-b-0";
const prose = "m-0 text-[15px] leading-[1.55] whitespace-pre-wrap [overflow-wrap:anywhere] text-ink";
const chip = "rounded-control border border-control-line px-2.5 py-0.5 font-label text-xs font-semibold tracking-[.05em] text-muted";
/** Proficiency marker: empty, proficient (filled) or expertise (gilt, ringed). */
const dot = (state: "none" | "on" | "expert") => state === "expert"
  ? "size-2.5 rounded-full border border-gilt-text bg-gilt shadow-[0_0_0_2px_var(--surface),0_0_0_3px_var(--gilt-text)]"
  : state === "on" ? "size-2.5 rounded-full border border-accent bg-accent" : "size-2.5 rounded-full border border-control-line";

/** Everything the app knows about a character, readable on screen (the PDF sheet is separate). */
@Component({
  selector: "app-character-sheet-view",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, CharacterSpellsComponent],
  host: { class: "contents" },
  templateUrl: "./character-sheet-view.component.html",
})
export class CharacterSheetViewComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  readonly character = input.required<Character>();
  readonly campaignName = input<string>();
  readonly onBack = input.required<() => void>();
  /** Only passed when the printable sheet exists, which is the case for the viewer's own characters. */
  readonly onExport = input<() => void>();
  /** Only passed when the viewer may change the character. */
  readonly onEdit = input<() => void>();
  readonly onLevelUp = input<() => void>();
  /** Saves the spells picked or the slots spent; only passed when the viewer may change the character. */
  readonly onSpells = input<(spells: SpellChoices | undefined) => Promise<void>>();

  protected readonly sheet = computed(() => sheetFor(this.character()));
  protected readonly build = computed(() => this.character().build);
  protected readonly bonus = computed(() => this.sheet()?.proficiency ?? proficiencyBonus(this.character().level));
  protected readonly cls = computed(() => { const build = this.build(); return build ? findClass(build.classId) : undefined; });
  protected readonly features = computed(() => { const build = this.build(); return build ? featureList(build, this.character().level) : []; });
  protected readonly traits = computed(() => { const build = this.build(); return build ? speciesTraits(build) : []; });
  protected readonly gear = computed(() => { const build = this.build(); return build ? startingItems(build, this.i18n.locale()) : []; });
  protected readonly attacks = computed(() => {
    const build = this.build();
    const sheet = this.sheet();
    const locale = this.i18n.locale();
    return (build && sheet ? attackList(build, sheet) : []).map((attack) => ({
      name: say(attack.name, locale),
      bonus: signed(attack.bonus),
      damage: `${attack.dice}${attack.modifier ? signed(attack.modifier) : ""} ${say(attack.type, locale)}`,
      key: attack.dice,
    }));
  });
  protected readonly languages = computed(() => {
    const build = this.build();
    const locale = this.i18n.locale();
    return build ? [this.t("character.common"), ...build.languages.map((index) => standardLanguages[index]).filter(Boolean).map((language) => say(language, locale))] : [];
  });
  protected readonly subtitle = computed(() => {
    const identity = characterIdentity(this.character(), this.i18n.locale());
    return [identity.species, identity.className, identity.background].filter(Boolean).join(" · ") || this.t("character.adventurer");
  });
  protected readonly initial = computed(() => this.upper(this.character().name.slice(0, 1)));
  protected readonly proficiencies = computed(() => {
    const cls = this.cls();
    const locale = this.i18n.locale();
    return cls ? [say(cls.armor, locale), say(cls.weapons, locale), cls.tools ? say(cls.tools, locale) : ""].filter(Boolean).join(" · ") : "";
  });
  protected readonly canLevelUp = computed(() => Boolean(this.onLevelUp() && this.build() && this.character().level < MAX_LEVEL));
  protected readonly abilityTiles = computed(() => {
    const sheet = this.sheet();
    const character = this.character();
    return abilities.map(({ key }) => {
      const score = sheet?.scores[key] ?? character.scores[key];
      const name = this.t(`ability.${key}`);
      // Full names ("Constitución") overflow the narrow cells, so show the three-letter short form.
      return { key, score, name, short: this.upper(name.slice(0, 3)), modifier: signed(abilityModifier(score)) };
    });
  });

  protected readonly abilities = abilities;
  protected readonly skillKeys = skillKeys;
  protected readonly panel = panel;
  protected readonly panelTitle = panelTitle;
  protected readonly statBox = statBox;
  protected readonly statLabel = statLabel;
  protected readonly statValue = statValue;
  protected readonly lineList = lineList;
  protected readonly lineItem = lineItem;
  protected readonly prose = prose;
  protected readonly chip = chip;
  protected readonly dot = dot;
  protected readonly signed = signed;

  protected say(text: Text | undefined): string {
    return say(text, this.i18n.locale());
  }

  protected upper(text: string): string {
    return text.toLocaleUpperCase(this.i18n.locale() === "es" ? "es-ES" : "en-US");
  }
}
