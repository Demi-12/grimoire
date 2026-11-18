import {
  afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, signal, viewChild, type OnInit,
} from "@angular/core";
import {
  backgroundBonuses, characterFeats, chosenSize, deriveSheet, duplicatesBackgroundFeat, finalScores, pointBuySpent, rollAbilityPool, speciesSkillsOf, stepIssues,
  validBaseScores, type AbilityMethod, type CharacterBuild,
} from "@grimoire/shared/character-sheet";
import { speciesTraits } from "@grimoire/shared/character-view";
import {
  alignments, backgrounds, classes, findBackground, findClass, findSpecies, magicInitiateLists, originFeats,
  POINT_BUY_BUDGET, pointBuyCost, say, skillKeys, skills, species, speciesNeedsSpellAbility, speciesSizeNames, speciesSizeOptions, speciesSources,
  speciesSpellAbilities, STANDARD_ARRAY, standardLanguages,
  type BackgroundData, type BackgroundId, type ClassData, type ClassId, type FeatId, type MagicInitiateList, type SkillKey, type SpeciesId, type SpeciesSize, type Text,
} from "@grimoire/shared/dnd2024";
import type { Locale } from "@grimoire/shared/i18n";
import { chosenSubclassId, subclassLabel, unlockedFeatures } from "@grimoire/shared/levelup";
import { featInfo } from "@grimoire/shared/levelup-data";
import { abilities, abilityModifier, type AbilityKey, type AbilityScores } from "@grimoire/shared/rules";
import { castingFor, cleanSpells, sheetSpells, slotRows, spellIssues, spellLevelName, spellsLeft, type SpellChoices } from "@grimoire/shared/spells";
import { findSubclass, subclassesFor } from "@grimoire/shared/subclasses";
import { I18nService } from "../core/i18n.service";
import { SpellManagerComponent } from "./spell-manager.component";
import { wz } from "./wizard-styles";

/**
 * The 2024 character creator: nine guided steps (class, background, species, abilities, proficiencies, spells,
 * equipment, details and a computed summary), or every step on one page with selects ("quick" sheet). Both save
 * the same `CharacterBuild`. Also exports `newBuild` (the creator's starting point) and `describeBuild`
 * (display names stored next to the build).
 */

export interface WizardResult {
  name: string;
  level: number;
  notes: string;
  build: CharacterBuild;
}

const copy = {
  en: {
    kicker: "Character creation, 2024 rules", create: "Forge a new adventurer", edit: "Revise your adventurer",
    steps: ["Class", "Background", "Species", "Abilities", "Proficiencies", "Spells", "Equipment", "Details", "Summary"],
    back: "Back", next: "Continue", save: "Save character", cancel: "Cancel", close: "Close creator", quickCreate: "Character on one page",
    stepOf: (current: number, total: number) => `Step ${current} of ${total}`,
    classIntro: "Your class is the heart of your adventurer: it sets your Hit Points, proficiencies and core features.",
    level: "Starting level", hitDie: "Hit Die", primary: "Primary ability", saves: "Saving throws", armor: "Armor training",
    weapons: "Weapons", tools: "Tools", features: "Level 1 features", skillsPick: (n: number) => `Choose ${n} skills`,
    anySkill: "any skill", subclass: "Subclass (level 3)", pickSubclass: "Choose a subclass", srdTag: "SRD", bookTag: "Player's Handbook",
    spellcasting: "Spellcasting", cantrips: "Cantrips", prepared: "Prepared spells", masteries: (n: number) => `Weapon Mastery with ${n} kinds of weapons`,
    backgroundIntro: "Your background tells where you came from. In the 2024 rules it grants the ability score increases, an Origin feat, two skills and a tool.",
    abilitiesLabel: "Ability increases", feat: "Origin feat", skills: "Skill proficiencies", tool: "Tool proficiency",
    speciesIntro: "Your species grants traits such as size, speed and senses. It no longer changes your ability scores.",
    size: "Size", speed: "Speed", darkvision: "Darkvision", traits: "Traits", ft: "ft.", source: "Source", creatureType: "Creature type", speciesSkills: "Skills",
    chooseSize: "Choose your size", sizeHelp: { medium: "About 4 to 7 feet tall", small: "About 2 to 4 feet tall" },
    spellAbility: "Spellcasting ability for species spells", spellAbilityHelp: "Usually the one your class casts with.", classCasts: "your class",
    chooseSkill: (n: number) => n === 1 ? "Choose 1 skill" : `Choose ${n} skills`, chooseFeat: "Versatile: choose an Origin feat",
    spellList: "Spell list",
    spellsIntro: "Choose the cantrips you know and the spells you start with prepared. Tap the “i” next to a spell to read what it does.",
    spellsMissing: (cantrips: number, prepared: number) => `Still to choose: ${[cantrips ? `${cantrips} ${cantrips === 1 ? "cantrip" : "cantrips"}` : "", prepared ? `${prepared} ${prepared === 1 ? "spell" : "spells"}` : ""].filter(Boolean).join(" and ")}. You can continue and pick them later from the sheet.`, abilitiesIntro: "Generate your six scores, then apply your background's increases (maximum 20).",
    methods: { standard: "Standard array", pointBuy: "Point buy", rolled: "Roll 4d6" } as Record<AbilityMethod, string>,
    methodHelp: { standard: "Assign 15, 14, 13, 12, 10 and 8.", pointBuy: `Spend up to ${POINT_BUY_BUDGET} points; scores from 8 to 15.`, rolled: "Roll 4d6 six times, dropping the lowest die each time." } as Record<AbilityMethod, string>,
    suggest: "Suggest for my class", roll: "Roll the dice", points: (spent: number) => `${spent} / ${POINT_BUY_BUDGET} points`,
    rollOnce: "You roll once per character: the results can't be rolled again, only assigned.",
    rollLocked: "These rolls are final. Assign them to the abilities you prefer.",
    rollDetail: (dice: number[]) => `Dice ${dice.slice(0, 3).join(", ")} (dropped ${dice[3]})`,
    rolledLabel: (index: number) => `Roll ${index + 1}`,
    lower: (ability: string) => `Lower ${ability}`, raise: (ability: string) => `Raise ${ability}`,
    classChangeWarning: "Changing class discards the choices saved at each level-up.",
    bonusMode: "Background increase", plus2plus1: "+2 and +1", plus1x3: "+1 to all three", plusTwo: "+2 to", plusOne: "+1 to",
    base: "Base", bonus: "Bonus", final: "Final", mod: "Mod",
    profIntro: "Pick the skills your class trains. Skills you already have from your background or species are marked.",
    already: "already proficient", skilled: "Skilled feat: choose 3 skills", expertise: (n: number) => `Expertise: choose ${n} proficient skills`,
    equipmentIntro: "Take the starting kit or the gold to buy your own gear.", classKit: "Class equipment", backgroundKit: "Background equipment",
    option: (id: string) => `Option ${id}`, totalGold: "Starting gold",
    detailsIntro: "Name your character and decide who they are.", name: "Name", namePlaceholder: "Iria Valen", alignment: "Alignment",
    languages: "Languages", languagesHelp: "You know Common and two more standard languages.", appearance: "Appearance and personality", notes: "Notes",
    summaryIntro: "Review the sheet. Everything here is calculated from your choices.",
    ac: "Armor Class", hp: "Hit Points", initiative: "Initiative", proficiency: "Proficiency", passive: "Passive Perception", spellDc: "Spell save DC", spellAtk: "Spell attack",
    issues: {
      cantrips: "You have more cantrips than your class allows.", prepared: "You have more prepared spells than your class allows.",
      lineage: "Choose a lineage or ancestry.", spellAbility: "Choose the ability for your species spells.", speciesSkills: "Choose the species skill.", speciesFeat: "Choose the Origin feat.",
      scores: "Assign valid scores for the chosen method.", roll: "Roll the dice to get your scores.", bonuses: "Apply the background increases.", classSkills: "Choose all class skills.",
      duplicateFeat: "Your background already grants that feat: choose another one (Magic Initiate only with another spell list).",
      featSkills: "Choose 3 skills for Skilled.", expertise: "Choose your Expertise skills.", languages: "Choose two languages.", name: "Give your character a name.",
    } as Record<string, string>,
    srd: "Rules data from the 2024 Player's Handbook and the System Reference Document 5.2 (CC-BY-4.0).",
  },
  es: {
    kicker: "Creación de personaje, reglas 2024", create: "Forja un nuevo aventurero", edit: "Revisa tu aventurero",
    steps: ["Clase", "Trasfondo", "Especie", "Características", "Competencias", "Conjuros", "Equipo", "Detalles", "Resumen"],
    back: "Atrás", next: "Continuar", save: "Guardar personaje", cancel: "Cancelar", close: "Cerrar creador", quickCreate: "Personaje en una página",
    stepOf: (current: number, total: number) => `Paso ${current} de ${total}`,
    classIntro: "La clase es el corazón de tu aventurero: define sus puntos de golpe, competencias y rasgos principales.",
    level: "Nivel inicial", hitDie: "Dado de golpe", primary: "Característica principal", saves: "Tiradas de salvación", armor: "Entrenamiento con armaduras",
    weapons: "Armas", tools: "Herramientas", features: "Rasgos de nivel 1", skillsPick: (n: number) => `Elige ${n} habilidades`,
    anySkill: "cualquier habilidad", subclass: "Subclase (nivel 3)", pickSubclass: "Elige una subclase", srdTag: "SRD", bookTag: "Manual del Jugador",
    spellcasting: "Lanzamiento de conjuros", cantrips: "Trucos", prepared: "Conjuros preparados", masteries: (n: number) => `Maestría con ${n} tipos de armas`,
    backgroundIntro: "El trasfondo cuenta de dónde vienes. En las reglas de 2024 otorga los aumentos de característica, una dote de origen, dos habilidades y una herramienta.",
    abilitiesLabel: "Aumentos de característica", feat: "Dote de origen", skills: "Competencias en habilidades", tool: "Competencia con herramienta",
    speciesIntro: "La especie otorga rasgos como tamaño, velocidad y sentidos. Ya no modifica tus características.",
    size: "Tamaño", speed: "Velocidad", darkvision: "Visión en la oscuridad", traits: "Rasgos", ft: "pies", source: "Fuente", creatureType: "Tipo de criatura", speciesSkills: "Habilidades",
    chooseSize: "Elige tu tamaño", sizeHelp: { medium: "Entre 1,2 y 2,1 m de altura", small: "Entre 0,6 y 1,2 m de altura" },
    spellAbility: "Característica para los conjuros de la especie", spellAbilityHelp: "Normalmente, la que usa tu clase para lanzar conjuros.", classCasts: "tu clase",
    chooseSkill: (n: number) => n === 1 ? "Elige 1 habilidad" : `Elige ${n} habilidades`, chooseFeat: "Versátil: elige una dote de origen",
    spellList: "Lista de conjuros",
    spellsIntro: "Elige los trucos que conoces y los conjuros con los que empiezas preparados. Toca la «i» junto a un conjuro para leer qué hace.",
    spellsMissing: (cantrips: number, prepared: number) => `Te quedan por elegir: ${[cantrips ? `${cantrips} ${cantrips === 1 ? "truco" : "trucos"}` : "", prepared ? `${prepared} ${prepared === 1 ? "conjuro" : "conjuros"}` : ""].filter(Boolean).join(" y ")}. Puedes continuar y elegirlos más tarde desde la hoja.`, abilitiesIntro: "Genera tus seis puntuaciones y aplica los aumentos del trasfondo (máximo 20).",
    methods: { standard: "Matriz estándar", pointBuy: "Compra por puntos", rolled: "Tirar 4d6" } as Record<AbilityMethod, string>,
    methodHelp: { standard: "Asigna 15, 14, 13, 12, 10 y 8.", pointBuy: `Gasta hasta ${POINT_BUY_BUDGET} puntos; puntuaciones de 8 a 15.`, rolled: "Tira 4d6 seis veces y descarta el dado más bajo cada vez." } as Record<AbilityMethod, string>,
    suggest: "Sugerir para mi clase", roll: "Tirar los dados", points: (spent: number) => `${spent} / ${POINT_BUY_BUDGET} puntos`,
    rollOnce: "Se tira una sola vez por personaje: los resultados no se pueden repetir, solo repartir.",
    rollLocked: "Estas tiradas son definitivas. Repártelas entre las características que prefieras.",
    rollDetail: (dice: number[]) => `Dados ${dice.slice(0, 3).join(", ")} (descartado ${dice[3]})`,
    rolledLabel: (index: number) => `Tirada ${index + 1}`,
    lower: (ability: string) => `Bajar ${ability}`, raise: (ability: string) => `Subir ${ability}`,
    classChangeWarning: "Cambiar de clase descarta las elecciones guardadas en cada subida de nivel.",
    bonusMode: "Aumento del trasfondo", plus2plus1: "+2 y +1", plus1x3: "+1 a las tres", plusTwo: "+2 a", plusOne: "+1 a",
    base: "Base", bonus: "Bono", final: "Final", mod: "Mod",
    profIntro: "Elige las habilidades que entrena tu clase. Las que ya tienes por trasfondo o especie aparecen marcadas.",
    already: "ya competente", skilled: "Dote Habilidoso: elige 3 habilidades", expertise: (n: number) => `Pericia: elige ${n} habilidades en las que seas competente`,
    equipmentIntro: "Quédate con el equipo inicial o con el oro para comprar el tuyo.", classKit: "Equipo de clase", backgroundKit: "Equipo de trasfondo",
    option: (id: string) => `Opción ${id}`, totalGold: "Oro inicial",
    detailsIntro: "Dale nombre a tu personaje y decide quién es.", name: "Nombre", namePlaceholder: "Iria Valen", alignment: "Alineamiento",
    languages: "Idiomas", languagesHelp: "Conoces el común y dos idiomas estándar más.", appearance: "Apariencia y personalidad", notes: "Notas",
    summaryIntro: "Revisa la ficha. Todo se calcula a partir de tus elecciones.",
    ac: "Clase de armadura", hp: "Puntos de golpe", initiative: "Iniciativa", proficiency: "Competencia", passive: "Percepción pasiva", spellDc: "CD de conjuros", spellAtk: "Ataque de conjuro",
    issues: {
      cantrips: "Tienes más trucos de los que permite tu clase.", prepared: "Tienes más conjuros preparados de los que permite tu clase.",
      lineage: "Elige un linaje o ascendencia.", spellAbility: "Elige la característica para los conjuros de la especie.", speciesSkills: "Elige la habilidad de la especie.", speciesFeat: "Elige la dote de origen.",
      scores: "Asigna puntuaciones válidas para el método elegido.", roll: "Tira los dados para obtener tus puntuaciones.", bonuses: "Aplica los aumentos del trasfondo.", classSkills: "Elige todas las habilidades de clase.",
      duplicateFeat: "Tu trasfondo ya otorga esa dote: elige otra (Iniciado en la magia solo con otra lista de conjuros).",
      featSkills: "Elige 3 habilidades para Habilidoso.", expertise: "Elige tus habilidades de Pericia.", languages: "Elige dos idiomas.", name: "Ponle nombre a tu personaje.",
    } as Record<string, string>,
    srd: "Datos de reglas del Manual del Jugador 2024 y del System Reference Document 5.2 (CC-BY-4.0).",
  },
};

const SPELLS_STEP = 5;
const DETAILS_STEP = 7;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];
const METHODS: AbilityMethod[] = ["standard", "pointBuy", "rolled"];

const signed = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value)}`;

/** Ability scores that put the class's primary abilities first, then Constitution. */
function suggestedAssignment(values: readonly number[], classId: ClassId): AbilityScores {
  const cls = findClass(classId);
  const order: AbilityKey[] = [...(cls?.primary ?? [])];
  for (const key of ["con", "dex", "wis", "str", "int", "cha"] as AbilityKey[]) if (!order.includes(key)) order.push(key);
  const sorted = [...values].sort((a, b) => b - a);
  return Object.fromEntries(order.map((key, index) => [key, sorted[index]])) as AbilityScores;
}

/** +2/+1 from the background, favouring the class's primary abilities. */
function defaultBonusAbilities(background: BackgroundData, cls: ClassData | undefined): AbilityKey[] {
  const preferred = background.abilities.filter((key) => cls?.primary.includes(key));
  const ordered = [...preferred, ...background.abilities.filter((key) => !preferred.includes(key))];
  return [ordered[0], ordered[1]];
}

/**
 * A roll made in the creator but not saved yet. Kept in the browser so closing the creator, cancelling or reloading the page
 * brings back the same dice instead of a fresh roll; it is cleared once a character keeps it.
 */
const PENDING_ROLL_ITEM = "grimoire.pendingRoll.v1";
type PendingRoll = { pool: number[]; dice: number[][] };

function readPendingRoll(): PendingRoll | undefined {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(PENDING_ROLL_ITEM);
    const value = raw ? JSON.parse(raw) as PendingRoll : undefined;
    const die = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 6;
    if (value && Array.isArray(value.pool) && Array.isArray(value.dice) && value.pool.length === 6 && value.dice.length === 6
      && value.dice.every((dice, index) => Array.isArray(dice) && dice.length === 4 && dice.every(die)
        && dice[0] + dice[1] + dice[2] === value.pool[index])) return value;
  } catch { /* storage blocked or corrupt: no pending roll */ }
  return undefined;
}

function writePendingRoll(roll: PendingRoll | null) {
  try {
    if (roll) window.localStorage.setItem(PENDING_ROLL_ITEM, JSON.stringify(roll));
    else window.localStorage.removeItem(PENDING_ROLL_ITEM);
  } catch { /* storage blocked: the roll still lives in the build until the creator closes */ }
}

export function newBuild(): CharacterBuild {
  return {
    version: 1, classId: "fighter", useSubclass: true, backgroundId: "soldier", speciesId: "human",
    abilityMethod: "standard", baseScores: suggestedAssignment(STANDARD_ARRAY, "fighter"), bonusMode: "plus2plus1",
    bonusAbilities: ["str", "con"], classSkills: [], speciesSkills: [], featSkills: [], expertise: [], languages: [],
    classEquipment: "A", backgroundEquipment: "A", alignment: 4, appearance: "",
  };
}

/** A grid of skill checkboxes with a pick limit; skills granted elsewhere show ticked and locked. */
@Component({
  selector: "div[appSkillPicker]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (row of rows(); track row.skill) {
      <label [class]="skillClass" [attr.data-on]="row.isChosen ? 'true' : null" [attr.data-locked]="row.isLocked ? 'true' : null">
        <input #box type="checkbox" [checked]="row.isChosen || row.isLocked" [disabled]="row.isLocked || row.full" (change)="toggle(row.skill, box.checked)" />
        <span>{{ row.name }}<small>{{ row.detail }}</small></span>
      </label>
    }
  `,
})
class SkillPickerComponent {
  private readonly t = inject(I18nService).t;

  readonly options = input.required<SkillKey[]>();
  readonly chosen = input.required<SkillKey[]>();
  readonly limit = input.required<number>();
  readonly locked = input.required<Set<SkillKey>>();
  readonly onChange = input.required<(next: SkillKey[]) => void>();
  readonly lockedLabel = input.required<string>();

  protected readonly skillClass = wz.skill;

  protected readonly rows = computed(() => {
    const chosen = this.chosen();
    const locked = this.locked();
    const limit = this.limit();
    const lockedLabel = this.lockedLabel();
    return this.options().map((skill) => {
      const isLocked = locked.has(skill);
      const isChosen = chosen.includes(skill);
      return {
        skill, isLocked, isChosen,
        full: chosen.length >= limit && !isChosen,
        name: this.t(`skill.${skill}`),
        detail: `${this.t(`ability.${skills[skill]}`).slice(0, 3)}${isLocked ? ` · ${lockedLabel}` : ""}`,
      };
    });
  });

  protected toggle(skill: SkillKey, checked: boolean): void {
    const chosen = this.chosen();
    this.onChange()(checked ? [...chosen, skill] : chosen.filter((item) => item !== skill));
  }
}

@Component({
  selector: "app-character-wizard",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkillPickerComponent, SpellManagerComponent],
  host: { class: "contents" },
  templateUrl: "./character-wizard.component.html",
})
export class CharacterWizardComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  private readonly locale = this.i18n.locale;
  protected readonly c = computed(() => copy[this.locale()]);

  readonly initial = input<{ name: string; level: number; notes: string; build: CharacterBuild }>();
  /** Quick sheet: every step on one page, picking with selects; saves the same build as the guided creator. */
  readonly quick = input<boolean>(false);
  readonly onSave = input.required<(result: WizardResult) => void>();
  readonly onCancel = input.required<() => void>();

  protected readonly step = signal(0);
  protected readonly build = signal<CharacterBuild>(newBuild());
  protected readonly name = signal("");
  protected readonly level = signal(1);
  protected readonly notes = signal("");

  protected readonly styles = wz;
  protected readonly methods = METHODS;
  protected readonly magicInitiateListIds = Object.keys(magicInitiateLists) as MagicInitiateList[];
  protected readonly alignments = alignments;
  protected readonly spellsStep = SPELLS_STEP;
  protected readonly speciesSources = speciesSources;
  protected readonly speciesSizeNames = speciesSizeNames;
  protected readonly magicInitiateLists = magicInitiateLists;

  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>("nameInput");
  /** The name field that already took the focus, so it is focused once each time it appears (as autofocus does). */
  private focusedName: HTMLInputElement | null = null;

  constructor() {
    afterRenderEffect(() => {
      const element = this.nameInput()?.nativeElement ?? null;
      if (element && element !== this.focusedName) element.focus();
      this.focusedName = element;
    });
  }

  ngOnInit(): void {
    const initial = this.initial();
    // A build that has never rolled picks up a roll left pending in this browser, so the dice can't be re-rolled by reopening the creator.
    const start = initial?.build ?? newBuild();
    const pending = start.rolledPool?.length ? undefined : readPendingRoll();
    this.build.set(pending ? { ...start, rolledPool: pending.pool, rolledDice: pending.dice } : start);
    this.name.set(initial?.name ?? "");
    this.level.set(initial?.level ?? 1);
    this.notes.set(initial?.notes ?? "");
  }

  private update(patch: Partial<CharacterBuild>): void {
    this.build.update((current) => ({ ...current, ...patch }));
  }

  protected readonly cls = computed(() => findClass(this.build().classId)!);
  protected readonly bg = computed(() => findBackground(this.build().backgroundId)!);
  protected readonly sp = computed(() => findSpecies(this.build().speciesId)!);
  private readonly sheet = computed(() => deriveSheet(this.build(), this.level()));
  protected readonly feats = computed(() => characterFeats(this.build()));
  private readonly fixedSpeciesSkills = computed(() => this.sp().skills ?? []);
  protected readonly chosenLineage = computed(() => this.sp().lineages?.find((item) => item.id === this.build().lineageId));
  protected readonly sizeOptions = computed(() => speciesSizeOptions(this.sp()));
  protected readonly beforeClass = computed(() => new Set<SkillKey>([...this.bg().skills, ...speciesSkillsOf(this.build())]));
  private readonly spellProblems = computed(() => spellIssues(this.build(), this.level()));
  protected readonly casting = computed(() => castingFor(this.build(), this.level()));
  private readonly missing = computed(() => spellsLeft(this.build(), this.level()));
  protected readonly issues = computed(() => {
    const build = this.build();
    const step = this.step();
    const named = !!this.name().trim();
    return this.quick()
      ? [...new Set([...this.c().steps.flatMap((_, index) => stepIssues(build, index)), ...this.spellProblems(), ...(named ? [] : ["name"])])]
      : [...stepIssues(build, step), ...(step === SPELLS_STEP ? this.spellProblems() : []), ...(step === DETAILS_STEP && !named ? ["name"] : [])];
  });
  protected readonly issueText = computed(() => { const c = this.c(); return this.issues().map((issue) => c.issues[issue]).filter(Boolean).join(" "); });
  protected readonly last = computed(() => this.c().steps.length - 1);

  protected readonly pool = computed(() => this.build().abilityMethod === "standard" ? [...STANDARD_ARRAY] : this.build().rolledPool ?? []);
  protected readonly awaitingRoll = computed(() => this.build().abilityMethod === "rolled" && this.pool().length !== 6);
  protected readonly classOptions = computed(() => this.cls().skillOptions.length ? this.cls().skillOptions : skillKeys);
  protected readonly proficientForExpertise = computed(() => {
    const build = this.build();
    return [...new Set([...this.bg().skills, ...speciesSkillsOf(build), ...build.classSkills, ...(this.feats().includes("skilled") ? build.featSkills : [])])];
  });

  // What the skill pickers get: options and locks change only with the choices they depend on.
  protected readonly speciesSkillOptions = computed(() => { const choice = this.sp().skillChoice; return choice?.options.length ? choice.options : skillKeys; });
  protected readonly speciesSkillLocked = computed(() => new Set<SkillKey>([...this.bg().skills, ...this.fixedSpeciesSkills()]));
  protected readonly allSkills = skillKeys;
  protected readonly featSkillLocked = computed(() => new Set<SkillKey>([...this.beforeClass(), ...this.build().classSkills]));
  protected readonly noLocks = new Set<SkillKey>();

  /** The step bar of the guided creator. */
  protected readonly stepItems = computed(() => {
    const step = this.step();
    return this.c().steps.map((label, index) => ({
      label, index,
      state: index === step ? "current" : index < step ? "done" : null,
      mark: index < step ? "✓" : ROMAN[index],
    }));
  });

  protected readonly title = computed(() => { const c = this.c(); return this.quick() ? c.quickCreate : this.initial() ? c.edit : c.create; });
  protected readonly levelUpsSaved = computed(() => !!this.initial()?.build.levelUps?.length);

  // Step 1: class.
  protected readonly classCards = computed(() => {
    const locale = this.locale();
    return classes.map((item) => ({
      id: item.id,
      name: say(item.name, locale),
      small: `d${item.hitDie} · ${item.primary.map((key) => this.t(`ability.${key}`)).join(" / ")}`,
      summary: say(item.summary, locale),
    }));
  });
  protected readonly classFacts = computed(() => {
    const locale = this.locale();
    const c = this.c();
    const cls = this.cls();
    return {
      name: say(cls.name, locale),
      primary: cls.primary.map((key) => this.t(`ability.${key}`)).join(" / "),
      saves: cls.saves.map((key) => this.t(`ability.${key}`)).join(", "),
      armor: say(cls.armor, locale),
      weapons: say(cls.weapons, locale),
      tools: cls.tools ? say(cls.tools, locale) : null,
      skills: cls.skillOptions.length ? cls.skillOptions.map((skill) => this.t(`skill.${skill}`)).join(", ") : c.anySkill,
      features: `${cls.features.map((feature) => say(feature.name, locale)).join(" · ")}${cls.weaponMasteries ? ` — ${c.masteries(cls.weaponMasteries)}` : ""}`,
      spellcasting: cls.spellcasting
        ? `${this.t(`ability.${cls.spellcasting.ability}`)} · ${c.cantrips} ${cls.spellcasting.cantrips} · ${c.prepared} ${cls.spellcasting.prepared} · ${say(cls.spellcasting.slots, locale)}`
        : null,
    };
  });
  protected readonly chosenSubclass = computed(() => chosenSubclassId(this.build()));
  protected readonly subclassOptions = computed(() => {
    const locale = this.locale();
    const c = this.c();
    return subclassesFor(this.build().classId).map((entry) => ({ id: entry.id, label: `${say(entry.name, locale)} (${entry.srd ? c.srdTag : c.bookTag})` }));
  });

  // Step 2: background.
  protected readonly backgroundCards = computed(() => {
    const locale = this.locale();
    return backgrounds.map((item) => ({
      id: item.id,
      name: say(item.name, locale),
      small: item.abilities.map((key) => this.t(`ability.${key}`).slice(0, 3)).join(" · "),
      summary: say(item.summary, locale),
    }));
  });
  protected readonly backgroundFacts = computed(() => {
    const locale = this.locale();
    const bg = this.bg();
    return {
      name: say(bg.name, locale),
      abilities: bg.abilities.map((key) => this.t(`ability.${key}`)).join(", "),
      feat: `${say(originFeats[bg.feat].name, locale)}${bg.featList ? ` (${say(magicInitiateLists[bg.featList], locale)})` : ""} — ${say(originFeats[bg.feat].summary, locale)}`,
      skills: bg.skills.map((skill) => this.t(`skill.${skill}`)).join(", "),
      tool: say(bg.tool, locale),
    };
  });

  // Step 3: species.
  protected readonly speciesCards = computed(() => {
    const locale = this.locale();
    const c = this.c();
    return species.map((item) => ({
      id: item.id,
      name: say(item.name, locale),
      small: `${say(item.size, locale)} · ${item.speed} ${c.ft}${item.darkvision ? ` · ◐ ${item.darkvision}` : ""}`,
      traits: item.traits.map((trait) => say(trait.name, locale)).join(" · "),
      source: say(speciesSources[item.source], locale),
    }));
  });
  protected readonly speciesSkillNames = computed(() => this.fixedSpeciesSkills().map((skill) => this.t(`skill.${skill}`)).join(", "));
  protected readonly needsSpellAbility = computed(() => speciesNeedsSpellAbility(this.sp(), this.build().lineageId));
  protected readonly spellAbilityOptions = speciesSpellAbilities;
  protected readonly originFeatOptions = computed(() => {
    const locale = this.locale();
    const build = this.build();
    const c = this.c();
    return (Object.keys(originFeats) as FeatId[]).map((feat) => {
      const duplicate = feat !== "magicInitiate" && duplicatesBackgroundFeat(build, feat);
      return { feat, name: say(originFeats[feat].name, locale), summary: say(originFeats[feat].summary, locale), disabled: duplicate, title: duplicate ? c.issues["duplicateFeat"] : null };
    });
  });

  // Step 4: abilities.
  protected readonly pointsSpent = computed(() => pointBuySpent(this.build().baseScores));
  protected readonly pointBudget = POINT_BUY_BUDGET;
  protected readonly rolls = computed(() => {
    const c = this.c();
    const dice = this.build().rolledDice;
    return this.pool().map((value, index) => {
      const detail = dice?.[index] ? c.rollDetail(dice[index]) : null;
      return { value, title: detail, label: `${c.rolledLabel(index)}: ${value}${detail ? `. ${detail}` : ""}` };
    });
  });
  protected readonly poolOptions = computed(() => [...new Set(this.pool())].sort((a, b) => b - a));
  protected readonly abilityRows = computed(() => {
    const build = this.build();
    const c = this.c();
    const cls = this.cls();
    const awaitingRoll = this.awaitingRoll();
    const bonuses = backgroundBonuses(build);
    const scores = finalScores(build);
    const base = build.baseScores;
    return abilities.map(({ key }) => {
      const name = this.t(`ability.${key}`);
      return {
        key, name,
        primary: cls.primary.includes(key),
        base: base[key],
        cost: pointBuyCost[base[key]],
        lowerDisabled: base[key] <= 8,
        raiseDisabled: base[key] >= 15 || pointBuySpent({ ...base, [key]: base[key] + 1 }) > POINT_BUY_BUDGET,
        lowerLabel: c.lower(name),
        raiseLabel: c.raise(name),
        bonus: bonuses[key] ? `+${bonuses[key]}` : "—",
        final: awaitingRoll ? "—" : String(scores[key]),
        mod: awaitingRoll ? "—" : signed(abilityModifier(scores[key])),
      };
    });
  });
  protected readonly bonusSlots = [0, 1] as const;
  protected readonly validScores = computed(() => validBaseScores(this.build()));

  // Step 7: equipment.
  protected readonly kitGroups = computed(() => {
    const locale = this.locale();
    const c = this.c();
    const build = this.build();
    const options = (list: { id: string; items: Text[] }[]) => list.map((option) => ({
      id: option.id, label: c.option(option.id), items: option.items.map((item) => ({ key: item.en, text: say(item, locale) })),
    }));
    return [
      { kind: "class" as const, title: `${c.classKit} · ${say(this.cls().name, locale)}`, options: options(this.cls().equipment), value: build.classEquipment as string },
      { kind: "background" as const, title: `${c.backgroundKit} · ${say(this.bg().name, locale)}`, options: options(this.bg().equipment), value: build.backgroundEquipment as string },
    ];
  });
  protected readonly gold = computed(() => `${this.sheet()?.gold ?? 0} ${this.locale() === "es" ? "po" : "GP"}`);

  // Step 8: details.
  protected readonly languageOptions = computed(() => {
    const locale = this.locale();
    const chosenList = this.build().languages;
    return standardLanguages.map((language, index) => {
      const chosen = chosenList.includes(index);
      return { key: language.en, index, name: say(language, locale), chosen, disabled: !chosen && chosenList.length >= 2 };
    });
  });

  // Step 9: summary.
  protected readonly summary = computed(() => {
    const sheet = this.sheet();
    if (!sheet) return null;
    const locale = this.locale();
    const c = this.c();
    const build = this.build();
    const level = this.level();
    const cls = this.cls();
    const sp = this.sp();
    const casting = this.casting();
    const subclass = subclassLabel(build, level, locale);
    return {
      name: this.name() || "—",
      identity: [say(sp.lineages?.find((item) => item.id === build.lineageId)?.name, locale), say(sp.name, locale), say(cls.name, locale), `${locale === "es" ? "nivel" : "level"} ${sheet.level}`].filter(Boolean).join(" · "),
      origin: `${say(this.bg().name, locale)} · ${say(alignments[build.alignment], locale)}${subclass ? ` · ${subclass}` : ""}`,
      vitals: ([[c.ac, sheet.armorClass], [c.hp, sheet.hitPoints], [c.initiative, signed(sheet.initiative)], [c.speed, `${sheet.speed} ${c.ft}`], [c.proficiency, signed(sheet.proficiency)], [c.passive, sheet.passivePerception]] as const)
        .map(([label, value]) => ({ label, value })),
      abilities: abilities.map(({ key }) => ({
        key,
        short: this.t(`ability.${key}`).slice(0, 3).toLocaleUpperCase(locale === "es" ? "es-ES" : "en-US"),
        mod: signed(abilityModifier(sheet.scores[key])),
        score: sheet.scores[key],
        saveProficient: sheet.saves[key].proficient,
        save: `${c.saves.split(" ")[0]} ${signed(sheet.saves[key].bonus)}`,
      })),
      skills: skillKeys.map((skill) => ({
        skill,
        proficient: sheet.skills[skill].proficient,
        mark: sheet.skills[skill].expertise ? "◆" : sheet.skills[skill].proficient ? "●" : "○",
        name: this.t(`skill.${skill}`),
        bonus: signed(sheet.skills[skill].bonus),
      })),
      features: unlockedFeatures(build, level).map((feature) => say(feature.name, locale)).join(" · "),
      traits: `${speciesTraits(build).map((trait) => say(trait.name, locale)).join(" · ")}${sheet.darkvision ? ` · ${c.darkvision} ${sheet.darkvision} ${c.ft}` : ""}${sheet.speciesSpells ? ` · ${c.spellDc} ${sheet.speciesSpells.saveDc}, ${c.spellAtk} ${signed(sheet.speciesSpells.attack)}` : ""}`,
      feats: sheet.feats.map((feat) => say(featInfo(feat).name, locale)).join(" · "),
      spellcasting: cls.spellcasting
        ? `${c.spellDc} ${sheet.spellSaveDc} · ${c.spellAtk} ${signed(sheet.spellAttack ?? 0)}${casting ? ` · ${slotRows(casting, undefined).map((row) => `${spellLevelName(row.level, locale)}: ${row.total}`).join(", ")}` : ""}`
        : null,
      spellGroups: sheetSpells(build.spells, locale).map((group) => ({
        level: group.level, name: spellLevelName(group.level, locale), spells: group.spells.map((entry) => say(entry.name, locale)).join(" · "),
      })),
      languages: [locale === "es" ? "Común" : "Common", ...build.languages.map((index) => say(standardLanguages[index], locale))].join(", "),
      gold: `${sheet.gold} ${locale === "es" ? "po" : "GP"} · ${c.hitDie} ${sheet.hitDice}`,
    };
  });

  protected readonly spellsMissing = computed(() => {
    const missing = this.missing();
    return this.casting() && (missing.cantrips > 0 || missing.prepared > 0) ? this.c().spellsMissing(missing.cantrips, missing.prepared) : null;
  });

  /** Whether a step is on screen: every one in the quick sheet, the current one in the guided creator. */
  protected show(target: number): boolean {
    return this.quick() || this.step() === target;
  }

  protected say(text: Text | undefined): string {
    return say(text, this.locale());
  }

  protected chooseClass(classId: ClassId): void {
    const build = this.build();
    if (classId === build.classId) return;
    // Level-up choices (Fighting Styles, Expertise, feats…) belong to the old class.
    this.update({ classId, classSkills: [], expertise: [], classEquipment: "A", useSubclass: true, subclassId: undefined, customSubclass: undefined, levelUps: undefined,
      // Spells from feats or the species stay; the old class's cantrips and prepared spells go.
      spells: cleanSpells({ ...build, classId, useSubclass: true, subclassId: undefined, spells: build.spells ? { ...build.spells, known: [], book: [], custom: build.spells.custom?.filter((entry) => entry.other) } : undefined }, this.level()),
      ...(build.abilityMethod === "standard" ? { baseScores: suggestedAssignment(STANDARD_ARRAY, classId) } : {}) });
  }

  /** Skill picks that a new background or species already grants are dropped, so the player chooses others. */
  private pruneSkills(granted: SkillKey[], patch: Partial<CharacterBuild>): Partial<CharacterBuild> {
    const build = this.build();
    const classSkills = build.classSkills.filter((skill) => !granted.includes(skill));
    const featSkills = build.featSkills.filter((skill) => !granted.includes(skill) && !classSkills.includes(skill));
    return { classSkills, featSkills, ...patch };
  }

  protected chooseBackground(backgroundId: BackgroundId): void {
    const build = this.build();
    if (backgroundId === build.backgroundId) return;
    const next = findBackground(backgroundId)!;
    const patch = this.pruneSkills(next.skills, {
      backgroundId, bonusAbilities: build.bonusMode === "plus2plus1" ? defaultBonusAbilities(next, this.cls()) : [...next.abilities], backgroundEquipment: "A",
      speciesSkills: build.speciesSkills.filter((skill) => !next.skills.includes(skill)),
    });
    const proficient = new Set([...next.skills, ...this.fixedSpeciesSkills(), ...(patch.speciesSkills ?? []), ...(patch.classSkills ?? []), ...(patch.featSkills ?? [])]);
    this.update({ ...patch, expertise: build.expertise.filter((skill) => proficient.has(skill)) });
  }

  protected chooseSpecies(speciesId: SpeciesId): void {
    const build = this.build();
    if (speciesId === build.speciesId) return;
    // Skills the new species grants outright replace the same class or Skilled picks.
    const granted = findSpecies(speciesId)?.skills ?? [];
    const bg = this.bg();
    const patch = this.pruneSkills(granted, { speciesId, lineageId: undefined, size: undefined, speciesSkills: [], speciesFeat: undefined });
    const proficient = new Set([...bg.skills, ...granted, ...(patch.classSkills ?? []), ...(bg.feat === "skilled" ? patch.featSkills ?? [] : [])]);
    this.update({ ...patch, expertise: build.expertise.filter((skill) => proficient.has(skill)) });
  }

  /** The quick sheet's selects hand over the option's value. */
  protected pickClass(value: string): void { this.chooseClass(value as ClassId); }
  protected pickBackground(value: string): void { this.chooseBackground(value as BackgroundId); }
  protected pickSpecies(value: string): void { this.chooseSpecies(value as SpeciesId); }

  protected setLevel(field: HTMLInputElement): void {
    const next = Math.min(20, Math.max(1, Math.floor(Number(field.value) || 1)));
    this.level.set(next);
    // A controlled field: what is typed out of range shows the clamped level straight away.
    if (Number(field.value) !== next) field.value = String(next);
  }

  protected pickSubclass(value: string): void {
    const picked = findSubclass(this.build().classId, value);
    if (picked) this.update({ useSubclass: !!picked.srd, subclassId: picked.srd ? undefined : picked.id, customSubclass: undefined });
  }

  protected setLineage(lineageId: string): void { this.update({ lineageId }); }
  protected readonly chosenSize = computed(() => chosenSize(this.build()));
  protected setSize(size: SpeciesSize): void { this.update({ size }); }
  protected setSpeciesSpellAbility(ability: AbilityKey): void { this.update({ speciesSpellAbility: ability }); }
  protected pickSpeciesFeat(feat: FeatId): void {
    this.update({ speciesFeat: feat, featSkills: this.bg().feat === "skilled" ? this.build().featSkills : [] });
  }
  protected setMagicInitiateList(value: string): void { this.update({ magicInitiateList: value as MagicInitiateList }); }

  protected readonly changeSpeciesSkills = (speciesSkills: SkillKey[]): void => {
    this.update({ speciesSkills, classSkills: this.build().classSkills.filter((skill) => !speciesSkills.includes(skill)) });
  };
  protected readonly changeClassSkills = (classSkills: SkillKey[]): void => {
    const build = this.build();
    const proficientForExpertise = this.proficientForExpertise();
    this.update({ classSkills, featSkills: build.featSkills.filter((skill) => !classSkills.includes(skill)), expertise: build.expertise.filter((skill) => proficientForExpertise.includes(skill) || classSkills.includes(skill)) });
  };
  protected readonly changeFeatSkills = (featSkills: SkillKey[]): void => { this.update({ featSkills }); };
  protected readonly changeExpertise = (expertise: SkillKey[]): void => { this.update({ expertise }); };
  protected readonly changeSpells = (spells: SpellChoices): void => { this.update({ spells }); };

  /** Swap-based assignment keeps a fixed pool of values (standard array or rolls). */
  protected assign(key: AbilityKey, value: number): void {
    const build = this.build();
    const current = build.baseScores[key];
    const other = abilities.find(({ key: candidate }) => candidate !== key && build.baseScores[candidate] === value)?.key;
    this.update({ baseScores: { ...build.baseScores, [key]: value, ...(other ? { [other]: current } : {}) } });
  }

  protected adjust(key: AbilityKey, delta: number): void {
    const baseScores = this.build().baseScores;
    this.update({ baseScores: { ...baseScores, [key]: baseScores[key] + delta } });
  }

  protected setMethod(method: AbilityMethod): void {
    const build = this.build();
    if (method === build.abilityMethod) return;
    if (method === "standard") this.update({ abilityMethod: method, baseScores: suggestedAssignment(STANDARD_ARRAY, build.classId) });
    else if (method === "pointBuy") this.update({ abilityMethod: method, baseScores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 } });
    // Coming back to rolling reuses the dice already rolled for this character; a new roll only happens with the button.
    else this.update({ abilityMethod: method, ...(build.rolledPool?.length === 6 ? { baseScores: suggestedAssignment(build.rolledPool, build.classId) } : {}) });
  }

  protected suggest(): void {
    this.update({ baseScores: suggestedAssignment(this.pool(), this.build().classId) });
  }

  protected rollScores(): void {
    const build = this.build();
    if (build.rolledPool?.length) return; // One roll per character.
    const { pool, dice } = rollAbilityPool();
    writePendingRoll({ pool, dice });
    this.update({ abilityMethod: "rolled", rolledPool: pool, rolledDice: dice, baseScores: suggestedAssignment(pool, build.classId) });
  }

  protected setBonusMode(mode: CharacterBuild["bonusMode"]): void {
    const bg = this.bg();
    if (mode === "plus2plus1") this.update({ bonusMode: "plus2plus1", bonusAbilities: defaultBonusAbilities(bg, this.cls()) });
    else this.update({ bonusMode: "plus1x3", bonusAbilities: [...bg.abilities] });
  }

  protected setBonusAbility(slot: 0 | 1, value: string): void {
    const bg = this.bg();
    const next = [...this.build().bonusAbilities] as AbilityKey[];
    next[slot] = value as AbilityKey;
    if (next[0] === next[1]) next[1 - slot] = bg.abilities.find((key) => key !== next[slot])!;
    this.update({ bonusAbilities: next });
  }

  protected setKit(kind: "class" | "background", id: string): void {
    if (kind === "class") this.update({ classEquipment: id as CharacterBuild["classEquipment"] });
    else this.update({ backgroundEquipment: id as CharacterBuild["backgroundEquipment"] });
  }

  protected setAlignment(value: string): void { this.update({ alignment: Number(value) }); }
  protected setAppearance(value: string): void { this.update({ appearance: value }); }
  protected toggleLanguage(index: number, checked: boolean): void {
    const languages = this.build().languages;
    this.update({ languages: checked ? [...languages, index] : languages.filter((item) => item !== index) });
  }

  protected go(target: number): void {
    if (target === 4) {
      // Drop class choices that became duplicates after changing background or species.
      const beforeClass = this.beforeClass();
      this.update({ classSkills: this.build().classSkills.filter((skill) => !beforeClass.has(skill)) });
    }
    this.step.set(target);
  }

  protected back(): void {
    if (!this.quick() && this.step()) this.go(this.step() - 1);
    else this.onCancel()();
  }

  protected cancel(): void {
    this.onCancel()();
  }

  protected finish(): void {
    const build = this.build();
    const level = this.level();
    const name = this.name();
    const spellProblems = this.spellProblems();
    // The stepper allows jumping ahead, so check every step before saving.
    const incomplete = this.c().steps.findIndex((_, index) => stepIssues(build, index).length > 0 || (index === SPELLS_STEP && spellProblems.length > 0) || (index === DETAILS_STEP && !name.trim()));
    if (incomplete >= 0) { this.step.set(incomplete); return; }
    // Level-ups above the chosen level no longer apply.
    // A pending roll used by this character now belongs to it, and the next character rolls fresh. One it didn't use stays pending.
    const pending = readPendingRoll();
    const usesPending = !!pending && pending.pool.join() === build.rolledPool?.join();
    if (usesPending && build.abilityMethod === "rolled") writePendingRoll(null);
    const kept = usesPending && build.abilityMethod !== "rolled" ? { ...build, rolledPool: undefined, rolledDice: undefined } : build;
    this.onSave()({ name: name.trim(), level, notes: this.notes().trim(), build: { ...kept, levelUps: build.levelUps?.filter((entry) => entry.level <= level), spells: cleanSpells(kept, level) } });
  }
}

/** Display names stored alongside the build so older views keep working. */
export function describeBuild(build: CharacterBuild, locale: Locale, level = 20) {
  const sp = findSpecies(build.speciesId);
  const lineage = sp?.lineages?.find((item) => item.id === build.lineageId);
  const subclass = subclassLabel(build, level, locale);
  return {
    className: `${say(findClass(build.classId)?.name, locale)}${subclass ? ` (${subclass})` : ""}`,
    species: [say(lineage?.name, locale), say(sp?.name, locale)].filter(Boolean).join(" · "),
    background: say(findBackground(build.backgroundId)?.name, locale),
    scores: finalScores(build, level),
  };
}
