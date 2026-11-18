import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal, type OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import type { MapToken } from "@grimoire/shared/battle-map";
import { attackList } from "@grimoire/shared/character-sheet";
import { characterIdentity, featureList, sheetFor, signed, speciesTraits } from "@grimoire/shared/character-view";
import { say, type Feature } from "@grimoire/shared/dnd2024";
import { abilities, abilityModifier } from "@grimoire/shared/rules";
import type { Character } from "../core/api-client";
import { I18nService } from "../core/i18n.service";
import { baseName, creatureSearch } from "./battle-map-bestiary";
import { formatDistance } from "./battle-map-combat.component";
import { bm } from "./battle-map-styles";
import { MonsterSheetComponent } from "./monster-sheet.component";
import { SpinnerComponent } from "./skeleton.component";

/**
 * The sheet of the token picked on the battle map, next to the board: a hero's character (what the DM looks up
 * mid-fight) or a monster's stat block, and for the DM a bestiary search to link a monster typed in by hand.
 */

const text = {
  en: {
    sheet: "Sheet", close: "Close the sheet", fullSheet: "Open the full sheet", loading: "Opening the sheet…",
    noCharacter: "This character's sheet couldn't be loaded.",
    noStatBlock: "This monster isn't linked to a bestiary creature, so there's no stat block to show.",
    link: "Link it to a bestiary creature", search: "Search the bestiary", searching: "Searching…", noResults: "No creature by that name.",
    pick: (name: string) => `Use ${name}`, unlink: "Use another creature",
    linkHint: "Every unlinked copy with the same name gets it too, with its size and, in a fight, its speed.",
    saves: "Saves", features: "Class features", traits: "Species traits", notes: "Notes", owner: (name: string) => `Player: ${name}`,
  },
  es: {
    sheet: "Ficha", close: "Cerrar la ficha", fullSheet: "Abrir la ficha completa", loading: "Abriendo la ficha…",
    noCharacter: "No se pudo cargar la ficha de este personaje.",
    noStatBlock: "Este monstruo no está enlazado a una criatura del bestiario, así que no hay ficha que mostrar.",
    link: "Enlazarlo a una criatura del bestiario", search: "Buscar en el bestiario", searching: "Buscando…", noResults: "Ninguna criatura con ese nombre.",
    pick: (name: string) => `Usar ${name}`, unlink: "Usar otra criatura",
    linkHint: "Se enlazan también las copias sin enlazar con el mismo nombre, con su tamaño y, en combate, su velocidad.",
    saves: "Salvaciones", features: "Rasgos de clase", traits: "Rasgos de especie", notes: "Notas", owner: (name: string) => `Jugador: ${name}`,
  },
};

/** Search the bestiary (and the DM's homebrew) to give a monster typed in by hand its stat block. */
@Component({
  selector: "app-bestiary-link",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
  host: { class: "contents" },
  template: `
    <div [class]="styles.sheetLink">
      <label [class]="styles.grow">{{ t().link }}<input #search type="search" [class]="styles.field" [value]="query()" [placeholder]="t().search" (input)="query.set(search.value)" /></label>
      @if (busy()) {
        <p [class]="styles.empty"><span appSpinner></span> {{ t().searching }}</p>
      } @else if (results(); as results) {
        @if (results.length) {
          <ul [class]="styles.list">
            @for (entry of results; track entry.slug) {
              <li [class]="styles.listItem()">
                <span [class]="styles.itemName">{{ entry.name }}@if (entry.source) {<small>{{ entry.source }}</small>}</span>
                <button type="button" [class]="styles.smallButton" [attr.aria-label]="t().pick(entry.name)" (click)="onPick()(entry.slug)">✓</button>
              </li>
            }
          </ul>
        } @else {
          <p [class]="styles.empty">{{ t().noResults }}</p>
        }
      }
      <p [class]="styles.empty">{{ t().linkHint }}</p>
    </div>
  `,
})
export class BestiaryLinkComponent implements OnInit {
  private readonly i18n = inject(I18nService);

  readonly token = input.required<MapToken>();
  readonly onPick = input.required<(slug: string) => void>();

  protected readonly styles = bm;
  protected readonly t = computed(() => text[this.i18n.locale()]);
  /** Starts as the token's name (without its copy number) when the search opens; the DM edits it from there. */
  protected readonly query = signal("");
  private readonly search = creatureSearch(() => this.query());
  protected readonly results = this.search.results;
  protected readonly busy = this.search.busy;

  ngOnInit(): void {
    this.query.set(baseName(this.token().label));
  }
}

/** The sheet of the token picked on the map: a hero's character or a monster's stat block, next to the board. */
@Component({
  selector: "app-battle-map-sheet",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MonsterSheetComponent, SpinnerComponent, BestiaryLinkComponent],
  host: { class: "contents" },
  templateUrl: "./battle-map-sheet.component.html",
})
export class BattleMapSheetComponent {
  private readonly i18n = inject(I18nService);

  readonly token = input.required<MapToken>();
  readonly character = input<Character>();
  readonly charactersLoaded = input.required<boolean>();
  readonly isDm = input.required<boolean>();
  /** Give the monster (and its unlinked copies) this stat block. */
  readonly onLink = input.required<(slug: string) => void>();
  readonly onClose = input.required<() => void>();

  protected readonly styles = bm;
  protected readonly t = computed(() => text[this.i18n.locale()]);
  protected readonly tr = this.i18n.t;
  /** The DM asked to pick another creature for a linked monster; forgotten when another token is shown. */
  protected readonly relinking = linkedSignal({ source: () => this.token().id, computation: () => false });

  /** The stat block on screen: the monster's own, unless the DM is choosing another. */
  protected readonly shownSlug = computed(() => this.relinking() ? undefined : this.token().monsterSlug);

  protected readonly pick = (slug: string) => { this.relinking.set(false); this.onLink()(slug); };

  /** What the DM looks up mid-fight: defences, attacks and saves first, the rest folded away. */
  protected readonly hero = computed(() => {
    const character = this.character();
    if (!character) return null;
    const locale = this.i18n.locale();
    const tr = this.tr;
    const sheet = sheetFor(character);
    const build = character.build;
    const attacks = build && sheet ? attackList(build, sheet) : [];
    const identity = characterIdentity(character, locale);
    const subtitle = [identity.species, identity.className, tr("character.levelPill", { level: character.level }).toLocaleLowerCase(locale)].filter(Boolean).join(" · ");
    const vitals: [string, string][] = sheet ? [
      [tr("character.acShort"), String(sheet.armorClass)],
      [tr("character.hpShort"), String(sheet.hitPoints)],
      [tr("character.initShort"), signed(sheet.initiative)],
      [tr("character.speedShort"), formatDistance(Math.round(sheet.speed / 5), locale)],
      [tr("character.passivePerception"), String(sheet.passivePerception)],
      ...(sheet.spellSaveDc ? [[tr("character.spellDc"), String(sheet.spellSaveDc)] as [string, string]] : []),
      ...(sheet.spellAttack !== undefined && sheet.spellSaveDc ? [[tr("character.spellAttack"), signed(sheet.spellAttack)] as [string, string]] : []),
    ] : [];
    return {
      character,
      subtitle,
      vitals: vitals.map(([label, value]) => ({ label, value })),
      scores: abilities.map(({ key }) => {
        const score = sheet?.scores[key] ?? character.scores[key];
        const name = tr(`ability.${key}`);
        return { key, name, short: name.slice(0, 3).toLocaleUpperCase(locale), modifier: signed(abilityModifier(score)), score };
      }),
      attacks: attacks.map((attack) => ({
        name: say(attack.name, locale), bonus: signed(attack.bonus),
        detail: `${attack.dice}${attack.modifier ? signed(attack.modifier) : ""} ${say(attack.type, locale)}`,
      })),
      saves: sheet ? abilities.map(({ key }) => `${tr(`ability.${key}`).slice(0, 3)} ${signed(sheet.saves[key].bonus)}${sheet.saves[key].proficient ? "•" : ""}`).join(" · ") : null,
      // Class features, then species traits; a block with nothing in it isn't shown.
      featureBlocks: build ? [
        { title: this.t().features, items: this.features(featureList(build, character.level)) },
        { title: this.t().traits, items: this.features(speciesTraits(build)) },
      ].filter((block) => block.items.length) : [],
    };
  });

  private features(items: Feature[]): { name: string; tip: string }[] {
    const locale = this.i18n.locale();
    return items.map((item) => ({ name: say(item.name, locale), tip: say(item.tip, locale) }));
  }
}
