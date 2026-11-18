import {
  afterNextRender, ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, DestroyRef, effect, ElementRef, inject, input, linkedSignal,
  signal, untracked, viewChild,
} from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { RouterLink } from "@angular/router";
import { attackList } from "@grimoire/shared/character-sheet";
import { characterIdentity, featureList, sheetFor, signed, speciesTraits, startingItems } from "@grimoire/shared/character-view";
import { alignments, backgrounds, classes, findClass, say, skillKeys, species as speciesList, standardLanguages, type Text } from "@grimoire/shared/dnd2024";
import type { Locale } from "@grimoire/shared/i18n";
import { MAX_LEVEL } from "@grimoire/shared/levelup";
import { abilities, abilityModifier, type AbilityKey, type AbilityScores, proficiencyBonus } from "@grimoire/shared/rules";
import { castingFor, sheetSpells, slotRows, spellFacts, spellLevelName, type SpellChoices } from "@grimoire/shared/spells";
import type { Campaign, Character, CharacterDraft } from "../core/api-client";
import { FeedbackService } from "../core/feedback.service";
import { I18nService } from "../core/i18n.service";
import { track } from "../core/telemetry-client";
import { CharacterSheetViewComponent } from "./character-sheet-view.component";
import { castingNumbers } from "./character-spells.component";
import { CharacterWizardComponent, describeBuild, type WizardResult } from "./character-wizard.component";
import { LevelUpComponent, type LevelUpResult } from "./level-up.component";
import { SpinnerComponent } from "./skeleton.component";

/**
 * The characters section: the list of cards (each carrying its hidden printable sheet), the quick editor
 * for characters without a build (CharacterEditorComponent), and the places where the step-by-step
 * creator, the level-up guide and the on-screen sheet are mounted.
 */

const blankScores: AbilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
const standardArray: AbilityScores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };

/** "+2" / "−1", with a real minus sign. */
const modifierText = (score: number) => { const modifier = abilityModifier(score); return `${modifier >= 0 ? "+" : "−"}${Math.abs(modifier)}`; };
const upper = (text: string, locale: Locale) => text.toLocaleUpperCase(locale === "es" ? "es-ES" : "en-US");

/** Catalog names for a select; keeps a legacy free-text value selectable so older sheets don't lose it. */
function catalogOptions(options: Text[], value: string, locale: Locale): { names: string[]; extra: string } {
  const names = options.map((option) => say(option, locale));
  return { names, extra: value && !names.includes(value) ? value : "" };
}

/** The quick editor: name, class, species, background, level, campaign, ability scores and notes, without a build. */
@Component({
  selector: "app-character-editor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
  host: { class: "contents" },
  template: `
    <form class="editor-panel" (submit)="handleSubmit($event)">
      <div class="panel-heading"><div><p class="eyebrow">{{ t("character.sheetKicker") }}</p><h2>{{ t(character() ? "character.editTitle" : "character.createTitle") }}</h2></div>
        <button class="icon-button" type="button" (click)="onCancel()()" [attr.aria-label]="t('character.closeEditor')">×</button></div>
      <div class="form-grid three-columns">
        <label>{{ t("character.name") }}<input #nameInput required maxlength="50" [value]="name()" (input)="name.set(nameInput.value)" [placeholder]="t('character.namePlaceholder')" /></label>
        <label>{{ t("character.class") }}<select #classSelect (change)="className.set(classSelect.value.slice(0, 40))">
          <option value="" [selected]="className() === ''">{{ t("character.classPlaceholder") }}</option>
          @if (classOptions().extra; as extra) { <option [value]="extra" [selected]="className() === extra">{{ extra }}</option> }
          @for (option of classOptions().names; track option) { <option [value]="option" [selected]="className() === option">{{ option }}</option> }
        </select></label>
        <label>{{ t("character.level") }}<input #levelInput type="number" min="1" max="20" step="1" required [value]="level()" [attr.aria-invalid]="level() !== '' && !validLevel()"
          (input)="level.set(levelInput.value)" />@if (!validLevel()) {<small role="alert">{{ t("character.levelValidation") }}</small>}</label>
        <label>{{ t("character.species") }}<select #speciesSelect (change)="species.set(speciesSelect.value.slice(0, 40))">
          <option value="" [selected]="species() === ''">{{ t("character.speciesPlaceholder") }}</option>
          @if (speciesOptions().extra; as extra) { <option [value]="extra" [selected]="species() === extra">{{ extra }}</option> }
          @for (option of speciesOptions().names; track option) { <option [value]="option" [selected]="species() === option">{{ option }}</option> }
        </select></label>
        <label>{{ t("character.background") }}<select #backgroundSelect (change)="background.set(backgroundSelect.value.slice(0, 50))">
          <option value="" [selected]="background() === ''">{{ t("character.backgroundPlaceholder") }}</option>
          @if (backgroundOptions().extra; as extra) { <option [value]="extra" [selected]="background() === extra">{{ extra }}</option> }
          @for (option of backgroundOptions().names; track option) { <option [value]="option" [selected]="background() === option">{{ option }}</option> }
        </select></label>
        <label>{{ t("character.campaign") }}<select #campaignSelect (change)="campaignId.set(campaignSelect.value)">
          <option value="" [selected]="campaignId() === ''">{{ t("character.noCampaign") }}</option>
          @for (campaign of campaigns(); track campaign.id) { <option [value]="campaign.id" [selected]="campaignId() === campaign.id">{{ campaign.name }}</option> }
        </select></label>
        <div class="form-aside"><span>{{ t("character.proficiencyBonus") }}</span><strong>+{{ validLevel() ? proficiency() : "—" }}</strong><small>{{ t("character.totalLevelHint") }}</small></div>
      </div>
      <div class="score-heading"><div><p class="eyebrow">{{ t("character.abilitiesKicker") }}</p><h3>{{ t("character.scoresTitle") }}</h3></div>
        <button class="text-button" type="button" (click)="scores.set(standardArray)">{{ t("character.standardArray") }}</button></div>
      <p class="field-help mt-2 text-xs leading-relaxed text-muted">{{ t("character.scoresHint") }}</p>
      <div class="ability-grid">
        @for (field of scoreFields(); track field.key) {
          <label class="ability-input">
            <span>{{ field.ability }}</span>
            <input #scoreInput [attr.aria-label]="t('character.scoreAria', { ability: field.ability })" type="number" min="1" max="30" required [value]="field.score"
              (input)="setScore(field.key, scoreInput.value)" />
            <small [attr.aria-label]="field.modifierLabel">{{ field.modifier }}</small>
          </label>
        }
      </div>
      @if (!validScores()) { <p class="validation-message mt-2 text-sm font-medium text-bad" role="alert">{{ t("character.scoresValidation") }}</p> }
      <label class="full-label">{{ t("character.notes") }}<textarea #notesInput rows="3" maxlength="500" [value]="notes()" (input)="notes.set(notesInput.value)" [placeholder]="t('character.notesPlaceholder')"></textarea></label>
      @if (error()) { <p class="validation-message mt-2 text-sm font-medium text-bad" role="alert">{{ error() }}</p> }
      <div class="form-actions"><button class="button button-quiet" type="button" (click)="onCancel()()">{{ t("character.cancel") }}</button>
        <button class="button button-primary" type="submit" [disabled]="saving() || !name().trim() || !validLevel() || !validScores()">@if (saving()) {<span appSpinner></span>}{{ t(saving() ? "common.saving" : "character.save") }}</button></div>
    </form>
  `,
})
export class CharacterEditorComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  readonly character = input<Character>();
  readonly campaigns = input.required<Campaign[]>();
  readonly onSave = input.required<(draft: CharacterDraft) => Promise<void>>();
  readonly onCancel = input.required<() => void>();

  protected readonly name = linkedSignal(() => this.character()?.name ?? "");
  protected readonly className = linkedSignal(() => this.character()?.className ?? "");
  protected readonly species = linkedSignal(() => this.character()?.species ?? "");
  protected readonly background = linkedSignal(() => this.character()?.background ?? "");
  protected readonly level = linkedSignal(() => String(this.character()?.level ?? 1));
  protected readonly scores = linkedSignal<AbilityScores>(() => this.character()?.scores ?? blankScores);
  protected readonly notes = linkedSignal(() => this.character()?.notes ?? "");
  protected readonly campaignId = linkedSignal(() => this.character()?.campaignId ?? "");
  protected readonly saving = signal(false);
  protected readonly error = signal("");

  protected readonly numericLevel = computed(() => Number(this.level()));
  protected readonly validLevel = computed(() => { const level = this.numericLevel(); return Number.isInteger(level) && level >= 1 && level <= 20; });
  protected readonly validScores = computed(() => { const scores = this.scores(); return abilities.every(({ key }) => Number.isInteger(scores[key]) && scores[key] >= 1 && scores[key] <= 30); });
  protected readonly proficiency = computed(() => proficiencyBonus(this.numericLevel()));

  protected readonly classOptions = computed(() => catalogOptions(classes.map((item) => item.name), this.className(), this.i18n.locale()));
  protected readonly speciesOptions = computed(() => catalogOptions(speciesList.map((item) => item.name), this.species(), this.i18n.locale()));
  protected readonly backgroundOptions = computed(() => catalogOptions(backgrounds.map((item) => item.name), this.background(), this.i18n.locale()));
  protected readonly scoreFields = computed(() => {
    const scores = this.scores();
    return abilities.map(({ key }) => {
      const score = scores[key];
      const modifier = abilityModifier(score);
      const ability = this.t(`ability.${key}`);
      return {
        key, score, ability, modifier: modifierText(score),
        modifierLabel: this.t("character.modifierAria", { sign: this.t(modifier >= 0 ? "character.positive" : "character.negative"), value: Math.abs(modifier) }),
      };
    });
  });

  protected readonly standardArray = standardArray;
  private readonly nameInput = viewChild.required<ElementRef<HTMLInputElement>>("nameInput");

  constructor() {
    // The name field takes focus as soon as the editor opens.
    afterNextRender(() => this.nameInput().nativeElement.focus());
  }

  protected setScore(key: AbilityKey, value: string): void {
    this.scores.update((current) => ({ ...current, [key]: Number(value) }));
  }

  protected async handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const name = this.name().trim();
    if (!name || !this.validLevel() || !this.validScores()) return;
    this.saving.set(true);
    this.error.set("");
    try {
      await this.onSave()({
        name, className: this.className().trim(), species: this.species().trim(), background: this.background().trim(), level: this.numericLevel(),
        scores: this.scores(), notes: this.notes().trim(), campaignId: this.campaignId() || null,
      });
    } catch {
      this.error.set(this.t("character.saveError"));
    } finally {
      this.saving.set(false);
    }
  }
}

/** CRUD for the signed-in user's characters, stored in PostgreSQL through the API. */
@Component({
  selector: "app-character-builder",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, CharacterEditorComponent, CharacterSheetViewComponent, CharacterWizardComponent, LevelUpComponent],
  host: { class: "contents" },
  templateUrl: "./character-builder.component.html",
})
export class CharacterBuilderComponent {
  private readonly i18n = inject(I18nService);
  private readonly feedback = inject(FeedbackService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  protected readonly t = this.i18n.t;

  /** Characters the user owns (editable). */
  readonly characters = input.required<Character[]>();
  /** Campaigns the user belongs to, offered when placing a character. */
  readonly campaigns = input.required<Campaign[]>();
  readonly onSave = input.required<(draft: CharacterDraft, id?: string) => Promise<void>>();
  readonly onDelete = input.required<(id: string) => Promise<void>>();
  /** Every character the user can see (their own plus those of their campaigns), for the full-sheet view. */
  readonly allCharacters = input<Character[]>();
  /** Character whose full sheet is open (from the URL), and how to open or close one. */
  readonly selectedId = input<string | null>();
  readonly onSelect = input<(id: string | null) => void>();
  /** Open the step-by-step creator right away (the `/characters/new` link); `onCreatingStarted` then leaves that URL. */
  readonly startCreating = input<boolean>();
  readonly onCreatingStarted = input<() => void>();

  protected readonly editing = signal<Character | undefined>(undefined);
  protected readonly showEditor = signal(false);
  protected readonly wizard = signal<{ record?: Character; quick?: boolean } | null>(null);
  protected readonly levelingUp = signal<Character | null>(null);
  protected readonly printingId = signal<string | null>(null);
  protected readonly error = signal("");

  /** Undoes the print-only state of the last export; set while that state is on. */
  private endPrint: (() => void) | null = null;

  protected readonly viewing = computed(() => {
    const selectedId = this.selectedId();
    return selectedId ? (this.allCharacters() ?? this.characters()).find((record) => record.id === selectedId) : undefined;
  });
  protected readonly own = computed(() => { const viewing = this.viewing(); return viewing ? this.characters().find((record) => record.id === viewing.id) : undefined; });
  // While a sheet is open the list stays in the page (the print sheet lives in its cards) but is hidden on screen.
  protected readonly listClass = computed(() => this.selectedId() ? " screen-hidden" : "");
  protected readonly idle = computed(() => !this.showEditor() && !this.wizard() && !this.levelingUp());
  protected readonly wizardInitial = computed(() => {
    const record = this.wizard()?.record;
    return record?.build ? { name: record.name, level: record.level, notes: record.notes, build: record.build } : undefined;
  });
  /** The level-up guide, as a list of one keyed by character so another character gets a fresh guide. */
  protected readonly levelUpTarget = computed(() => { const record = this.levelingUp(); return record?.build ? [{ record, build: record.build }] : []; });
  /** The quick editor, keyed the same way: a different character (or a new one) gets fresh fields. */
  protected readonly editorKey = computed(() => this.showEditor() ? [this.editing()?.id ?? "new"] : []);

  /** The cards, with their printable sheets worked out once per change. */
  protected readonly cards = computed(() => {
    const locale = this.i18n.locale();
    const t = this.t;
    return this.characters().map((character) => {
      const sheet = sheetFor(character);
      const identity = characterIdentity(character, locale);
      const build = character.build;
      const attacks = build && sheet ? attackList(build, sheet) : [];
      const items = build ? startingItems(build, locale) : [];
      const cls = build ? findClass(build.classId) : undefined;
      const casting = build ? castingFor(build, character.level) : null;
      const numbers = casting ? castingNumbers(casting, (sheet?.scores ?? character.scores)[casting.ability], character.level) : null;
      const spellGroups = build ? sheetSpells(build.spells, locale) : [];
      const named = (list: { name: Text; tip: Text }[]) => list.map((item) => ({ name: say(item.name, locale), tip: say(item.tip, locale) }));
      return {
        character,
        sheet,
        identity,
        initial: upper(character.name.slice(0, 1), locale),
        subtitle: [identity.species, identity.className, identity.background].filter(Boolean).join(" · ") || t("character.adventurer"),
        bannerSubtitle: [identity.className, identity.species].filter(Boolean).join(" · ") || t("character.adventurer"),
        campaignName: this.campaignName(character.campaignId),
        alignment: build ? say(alignments[build.alignment] ?? alignments[4], locale) : "—",
        scores: abilities.map(({ key }) => ({ key, label: t(`ability.${key}`), short: upper(t(`ability.${key}`).slice(0, 3), locale), score: character.scores[key], modifier: modifierText(character.scores[key]) })),
        combat: ([["character.armorClass", sheet?.armorClass], ["character.initiative", sheet ? signed(sheet.initiative) : undefined], ["character.speed", sheet?.speed],
          ["character.hitPoints", sheet?.hitPoints], ["character.hitDice", sheet?.hitDice]] as const).map(([key, value]) => ({ key, value: value ?? "" })),
        attackRows: Array.from({ length: Math.max(4, attacks.length) }, (_, index) => {
          const attack = attacks[index];
          return attack
            ? { name: say(attack.name, locale), bonus: signed(attack.bonus), damage: `${attack.dice}${attack.modifier ? signed(attack.modifier) : ""} ${say(attack.type, locale)}` }
            : { name: "", bonus: "", damage: "" };
        }),
        saves: abilities.map(({ key }) => ({ key, label: t(`ability.${key}`), marker: sheet?.saves[key].proficient ? "filled" : null, bonus: sheet ? signed(sheet.saves[key].bonus) : "" })),
        skills: skillKeys.map((skill) => ({
          skill, label: t(`skill.${skill}`), marker: sheet?.skills[skill].expertise ? "filled expert" : sheet?.skills[skill].proficient ? "filled" : null, bonus: sheet ? signed(sheet.skills[skill].bonus) : "",
        })),
        featuresText: build
          ? featureList(build, character.level).map((feature) => say(feature.name, locale)).join(" · ")
            + (sheet?.spellSaveDc ? ` · ${t("character.spellDc")} ${sheet.spellSaveDc}, ${t("character.spellAttack")} ${signed(sheet.spellAttack ?? 0)}` : "")
          : null,
        traitsText: build
          ? speciesTraits(build).map((trait) => say(trait.name, locale)).join(" · ")
            + (sheet?.darkvision ? ` · ${t("character.darkvision")} ${sheet.darkvision}` : "")
            + (sheet?.speciesSpells ? ` · ${t("character.speciesSpells")}: ${t("character.spellDc")} ${sheet.speciesSpells.saveDc}, ${t("character.spellAttack")} ${signed(sheet.speciesSpells.attack)}` : "")
          : null,
        proficiencies: build && cls ? {
          gear: `${say(cls.armor, locale)} · ${say(cls.weapons, locale)}${cls.tools ? ` · ${say(cls.tools, locale)}` : ""}`,
          languages: [locale === "es" ? "Común" : "Common", ...build.languages.map((index) => standardLanguages[index] ? say(standardLanguages[index], locale) : "")].filter(Boolean).join(", "),
        } : null,
        equipmentRows: Array.from({ length: Math.max(7, items.length) }, (_, index) => items[index] ?? ""),
        spellsText: casting && numbers
          ? `${t(`ability.${casting.ability}`)} · ${t("character.spellDc")} ${numbers.dc} · ${t("character.spellAttack")} ${signed(numbers.attack)} · `
            + slotRows(casting, undefined).map((row) => `${spellLevelName(row.level, locale)}: ${"○".repeat(row.total)}`).join("  ")
          : null,
        featureDetail: build ? named(featureList(build, character.level)) : [],
        traitDetail: build ? named(speciesTraits(build)) : [],
        spellDetail: spellGroups.flatMap((group) => group.spells.map((entry) => ({
          name: say(entry.name, locale),
          tip: [spellLevelName(entry.level, locale), entry.spell ? spellFacts(entry.spell, locale) : ""].filter(Boolean).join(" · "),
        }))),
        canLevelUp: Boolean(build) && character.level < MAX_LEVEL,
      };
    });
  });

  protected readonly gold = computed(() => this.i18n.locale() === "es" ? "po" : "GP");
  protected readonly spellLines = [0, 1, 2, 3];
  protected readonly proficiencyBonus = proficiencyBonus;
  protected readonly signed = signed;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.endPrint?.());

    effect(() => {
      if (!this.startCreating()) return;
      untracked(() => {
        this.showEditor.set(false); this.levelingUp.set(null);
        this.startWizard(false);
        this.onCreatingStarted()?.();
      });
    });
  }

  protected campaignName(id: string | null): string | undefined {
    return id ? this.campaigns().find((campaign) => campaign.id === id)?.name : undefined;
  }

  /** Open the creator for a new character (counted to measure how many finish it). */
  protected startWizard(quick: boolean): void {
    this.wizard.set(quick ? { quick: true } : {});
    track("character.wizard_started", { quick });
  }

  protected readonly save = async (draft: CharacterDraft): Promise<void> => {
    await this.onSave()(draft, this.editing()?.id);
    this.showEditor.set(false);
    this.editing.set(undefined);
    this.feedback.toast.success(this.t("character.saved", { name: draft.name }));
  };

  protected readonly closeEditor = (): void => {
    this.showEditor.set(false);
    this.editing.set(undefined);
  };

  protected readonly closeWizard = (): void => this.wizard.set(null);

  protected readonly wizardSave = (result: WizardResult): void => { void this.saveFromWizard(result); };

  private async saveFromWizard(result: WizardResult): Promise<void> {
    const described = describeBuild(result.build, this.i18n.locale(), result.level);
    const record = this.wizard()?.record;
    this.error.set("");
    try {
      await this.onSave()({
        name: result.name, level: result.level, notes: result.notes, build: result.build, campaignId: record?.campaignId ?? null,
        className: described.className, species: described.species, background: described.background, scores: described.scores,
      }, record?.id);
      this.wizard.set(null);
      this.feedback.toast.success(this.t("character.saved", { name: result.name }));
    } catch {
      this.error.set(this.t("character.saveError"));
    }
  }

  protected readonly closeLevelUp = (): void => this.levelingUp.set(null);

  protected readonly levelUpSave = (result: LevelUpResult): void => {
    const record = this.levelingUp();
    if (record) void this.saveLevelUp(record, result);
  };

  private async saveLevelUp(record: Character, result: LevelUpResult): Promise<void> {
    const described = describeBuild(result.build, this.i18n.locale(), result.level);
    this.error.set("");
    try {
      await this.onSave()({
        name: record.name, level: result.level, notes: record.notes, build: result.build, campaignId: record.campaignId,
        className: described.className, species: described.species, background: described.background, scores: described.scores,
      }, record.id);
      this.levelingUp.set(null);
      this.feedback.toast.success(this.t("character.leveledUp", { name: record.name, level: result.level }));
      track("character.level_up", { level: result.level });
    } catch {
      this.error.set(this.t("character.saveError"));
    }
  }

  /** Spells and spent slots are changed from the open sheet, without going through the creator. */
  private async saveSpells(record: Character, spells: SpellChoices | undefined): Promise<void> {
    if (!record.build) return;
    await this.onSave()({
      name: record.name, level: record.level, notes: record.notes, campaignId: record.campaignId, className: record.className, species: record.species,
      background: record.background, scores: record.scores, build: { ...record.build, spells },
    }, record.id);
  }

  protected startLevelUp(record: Character): void {
    this.showEditor.set(false); this.wizard.set(null); this.levelingUp.set(record);
  }

  protected startEdit(record: Character): void {
    this.levelingUp.set(null);
    if (record.build) { this.showEditor.set(false); this.wizard.set({ record }); return; }
    this.wizard.set(null); this.editing.set(record); this.showEditor.set(true);
  }

  protected async remove(record: Character): Promise<void> {
    const confirmed = await this.feedback.confirm({
      title: this.t("character.deleteConfirm", { name: record.name }),
      message: this.t("character.deleteWarning"),
      confirmLabel: this.t("character.delete"),
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      await this.onDelete()(record.id);
      this.feedback.toast.success(this.t("character.deleted", { name: record.name }));
    } catch {
      this.feedback.toast.error(this.t("character.deleteError"));
    }
  }

  protected exportSheet(record: Character): void {
    this.endPrint?.();
    // The sheet is marked before print() and print() runs inside the tap itself: phones ignore a print()
    // that comes after the gesture, so it cannot wait for the next change detection on its own.
    this.printingId.set(record.id);
    this.changeDetector.detectChanges();
    document.body.dataset["printingSheet"] = "true";
    const end = () => {
      document.removeEventListener("pointerdown", end, true);
      document.removeEventListener("keydown", end, true);
      delete document.body.dataset["printingSheet"];
      this.printingId.set(null);
      this.endPrint = null;
    };
    this.endPrint = end;
    // On phones print() returns at once and `afterprint` fires before the preview is drawn, so undoing it there
    // printed the whole app instead of the sheet. The page goes back to normal on the next touch or key instead.
    document.addEventListener("pointerdown", end, true);
    document.addEventListener("keydown", end, true);
    window.print();
  }

  /* Callbacks for the open sheet; the template only passes the ones the viewer may use. */
  protected readonly select = (id: string | null): void => this.onSelect()?.(id);
  protected readonly back = (): void => this.onSelect()?.(null);
  protected readonly exportOwn = (): void => { const own = this.own(); if (own) this.exportSheet(own); };
  protected readonly editOwn = (): void => { const own = this.own(); if (!own) return; this.onSelect()?.(null); this.startEdit(own); };
  protected readonly levelUpOwn = (): void => { const own = this.own(); if (!own) return; this.onSelect()?.(null); this.startLevelUp(own); };
  protected readonly spellsOwn = async (spells: SpellChoices | undefined): Promise<void> => { const own = this.own(); if (own) await this.saveSpells(own, spells); };
}
