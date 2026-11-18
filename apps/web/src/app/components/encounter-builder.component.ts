import {
  afterRenderEffect, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, linkedSignal, signal, untracked, viewChild,
} from "@angular/core";
import { creatureTypeKey, creatureTypeLabel, fetchSrdCatalog, formatChallenge, type CatalogMonster, type SourceSummary } from "@grimoire/shared/monster-api";
import {
  encounterBudget,
  sampleCreatures,
  suggestEncounters,
  type Creature,
  type Difficulty,
  type EncounterRole,
  type EncounterSuggestion,
  type PartyRoleProfile,
} from "@grimoire/shared/rules";
import { api, type Campaign, type Character, type EncounterDraft } from "../core/api-client";
import { FeedbackService } from "../core/feedback.service";
import { I18nService } from "../core/i18n.service";
import { track } from "../core/telemetry-client";
import { MonsterSheetComponent } from "./monster-sheet.component";
import { SKELETONS } from "./skeleton.component";

/**
 * `/encounters`: the encounter builder. The party (saved characters or a size and level), the difficulty and the
 * monster pool (Open5e, the person's catalog, or both) give an XP budget; each roll proposes up to four
 * encounters with budget feedback and party-role coverage, and a DM can save one to a campaign's journal.
 */

export interface EncounterBuilderProps {
  /** Optional party levels, one entry per adventurer. Defaults to a configurable party. */
  partyLevels?: number[];
  /** Optional campaign creature catalog. */
  creatures?: Creature[];
  /** Characters the user can see: their own and those in shared campaigns. */
  characters?: Character[];
  /** Campaigns the user belongs to, for one-click party selection. */
  campaigns?: Campaign[];
}

type SavedCharacter = Pick<Character, "id" | "name" | "level" | "campaignId" | "ownerName" | "editable"> & {
  className?: string;
  scores?: Partial<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>>;
};

type PartyRoles = Record<"frontline" | "damage" | "support" | "control" | "scouting", string[]>;
const roleKeys: EncounterRole[] = ["frontline", "damage", "support", "control", "scouting"];

function inferRoles(characters: SavedCharacter[]): PartyRoles {
  const roles: PartyRoles = { frontline: [], damage: [], support: [], control: [], scouting: [] };
  for (const character of characters) {
    const name = character.className?.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() ?? "";
    const score = character.scores ?? {};
    const add = (role: keyof PartyRoles) => roles[role].push(character.name);
    let recognized = false;
    if (/barbarian|barbar[oa]|fighter|guerrer[oa]|paladin|monk|monje/.test(name)) { add("frontline"); recognized = true; }
    if (/rogue|picar[oa]|ranger|explorador[oa]|fighter|guerrer[oa]|barbarian|barbar[oa]|warlock|bruj[oa]/.test(name)) { add("damage"); recognized = true; }
    if (/cleric|clerig[oa]|druid|druida|bard|bard[oa]|paladin/.test(name)) { add("support"); recognized = true; }
    if (/wizard|mago|sorcerer|hechicer[oa]|warlock|bruj[oa]|bard|bard[oa]|druid|druida|monk|monje/.test(name)) { add("control"); recognized = true; }
    if (/rogue|picar[oa]|ranger|explorador[oa]|bard|bard[oa]|monk|monje|druid|druida/.test(name)) { add("scouting"); recognized = true; }
    if (!recognized) {
      // For custom class names, ability scores provide a modest, explicit heuristic.
      if ((score.str ?? 0) >= 14 || (score.con ?? 0) >= 14) add("frontline");
      if ((score.dex ?? 0) >= 14 || (score.str ?? 0) >= 14) add("damage");
      if ((score.wis ?? 0) >= 14 || (score.cha ?? 0) >= 14) add("support");
      if ((score.int ?? 0) >= 14 || (score.wis ?? 0) >= 14) add("control");
      if ((score.dex ?? 0) >= 14 || (score.wis ?? 0) >= 14) add("scouting");
    }
  }
  return roles;
}

/** "Save to campaign": pick a campaign the person runs and a title, and add the proposal to its encounter journal. */
@Component({
  selector: "app-save-to-campaign",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "contents" },
  template: `
    @if (!campaigns().length) {
      <p class="encounter-footnote">{{ t("encounter.save.noCampaign") }}</p>
    } @else {
      <div class="encounter-save">
        <button type="button" class="button button-quiet" [attr.aria-expanded]="open()" (click)="open.set(!open())">✧ {{ t("encounter.save.toggle") }}</button>
        @if (open()) {
          <form (submit)="save($event)" class="manual-party" style="margin-top: 10px">
            <label>{{ t("encounter.save.campaign") }}
              <select #campaignSelect (change)="campaignId.set(campaignSelect.value)">
                @for (campaign of campaigns(); track campaign.id) { <option [value]="campaign.id" [selected]="campaign.id === selectedId()">{{ campaign.name }}</option> }
              </select>
            </label>
            <label>{{ t("encounter.save.title") }}
              <input #titleInput [value]="title()" maxlength="80" required (input)="title.set(titleInput.value)" />
            </label>
            <button type="submit" class="button button-primary" style="grid-column: 1 / -1" [disabled]="saving() || !title().trim()">
              {{ saving() ? t("encounter.save.saving") : t("encounter.save.submit") }}
            </button>
          </form>
        }
      </div>
    }
  `,
})
export class SaveToCampaignComponent {
  private readonly toast = inject(FeedbackService).toast;
  protected readonly t = inject(I18nService).t;

  readonly suggestion = input.required<EncounterSuggestion>();
  readonly partyLevels = input.required<number[]>();
  readonly campaigns = input.required<Campaign[]>();
  readonly creatureName = input.required<(creature: Creature) => string>();

  protected readonly open = signal(false);
  /** Starting values, taken once per proposal (a later change of language or campaign list keeps what was typed or picked). */
  protected readonly campaignId = linkedSignal({ source: this.suggestion, computation: () => untracked(() => this.campaigns()[0]?.id ?? "") });
  protected readonly title = linkedSignal({
    source: this.suggestion,
    computation: (suggestion) => untracked(() => suggestion.lines.slice(0, 3).map(({ creature, quantity }) => `${quantity}× ${this.creatureName()(creature)}`).join(", ").slice(0, 80)),
  });
  protected readonly saving = signal(false);
  protected readonly selectedId = computed(() => {
    const campaigns = this.campaigns();
    const campaignId = this.campaignId();
    return campaigns.some((campaign) => campaign.id === campaignId) ? campaignId : campaigns[0]?.id ?? "";
  });

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const campaign = this.campaigns().find((item) => item.id === this.selectedId());
    const title = this.title();
    if (!campaign || !title.trim()) return;
    const suggestion = this.suggestion();
    const creatureName = this.creatureName();
    const draft: EncounterDraft = {
      title: title.trim().slice(0, 80), notes: "", status: "planned", difficulty: suggestion.difficulty,
      budget: Math.round(suggestion.budget), totalXp: Math.round(suggestion.totalXp), partyLevels: this.partyLevels(),
      lines: suggestion.lines.map(({ creature, quantity }) => ({
        name: creatureName(creature).slice(0, 60), xp: Math.round(creature.xp), count: quantity,
        ...(creature.monsterSlug ? { monsterSlug: creature.monsterSlug } : {}),
        ...(creature.cr !== undefined ? { cr: creature.cr } : {}),
        ...(creature.type ? { type: creature.type } : {}),
        ...(creature.source ? { source: creature.source.slice(0, 60) } : {}),
      })),
    };
    this.saving.set(true);
    try {
      await api(`/api/campaigns/${campaign.id}/encounters`, { method: "POST", body: draft });
      this.toast.success(this.t("encounter.save.done", { campaign: campaign.name }));
      this.open.set(false);
    } catch {
      this.toast.error(this.t("encounter.save.error"));
    } finally {
      this.saving.set(false);
    }
  }
}

/** One proposed encounter: budget use, the creatures (with their stat block on demand) and the party-role reading. */
@Component({
  selector: "app-encounter-option",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MonsterSheetComponent, SaveToCampaignComponent],
  host: { class: "contents" },
  template: `
    <article class="encounter-card" [attr.aria-label]="t('encounter.optionAria', { number: index() + 1 })">
      <div class="encounter-card-top">
        <span class="encounter-index">{{ t("encounter.option", { number: optionNumber() }) }}</span>
        <span [class]="'difficulty-tag ' + suggestion().difficulty">{{ t("encounter.difficulty." + suggestion().difficulty) }}</span>
      </div>
      <div class="xp-total">
        <strong>{{ formatNumber(suggestion().totalXp) }}</strong>
        <span> / {{ formatNumber(suggestion().budget) }} {{ t("encounter.xp") }}</span>
      </div>
      <div
        class="budget-track"
        role="progressbar"
        [attr.aria-label]="t('encounter.budgetUsedAria')"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-valuenow]="cappedPercent()"
      >
        <span [style.width.%]="cappedPercent()"></span>
      </div>
      <p class="encounter-footnote mt-2 text-xs leading-relaxed text-muted">{{ budgetFeedback() }}</p>
      <div class="creature-lines">
        @for (line of suggestion().lines; track line.creature.id) {
          @let creature = line.creature;
          <div class="creature-line">
            <span class="creature-glyph" aria-hidden="true">✦</span>
            <span>{{ creatureName(creature) }}<small>{{ creatureDetail(creature) }}</small>
              @if (creature.monsterSlug) { <button type="button" class="small-action" (click)="toggleMonster(creature.monsterSlug)">{{ locale() === "es" ? "Ver ficha" : "View stat block" }}</button> }
            </span>
            <b>×{{ line.quantity }}</b>
            @if (openMonster() === creature.monsterSlug && creature.monsterSlug) { <div class="w-full basis-full"><app-monster-sheet [monsterSlug]="creature.monsterSlug" /></div> }
          </div>
        }
      </div>
      <div class="encounter-footnote mt-3 text-xs leading-relaxed text-muted" [attr.aria-label]="t('encounter.roles.aria')">
        <strong>{{ t("encounter.roles.title") }}</strong>
        @if (roleNotes(); as notes) {
          <p>{{ notes.coverage }}</p>
          <p>{{ notes.gaps }}</p>
          @if (notes.fit) { <p>{{ notes.fit }}</p> } @else { <p>{{ t("encounter.roles.caveat") }}</p> }
        } @else {
          <p>{{ t("encounter.roles.unknown") }}</p>
        }
      </div>
      <app-save-to-campaign [suggestion]="suggestion()" [partyLevels]="partyLevels()" [campaigns]="campaigns()" [creatureName]="creatureName" />
    </article>
  `,
})
export class EncounterOptionComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  protected readonly locale = this.i18n.locale;

  readonly suggestion = input.required<EncounterSuggestion>();
  readonly index = input.required<number>();
  readonly roles = input.required<PartyRoles>();
  readonly partyLevels = input.required<number[]>();
  readonly campaigns = input.required<Campaign[]>();

  protected readonly openMonster = signal<string | null>(null);
  protected readonly optionNumber = computed(() => String(this.index() + 1).padStart(2, "0"));
  private readonly percent = computed(() => Math.round((this.suggestion().totalXp / this.suggestion().budget) * 100));
  protected readonly cappedPercent = computed(() => Math.min(this.percent(), 100));
  protected readonly budgetFeedback = computed(() => {
    const percent = this.percent();
    const margin = this.suggestion().budget - this.suggestion().totalXp;
    const feedbackKey = percent >= 90
      ? "encounter.budget.feedbackHigh"
      : percent >= 65
        ? "encounter.budget.feedbackModerate"
        : "encounter.budget.feedbackLow";
    return this.t("encounter.budget.feedback", {
      percent,
      remaining: this.formatNumber(margin),
      xp: this.t("encounter.xp"),
      feedback: this.t(feedbackKey),
    });
  });
  /** The party-role paragraphs, or null when no selected character has a recognisable role. */
  protected readonly roleNotes = computed(() => {
    const entries = Object.entries(this.roles());
    if (!entries.some(([, members]) => members.length > 0)) return null;
    const roleFit = this.suggestion().roleFit;
    const none = this.t("encounter.roles.none");
    const roleName = (role: string) => this.t(`encounter.roles.${role}`);
    return {
      coverage: this.t("encounter.roles.coverage", { roles: entries.filter(([, members]) => members.length).map(([role, members]) => `${roleName(role)} (${members.length})`).join(", ") }),
      gaps: this.t("encounter.roles.gaps", { roles: entries.filter(([, members]) => !members.length).map(([role]) => roleName(role)).join(", ") || none }),
      fit: roleFit ? this.t("encounter.roles.monsterFit", { roles: roleFit.monsterRoles.map(roleName).join(", "), gaps: roleFit.focusedRoles.map(roleName).join(", ") || none, score: roleFit.score }) : "",
    };
  });

  protected readonly creatureName = (creature: Creature): string => creature.id.startsWith("sample-")
    ? this.t(`creature.sample.${creature.xp}.name`)
    : creature.name;

  protected formatNumber(value: number): string {
    return value.toLocaleString(this.locale() === "es" ? "es-ES" : "en-US");
  }

  protected creatureDetail(creature: Creature): string {
    return `${creature.cr !== undefined ? `${this.t("encounter.cr")} ${formatChallenge(creature.cr)} · ` : ""}${creature.type ? `${creatureTypeLabel(creatureTypeKey(creature.type), this.locale())} · ` : ""}${this.formatNumber(creature.xp)} ${this.t("encounter.xp")} · ${creature.id.startsWith("sample-") ? this.t("creature.sample.source") : creature.source}`;
  }

  protected toggleMonster(slug: string): void {
    this.openMonster.update((current) => current === slug ? null : slug);
  }
}

/** Encounter suggestions for a party, with visible budget feedback and one-click rerolls. */
@Component({
  selector: "app-encounter-builder",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SKELETONS, EncounterOptionComponent],
  host: { class: "contents" },
  templateUrl: "./encounter-builder.component.html",
})
export class EncounterBuilderComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  /** Optional party levels, one entry per adventurer. Defaults to a configurable party. */
  readonly partyLevels = input<EncounterBuilderProps["partyLevels"]>();
  /** Optional campaign creature catalog. */
  readonly creatures = input<EncounterBuilderProps["creatures"]>();
  /** Characters the user can see: their own and those in shared campaigns. */
  readonly characters = input<EncounterBuilderProps["characters"]>();
  /** Campaigns the user belongs to, for one-click party selection. */
  readonly campaigns = input<EncounterBuilderProps["campaigns"]>();

  protected readonly creatureList = computed(() => this.creatures() ?? sampleCreatures);
  protected readonly savedCharacters = computed<SavedCharacter[]>(() => this.characters() ?? []);
  protected readonly campaignList = computed(() => this.campaigns() ?? []);
  protected readonly fixedParty = computed(() => !!this.partyLevels()?.length);

  protected readonly selectedCharacterIds = signal<string[]>([]);
  protected readonly partySizeText = signal("4");
  protected readonly partyLevelText = signal("3");
  private readonly partySize = computed(() => Math.max(1, Math.min(12, Number(this.partySizeText()) || 1)));
  private readonly partyLevel = computed(() => Math.max(1, Math.min(20, Number(this.partyLevelText()) || 1)));
  protected readonly difficulty = signal<Difficulty>("moderate");
  protected readonly suggestions = signal<EncounterSuggestion[]>([]);
  protected readonly roll = signal(0);
  protected readonly source = signal<"srd" | "custom" | "both">("srd");
  protected readonly srd = signal<{ sources: SourceSummary[]; monsters: CatalogMonster[] } | null>(null);
  protected readonly srdError = signal("");
  private readonly srdAttempt = signal(0);
  protected readonly types = signal<string[]>([]);
  protected readonly books = signal<string[]>([]);
  protected readonly maxKinds = signal(2);
  protected readonly usesSrd = computed(() => this.source() !== "custom");

  protected readonly difficulties = ["low", "moderate", "high"] as const;
  protected readonly sources = ["srd", "both", "custom"] as const;
  protected readonly kindOptions = [1, 2, 3] as const;
  protected readonly skeletonChips = [64, 88, 72, 96, 80] as const;

  protected readonly typeCounts = computed(() => {
    const books = this.books();
    const locale = this.i18n.locale();
    const counts = new Map<string, number>();
    for (const monster of this.srd()?.monsters ?? []) {
      if (books.length && !books.includes(monster.sourceKey)) continue;
      counts.set(creatureTypeKey(monster.type), (counts.get(creatureTypeKey(monster.type)) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => creatureTypeLabel(a[0], locale).localeCompare(creatureTypeLabel(b[0], locale)));
  });
  private readonly srdCreatures = computed<Creature[]>(() => {
    const types = this.types();
    const books = this.books();
    return (this.srd()?.monsters ?? [])
      .filter((monster) => (!types.length || types.includes(creatureTypeKey(monster.type))) && (!books.length || books.includes(monster.sourceKey)))
      .map((monster) => ({ id: `srd-${monster.index}`, name: monster.name, xp: monster.xp, source: monster.source, roleTags: monster.roles, monsterSlug: monster.index, cr: monster.cr, type: monster.type }));
  });
  protected readonly pool = computed(() => {
    const source = this.source();
    const creatures = this.creatureList();
    const srdCreatures = this.srdCreatures();
    if (source === "custom") return creatures;
    if (source === "srd") return srdCreatures;
    const ids = new Set(srdCreatures.map((creature) => creature.id));
    return [...srdCreatures, ...creatures.filter((creature) => !ids.has(creature.id))];
  });

  private readonly selectedParty = computed(() => {
    const ids = this.selectedCharacterIds();
    return this.savedCharacters().filter((character) => ids.includes(character.id));
  });
  protected readonly partyLevelList = computed(() => {
    const initialPartyLevels = this.partyLevels();
    if (initialPartyLevels?.length) {
      return initialPartyLevels.map((level) => Math.min(20, Math.max(1, Math.floor(level))));
    }
    const selected = this.selectedParty();
    if (selected.length) return selected.map((character) => character.level);
    return Array.from({ length: this.partySize() }, () => this.partyLevel());
  });
  protected readonly budget = computed(() => encounterBudget(this.partyLevelList(), this.difficulty()));
  protected readonly partyRoles = computed(() => inferRoles(this.selectedParty()));
  private readonly roleProfile = computed<PartyRoleProfile>(() => Object.fromEntries(roleKeys.map((role) => [role, this.partyRoles()[role].length])));
  protected readonly managedCampaigns = computed(() => this.campaignList().filter((campaign) => campaign.canManage));
  /** Proposal cards keyed by roll and position, so every reroll starts each card afresh (stat blocks closed, save form reset). */
  protected readonly options = computed(() => {
    const roll = this.roll();
    return this.suggestions().map((suggestion, index) => ({ key: `${roll}-${index}`, suggestion, index }));
  });
  protected readonly hasSelection = computed(() => this.selectedParty().length > 0);

  private readonly results = viewChild.required<ElementRef<HTMLElement>>("results");

  constructor() {
    effect((onCleanup) => {
      const usesSrd = this.usesSrd();
      const srd = this.srd();
      this.srdAttempt();
      if (!usesSrd || srd) return;
      const controller = new AbortController();
      onCleanup(() => controller.abort());
      untracked(() => {
        this.srdError.set("");
        fetchSrdCatalog(controller.signal).then((data) => this.srd.set(data)).catch((cause: unknown) => {
          if (!controller.signal.aborted) this.srdError.set(cause instanceof Error ? cause.message : "Request failed");
        });
      });
    });

    // Stacked layout (phones, narrow windows): the proposals sit below the long form, so bring them into view.
    afterRenderEffect(() => {
      const roll = this.roll();
      untracked(() => {
        const results = this.results().nativeElement;
        if (!roll || results.getBoundingClientRect().top < window.innerHeight * 0.6) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        results.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      });
    });
  }

  protected formatNumber(value: number): string {
    return value.toLocaleString(this.i18n.locale() === "es" ? "es-ES" : "en-US");
  }

  protected typeLabel(key: string): string {
    return creatureTypeLabel(key, this.i18n.locale());
  }

  protected isSelected(id: string): boolean {
    return this.selectedCharacterIds().includes(id);
  }

  protected toggleCharacter(id: string, checked: boolean): void {
    this.selectedCharacterIds.update((current) => checked ? [...current, id] : current.filter((item) => item !== id));
  }

  /** The "from a campaign" picker always shows its placeholder: picking one selects that campaign's heroes. */
  protected pickCampaign(select: HTMLSelectElement): void {
    const value = select.value;
    select.value = "";
    const ids = this.savedCharacters().filter((character) => character.campaignId === value).map((character) => character.id);
    if (value) this.selectedCharacterIds.set(ids);
  }

  protected normalizePartySize(): void {
    this.partySizeText.set(String(this.partySize()));
  }

  protected normalizePartyLevel(): void {
    this.partyLevelText.set(String(this.partyLevel()));
  }

  protected sourceNote(item: "srd" | "both" | "custom"): string {
    if (item === "custom") {
      const creatures = this.creatureList();
      return this.t(creatures.every((creature) => creature.source === "Ejemplo editable") ? "encounter.monsters.sampleCount" : "encounter.monsters.customCount", { count: creatures.length });
    }
    const srd = this.srd();
    return srd ? this.t("encounter.monsters.srdCount", { count: srd.monsters.length, edition: "Open5e" }) : this.t("encounter.monsters.api");
  }

  protected retrySrd(): void {
    this.srdAttempt.update((attempt) => attempt + 1);
  }

  protected toggleBook(key: string): void {
    this.books.update((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  protected toggleType(key: string): void {
    this.types.update((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  protected generate(): void {
    const partyLevels = this.partyLevelList();
    const difficulty = this.difficulty();
    const source = this.source();
    const results = suggestEncounters(this.pool(), partyLevels, difficulty, Math.random, 4, this.roleProfile(),
      source === "custom" ? { maxCreatures: 20 } : { maxKinds: this.maxKinds(), maxCreatures: 12 });
    this.suggestions.set(results);
    this.roll.update((current) => current + 1);
    track("encounter.generated", { difficulty, source, party: partyLevels.length, results: results.length });
  }
}
