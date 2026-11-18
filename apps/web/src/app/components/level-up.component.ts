import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, input, type OnInit, signal } from "@angular/core";
import { abilities, abilityModifier, type AbilityKey } from "@grimoire/shared/rules";
import { findClass, magicInitiateLists, say, skillKeys, type MagicInitiateList, type SkillKey, type Text } from "@grimoire/shared/dnd2024";
import { deriveSheet, finalScores, hpPerLevelBonus, type CharacterBuild, type FeatPick, type LevelUpChoice } from "@grimoire/shared/character-sheet";
import {
  asiFeatOptions, averageHitDie, applyLevelUp, expertiseFor, expertiseOptions, fightingStyleOptions, levelGains, levelUpIssues, levelUpSteps, MAX_LEVEL,
  skillOptions, skillsFor, subclassLabel, withSubclass, type LevelStep, type SubclassPick,
} from "@grimoire/shared/levelup";
import { epicBoons, featInfo, type LevelFeatId, type FightingStyleId } from "@grimoire/shared/levelup-data";
import { castingFor, cleanSpells, sheetSpells, spellLevelName, spellsLeft, type SpellChoices } from "@grimoire/shared/spells";
import { subclassesFor, subclassTracked } from "@grimoire/shared/subclasses";
import { I18nService } from "../core/i18n.service";
import { SpellManagerComponent } from "./spell-manager.component";
import { lu, wz } from "./wizard-styles";

/**
 * The level-up guide (levels 2-20): an overview of what the new level brings, then one step per choice it asks for
 * (`levelUpSteps`: hit points, subclass, improvement or feat, Epic Boon, Fighting Style, skills, Expertise), the spells
 * step for casters and a review. Nothing is saved until the last step; the rules live in @grimoire/shared/levelup.
 */

export interface LevelUpResult { level: number; build: CharacterBuild }

type FlowStep = "overview" | LevelStep | "spells" | "review";
/** Which list of skills a group of checkboxes edits. */
type SkillTarget = "feat" | "new" | "expertise";

const copy = {
  en: {
    kicker: "Level up", title: (name: string, level: number) => `${name} reaches level ${level}`, close: "Close level up", back: "Back", next: "Continue",
    confirm: "Confirm level up", cancel: "Cancel", stepOf: (current: number, total: number) => `Step ${current} of ${total}`,
    steps: { overview: "What's new", hp: "Hit points", subclass: "Subclass", asi: "Improvement", boon: "Epic Boon", fightingStyle: "Fighting Style", skills: "Skills", expertise: "Expertise", spells: "Spells", review: "Review" } as Record<string, string>,
    reassure: "Nothing is saved until the last step, and you can go back at any time. If you're unsure, the options marked “Recommended” are safe picks for a new player.",
    newFeatures: "New abilities", noFeatures: "This level has no brand-new class feature. You still get more Hit Points, and the choices on the next steps.",
    proficiency: "Proficiency Bonus", proficiencyHelp: "Added to attacks, saves and skills you're trained in. It grows at levels 5, 9, 13 and 17.",
    numbers: "Numbers that grew", spellsTitle: "Your magic grows", cantrips: "Cantrips known", prepared: "Prepared spells", slots: "Spell slots", pact: (count: number, level: number) => `${count} slots of level ${level} (they recharge on a Short Rest)`,
    spellHint: "You'll choose your new spells in the Spells step of this guide.",
    spellsIntro: "Pick the spells this level gives you. You can also swap one you already had for another from your list.",
    spellsMissing: (cantrips: number, prepared: number) => `Still to choose: ${[cantrips ? `${cantrips} ${cantrips === 1 ? "cantrip" : "cantrips"}` : "", prepared ? `${prepared} ${prepared === 1 ? "spell" : "spells"}` : ""].filter(Boolean).join(" and ")}. You can continue and pick them later from the sheet.`,
    spellbookHint: "Wizards also copy two new spells into their spellbook every level.", subclassFeaturesTitle: "From your subclass",
    choicesAhead: "Coming up, you'll choose:", aheadNames: { subclass: "your subclass", asi: "an Ability Score Improvement or a feat", boon: "an Epic Boon", fightingStyle: "a Fighting Style", skills: "new skills", expertise: "Expertise skills" } as Record<string, string>,
    hpIntro: "Hit Points (HP) measure how much punishment you can take. Each level adds a bit more, plus your Constitution modifier. You can take the fixed average or roll your Hit Die.",
    hpAverage: "Take the average", hpAverageHelp: "A fixed number, no luck involved.", hpRoll: "Roll the die", hpRollHelp: "Could be higher or lower than average. At the table, roll a real die if you prefer.",
    recommended: "Recommended", rollFor: "Roll for me", rollLabel: (die: number) => `Result of your d${die}`, hpGain: (gain: number) => `You gain +${gain} HP this level (your Constitution modifier is included).`,
    subclassIntro: "At level 3 every class picks a subclass: a specialty that gives your character a unique style and extra abilities as they level. You can't change it later, so read the options.",
    subclassSrd: "Free SRD · abilities tracked",
    subclassSrdNote: "This is the subclass in the free System Reference Document.", level: "level",
    subclassBook: "Player's Handbook", subclassBookTracked: "Player's Handbook · abilities tracked", subclassBookNote: "Grimoire shows it on your sheet; look up its abilities in your book.",
    asiIntro: "Your hero improves! Choose one: raise your ability scores, or take a feat (a special talent). Scores can't go above 20.",
    asiScores: "Raise ability scores", asiScoresHelp: "Simple and always useful.", asiFeat: "Take a feat", asiFeatHelp: "A special talent instead of a score increase.",
    plus2: "+2 to one score", plus1: "+1 to two scores", pickOne: "Pick one ability.", pickTwo: "Pick two different abilities.", recommendedAbility: "★ Good for your class", capped: "Already at the maximum",
    featPick: "Choose a feat", featBlocked: "You can't take this one right now", pickFeatAbility: "Choose the ability that gets +1", pickFeatSkills: "Choose 3 new skills", pickList: "Choose a spell list", unavailable: "unavailable",
    boonIntro: "At level 19 heroes receive an Epic Boon: a powerful gift that goes beyond normal limits. It also adds +1 to an ability score (up to 30).", boonAbility: "Choose the ability that gets +1",
    styleIntro: "A Fighting Style is a specialty with your weapons or armor. It's a permanent bonus, so pick the one that matches how you like to fight.", styleHint: "Not sure? Defense is simple and works for everyone wearing armor.", styleOwned: "You already have it",
    skillsIntro: (count: number) => `You become proficient in ${count === 1 ? "a new skill" : `${count} new skills`}: add your Proficiency Bonus to those checks. Choose ${count}.`, skillsNone: "You're already proficient in every skill you could pick.",
    expertiseIntro: (count: number) => `Expertise doubles your Proficiency Bonus on a skill you already know. Choose ${count} of your skills.`, expertiseNone: "You don't have a skill left to improve.",
    reviewIntro: "Here is everything that will change. If it looks right, confirm and your sheet is updated.", rows: {
      level: "Level", hp: "Hit Points", proficiency: "Proficiency Bonus", ac: "Armor Class", scores: "Ability scores", subclass: "Subclass", feat: "Feat", style: "Fighting Style", skills: "New skills", expertise: "Expertise",
    } as Record<string, string>,
    issues: {
      hp: "Enter the number you rolled (1 to your die size).", subclass: "Choose a subclass.", asi: "Finish your improvement or feat.", boon: "Choose an Epic Boon and the ability that gets +1.",
      fightingStyle: "Choose a Fighting Style you don't have yet.", skills: "Choose your new skills.", expertise: "Choose the skills to improve.",
    } as Record<string, string>,
    maxLevel: "This character is already at the maximum level.",
  },
  es: {
    kicker: "Subir de nivel", title: (name: string, level: number) => `${name} llega al nivel ${level}`, close: "Cerrar subida de nivel", back: "Atrás", next: "Continuar",
    confirm: "Confirmar subida de nivel", cancel: "Cancelar", stepOf: (current: number, total: number) => `Paso ${current} de ${total}`,
    steps: { overview: "Novedades", hp: "Puntos de golpe", subclass: "Subclase", asi: "Mejora", boon: "Don épico", fightingStyle: "Estilo de combate", skills: "Habilidades", expertise: "Pericia", spells: "Conjuros", review: "Revisión" } as Record<string, string>,
    reassure: "No se guarda nada hasta el último paso y puedes volver atrás cuando quieras. Si dudas, las opciones marcadas como «Recomendado» son una apuesta segura para quien empieza.",
    newFeatures: "Nuevas habilidades", noFeatures: "Este nivel no trae una habilidad de clase nueva. Aun así ganas más puntos de golpe y tomas las decisiones de los siguientes pasos.",
    proficiency: "Bonificador por competencia", proficiencyHelp: "Se suma a ataques, salvaciones y habilidades en las que eres competente. Sube en los niveles 5, 9, 13 y 17.",
    numbers: "Números que crecen", spellsTitle: "Tu magia crece", cantrips: "Trucos conocidos", prepared: "Conjuros preparados", slots: "Espacios de conjuro", pact: (count: number, level: number) => `${count} espacios de nivel ${level} (se recuperan con un descanso corto)`,
    spellHint: "Elegirás tus conjuros nuevos en el paso «Conjuros» de esta guía.",
    spellsIntro: "Elige los conjuros que te da este nivel. También puedes cambiar uno que ya tenías por otro de tu lista.",
    spellsMissing: (cantrips: number, prepared: number) => `Te quedan por elegir: ${[cantrips ? `${cantrips} ${cantrips === 1 ? "truco" : "trucos"}` : "", prepared ? `${prepared} ${prepared === 1 ? "conjuro" : "conjuros"}` : ""].filter(Boolean).join(" y ")}. Puedes continuar y elegirlos más tarde desde la hoja.`,
    spellbookHint: "Los magos además copian dos conjuros nuevos a su libro de conjuros cada nivel.", subclassFeaturesTitle: "De tu subclase",
    choicesAhead: "A continuación elegirás:", aheadNames: { subclass: "tu subclase", asi: "una mejora de característica o una dote", boon: "un don épico", fightingStyle: "un estilo de combate", skills: "habilidades nuevas", expertise: "habilidades con pericia" } as Record<string, string>,
    hpIntro: "Los puntos de golpe (PG) miden cuánto castigo aguantas. Cada nivel suma un poco más, además de tu modificador de Constitución. Puedes tomar el promedio fijo o tirar tu dado de golpe.",
    hpAverage: "Tomar el promedio", hpAverageHelp: "Un número fijo, sin azar.", hpRoll: "Tirar el dado", hpRollHelp: "Puede salir más o menos que el promedio. En la mesa, tira un dado real si prefieres.",
    recommended: "Recomendado", rollFor: "Tirar por mí", rollLabel: (die: number) => `Resultado de tu d${die}`, hpGain: (gain: number) => `Ganas +${gain} PG este nivel (ya incluye tu modificador de Constitución).`,
    subclassIntro: "En el nivel 3 toda clase elige una subclase: una especialidad que da a tu personaje un estilo único y habilidades extra al subir. No se puede cambiar después, así que lee las opciones.",
    subclassSrd: "SRD gratuito · rasgos incluidos",
    subclassSrdNote: "Es la subclase del System Reference Document gratuito.", level: "nivel",
    subclassBook: "Manual del Jugador", subclassBookTracked: "Manual del Jugador · rasgos incluidos", subclassBookNote: "Grimoire la muestra en tu ficha; consulta sus rasgos en tu libro.",
    asiIntro: "¡Tu héroe mejora! Elige una opción: subir tus características o tomar una dote (un talento especial). Las características no pueden pasar de 20.",
    asiScores: "Subir características", asiScoresHelp: "Sencillo y siempre útil.", asiFeat: "Tomar una dote", asiFeatHelp: "Un talento especial en vez de subir características.",
    plus2: "+2 a una característica", plus1: "+1 a dos características", pickOne: "Elige una característica.", pickTwo: "Elige dos características distintas.", recommendedAbility: "★ Buena para tu clase", capped: "Ya está al máximo",
    featPick: "Elige una dote", featBlocked: "No puedes tomar esta ahora mismo", pickFeatAbility: "Elige la característica que recibe +1", pickFeatSkills: "Elige 3 habilidades nuevas", pickList: "Elige una lista de conjuros", unavailable: "no disponible",
    boonIntro: "En el nivel 19 los héroes reciben un don épico: un regalo poderoso que supera los límites normales. También suma +1 a una característica (hasta 30).", boonAbility: "Elige la característica que recibe +1",
    styleIntro: "Un estilo de combate es una especialidad con tus armas o armadura. Es un bonificador permanente, así que elige el que encaje con tu forma de luchar.", styleHint: "¿No sabes cuál? Defensa es sencillo y sirve a cualquiera que lleve armadura.", styleOwned: "Ya lo tienes",
    skillsIntro: (count: number) => `Ganas competencia en ${count === 1 ? "una habilidad nueva" : `${count} habilidades nuevas`}: sumas tu bonificador por competencia a esas pruebas. Elige ${count}.`, skillsNone: "Ya eres competente en todas las habilidades que podrías elegir.",
    expertiseIntro: (count: number) => `La pericia duplica tu bonificador por competencia en una habilidad que ya conoces. Elige ${count} de tus habilidades.`, expertiseNone: "No te queda ninguna habilidad por mejorar.",
    reviewIntro: "Esto es todo lo que va a cambiar. Si te parece bien, confirma y tu ficha se actualizará.", rows: {
      level: "Nivel", hp: "Puntos de golpe", proficiency: "Bonificador por competencia", ac: "Clase de armadura", scores: "Características", subclass: "Subclase", feat: "Dote", style: "Estilo de combate", skills: "Habilidades nuevas", expertise: "Pericia",
    } as Record<string, string>,
    issues: {
      hp: "Escribe el resultado de tu tirada (de 1 al tamaño de tu dado).", subclass: "Elige una subclase.", asi: "Termina tu mejora o tu dote.", boon: "Elige un don épico y la característica que recibe +1.",
      fightingStyle: "Elige un estilo de combate que aún no tengas.", skills: "Elige tus habilidades nuevas.", expertise: "Elige las habilidades a mejorar.",
    } as Record<string, string>,
    maxLevel: "Este personaje ya está en el nivel máximo.",
  },
};

const signed = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value)}`;

/** The level-up dialog for one character, from `level` to the next. */
@Component({
  selector: "app-level-up",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, SpellManagerComponent],
  host: { class: "contents" },
  templateUrl: "./level-up.component.html",
})
export class LevelUpComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  protected readonly t = computed(() => copy[this.i18n.locale()]);

  readonly name = input.required<string>();
  /** Level the character has now; the guide takes them to the next one. */
  readonly level = input.required<number>();
  readonly build = input.required<CharacterBuild>();
  readonly onSave = input.required<(result: LevelUpResult) => void>();
  readonly onCancel = input.required<() => void>();

  protected readonly own = lu;
  protected readonly styles = wz;
  protected readonly signed = signed;
  protected readonly epicBoons = epicBoons;
  protected readonly magicInitiateListIds = Object.keys(magicInitiateLists) as MagicInitiateList[];

  protected readonly next = computed(() => this.level() + 1);
  protected readonly cls = computed(() => findClass(this.build().classId)!);
  protected readonly position = signal(0);

  protected readonly hpMode = signal<"average" | "roll">("average");
  protected readonly rollText = signal("");
  /** "srd" or the id of a Player's Handbook subclass. */
  protected readonly subclass = signal("");
  protected readonly pick = computed((): SubclassPick | null => {
    const subclass = this.subclass();
    return subclass === "srd" ? { kind: "srd" } : subclass ? { kind: "book", id: subclass } : null;
  });
  // The build with the subclass being picked, so its level 3 features (and the choices they ask for) show up.
  protected readonly target = computed(() => withSubclass(this.build(), this.pick()));
  protected readonly steps = computed(() => levelUpSteps(this.target(), this.next()));
  private readonly casting = computed(() => castingFor(this.target(), this.next()));
  /** Starts from the spells the character already has (set once, in ngOnInit, when the inputs are known). */
  protected readonly spellPicks = signal<SpellChoices | undefined>(undefined);
  private readonly withSpells = computed(() => ({ ...this.target(), spells: this.spellPicks() }));
  protected readonly flow = computed((): FlowStep[] => ["overview", ...this.steps(), ...(this.casting() ? ["spells" as const] : []), "review"]);
  protected readonly asiKind = signal<"scores" | "feat">("scores");
  protected readonly spread = signal<"plus2" | "plus1">("plus2");
  protected readonly picks = signal<AbilityKey[]>([]);
  protected readonly featId = signal<LevelFeatId | null>(null);
  protected readonly featAbility = signal<AbilityKey | null>(null);
  protected readonly featSkills = signal<SkillKey[]>([]);
  protected readonly featList = signal<MagicInitiateList | null>(null);
  protected readonly style = signal<FightingStyleId | null>(null);
  protected readonly newSkills = signal<SkillKey[]>([]);
  protected readonly expertise = signal<SkillKey[]>([]);

  protected readonly before = computed(() => deriveSheet(this.build(), this.level()));
  protected readonly scoresBefore = computed(() => finalScores(this.build(), this.level()));
  private readonly isBoon = computed(() => this.steps().includes("boon"));
  private readonly hasAsi = computed(() => this.steps().includes("asi"));
  private readonly feat = computed((): FeatPick | undefined => {
    const featId = this.featId();
    const featAbility = this.featAbility();
    const featList = this.featList();
    return featId ? {
      id: featId, ...(featAbility ? { ability: featAbility } : {}), ...(featId === "skilled" ? { skills: this.featSkills() } : {}), ...(featId === "magicInitiate" && featList ? { list: featList } : {}),
    } : undefined;
  });
  private readonly asi = computed(() => {
    const picks = this.picks();
    const amount = this.spread() === "plus2" ? 2 : 1;
    return this.asiKind() === "scores" && picks.length ? Object.fromEntries(picks.map((key) => [key, amount])) as LevelUpChoice["asi"] : undefined;
  });
  private readonly choice = computed((): LevelUpChoice => {
    const steps = this.steps();
    const rollText = this.rollText();
    return {
      level: this.next(),
      ...(this.hpMode() === "roll" ? { hp: rollText === "" ? Number.NaN : Number(rollText) } : {}),
      ...(this.hasAsi() ? (this.asiKind() === "scores" ? { asi: this.asi() } : { feat: this.feat() }) : {}),
      ...(this.isBoon() ? { feat: this.feat() } : {}),
      ...(this.style() ? { fightingStyle: this.style()! } : {}),
      ...(steps.includes("skills") ? { skills: this.newSkills() } : {}),
      ...(steps.includes("expertise") ? { expertise: this.expertise() } : {}),
    };
  });
  protected readonly issues = computed(() => levelUpIssues(this.build(), this.next(), this.choice(), this.pick()));
  private readonly leveled = computed(() => this.issues().length === 0 ? applyLevelUp(this.build(), this.next(), this.choice(), this.pick()) : null);
  // A Long Rest comes with the new level, so spent slots aren't carried over.
  protected readonly result = computed((): CharacterBuild | null => {
    const leveled = this.leveled();
    const spellPicks = this.spellPicks();
    return leveled ? { ...leveled, spells: cleanSpells({ ...leveled, spells: spellPicks ? { ...spellPicks, used: undefined } : undefined }, this.next()) } : null;
  });
  private readonly after = computed(() => { const result = this.result(); return result ? deriveSheet(result, this.next()) : null; });

  protected readonly gains = computed(() => levelGains(this.target(), this.next()));
  protected readonly current = computed((): FlowStep | undefined => this.flow()[this.position()]);
  protected readonly blocked = computed(() => {
    const current = this.current();
    return current !== undefined && current !== "overview" && current !== "review" && current !== "spells" && this.issues().includes(current);
  });
  protected readonly missing = computed(() => spellsLeft(this.withSpells(), this.next()));
  protected readonly last = computed(() => this.position() === this.flow().length - 1);
  private readonly conModifier = computed(() => abilityModifier(this.scoresBefore().con));
  private readonly hpBonus = computed(() => hpPerLevelBonus(this.target(), this.next()));
  protected readonly hpGain = computed(() => Math.max(1, (this.choice().hp ?? averageHitDie(this.cls().hitDie)) + this.conModifier()) + this.hpBonus());
  protected readonly hpAverageGain = computed(() => Math.max(1, averageHitDie(this.cls().hitDie) + this.conModifier()) + this.hpBonus());
  protected readonly wizard = computed(() => this.build().classId === "wizard");
  protected readonly issueText = computed(() => { const current = this.current(); return this.blocked() && current ? this.t().issues[current] : ""; });
  /** The Proficiency Bonus card when this level doesn't raise it. */
  protected readonly proficiencyNow = computed(() => { const before = this.before(); return before ? signed(before.proficiency) : ""; });

  /** The choices still ahead after the overview (hit points are always there, so they're not announced). */
  protected readonly ahead = computed(() => {
    const names = this.t().aheadNames;
    return this.steps().filter((step) => step !== "hp").map((step) => names[step]);
  });
  protected readonly subclassOptions = computed(() => {
    const c = this.t();
    return subclassesFor(this.build().classId).map((entry) => ({
      key: entry.srd ? "srd" : entry.id,
      name: this.say(entry.name),
      tag: (entry.srd ? c.subclassSrd : subclassTracked(entry) ? c.subclassBookTracked : c.subclassBook).toUpperCase(),
      pitch: this.say(entry.pitch),
    }));
  });
  protected readonly subclassName = computed(() => subclassLabel(this.target(), this.next(), this.i18n.locale()));
  protected readonly asiAbilities = computed(() => {
    const amount = this.spread() === "plus2" ? 2 : 1;
    const scores = this.scoresBefore();
    const picks = this.picks();
    const primary = this.cls().primary;
    return abilities.map(({ key }) => {
      const chosen = picks.includes(key);
      return {
        key, chosen, full: scores[key] + amount > 20, recommended: primary.includes(key),
        change: `${scores[key]} → ${Math.min(20, scores[key] + (chosen ? amount : 0))}${chosen ? "" : ` (+${amount})`}`,
      };
    });
  });
  protected readonly featOptions = computed(() => asiFeatOptions(this.build(), this.next()));
  protected readonly featAbilities = computed(() => { const featId = this.featId(); return featId ? featInfo(featId).abilities : undefined; });
  protected readonly featSkillOptions = computed(() => { const before = this.before(); return skillKeys.filter((skill) => !before?.skills[skill].proficient); });
  protected readonly styleOptions = computed(() => fightingStyleOptions(this.target(), this.next()));
  protected readonly skillStep = computed(() => {
    const grant = skillsFor(this.target(), this.next());
    const options = skillOptions(this.target(), this.next());
    return { options, count: Math.min(grant?.count ?? 0, options.length) };
  });
  protected readonly expertiseStep = computed(() => {
    const grant = expertiseFor(this.target(), this.next());
    const options = expertiseOptions(this.target(), this.next());
    return { options, count: grant?.count ?? 0, limit: Math.min(grant?.count ?? 0, options.length) };
  });
  protected readonly allFeatures = computed(() => [...this.gains().features, ...this.gains().subclassFeatures]);

  protected readonly reviewRows = computed(() => {
    const c = this.t();
    const locale = this.i18n.locale();
    const result = this.result();
    const after = this.after();
    const before = this.before();
    const steps = this.steps();
    const next = this.next();
    const choice = this.choice();
    const rows: [string, string][] = [];
    if (result && after && before) {
      rows.push([c.rows.level, `${this.level()} → ${next}`]);
      rows.push([c.rows.hp, `${before.hitPoints} → ${after.hitPoints} (+${after.hitPoints - before.hitPoints})`]);
      if (after.proficiency !== before.proficiency) rows.push([c.rows.proficiency, `${signed(before.proficiency)} → ${signed(after.proficiency)}`]);
      if (after.armorClass !== before.armorClass) rows.push([c.rows.ac, `${before.armorClass} → ${after.armorClass}`]);
      const changed = abilities.filter(({ key }) => after.scores[key] !== before.scores[key]).map(({ key }) => `${this.abilityName(key)} ${before.scores[key]} → ${after.scores[key]}`);
      if (changed.length) rows.push([c.rows.scores, changed.join(" · ")]);
      if (steps.includes("subclass")) rows.push([c.rows.subclass, subclassLabel(result, next, locale)]);
      const taken = this.isBoon() || (this.hasAsi() && this.asiKind() === "feat") ? result.levelUps?.find((entry) => entry.level === next)?.feat : undefined;
      if (taken) rows.push([c.rows.feat, say(featInfo(taken.id).name, locale)]);
      if (choice.fightingStyle && steps.includes("fightingStyle")) rows.push([c.rows.style, say(featInfo(choice.fightingStyle).name, locale)]);
      if (steps.includes("skills") && this.newSkills().length) rows.push([c.rows.skills, this.newSkills().map((skill) => this.skillName(skill)).join(" · ")]);
      if (steps.includes("expertise") && this.expertise().length) rows.push([c.rows.expertise, this.expertise().map((skill) => this.skillName(skill)).join(" · ")]);
      for (const group of sheetSpells(result.spells, locale)) rows.push([spellLevelName(group.level, locale), group.spells.map((entry) => say(entry.name, locale)).join(" · ")]);
    }
    return rows;
  });

  ngOnInit(): void {
    this.spellPicks.set(this.build().spells);
  }

  protected say(text: Text | undefined): string {
    return say(text, this.i18n.locale());
  }
  protected abilityName(key: AbilityKey): string {
    return this.i18n.t(`ability.${key}`);
  }
  protected skillName(skill: SkillKey): string {
    return this.i18n.t(`skill.${skill}`);
  }
  protected featName(id: LevelFeatId): string {
    return this.say(featInfo(id).name);
  }
  protected featSummary(id: LevelFeatId): string {
    return this.say(featInfo(id).summary);
  }
  protected listName(list: MagicInitiateList): string {
    return this.say(magicInitiateLists[list]);
  }
  protected slotText(slots: number[]): string {
    const prefix = this.i18n.locale() === "es" ? "Nv" : "Lv";
    return slots.map((count, index) => `${prefix} ${index + 1}: ${count}`).join(" · ");
  }
  /** The "from → " part of an overview number, shown only when it changed. */
  protected fromText(before: number | null | undefined, after: number): string {
    return before !== null && before !== undefined && before !== after ? `${before} → ` : "";
  }
  protected scoreOf(key: AbilityKey): number {
    return this.scoresBefore()[key];
  }
  /** A score after the +1 of a feat or boon, never past `cap`. */
  protected raised(score: number, cap: number): number {
    return Math.min(cap, score + 1);
  }
  protected stepState(index: number): string | null {
    const position = this.position();
    return index === position ? "current" : index < position ? "done" : null;
  }

  protected toggleAbility(key: AbilityKey): void {
    const limit = this.spread() === "plus2" ? 1 : 2;
    this.picks.update((currentPicks) => currentPicks.includes(key) ? currentPicks.filter((item) => item !== key) : [...currentPicks, key].slice(-limit));
  }
  protected chooseFeat(id: LevelFeatId): void {
    this.featId.set(id); this.featSkills.set([]); this.featList.set(null);
    const options = featInfo(id).abilities;
    this.featAbility.set(options?.length === 1 ? options[0] : null);
  }
  protected chooseKind(kind: "scores" | "feat"): void {
    this.asiKind.set(kind); this.featId.set(null); this.featAbility.set(null); this.picks.set([]);
  }
  protected chooseSpread(spread: "plus2" | "plus1"): void {
    this.spread.set(spread); this.picks.set([]);
  }
  protected roll(): void {
    this.rollText.set(String(1 + Math.floor(Math.random() * this.cls().hitDie)));
  }
  protected toggleSkill(target: SkillTarget, skill: SkillKey, checked: boolean): void {
    const list = target === "feat" ? this.featSkills : target === "new" ? this.newSkills : this.expertise;
    list.update((chosen) => checked ? [...chosen, skill] : chosen.filter((item) => item !== skill));
  }
  protected skillChosen(target: SkillTarget, skill: SkillKey): boolean {
    return this.skillList(target).includes(skill);
  }
  protected skillCount(target: SkillTarget): number {
    return this.skillList(target).length;
  }
  private skillList(target: SkillTarget): SkillKey[] {
    return target === "feat" ? this.featSkills() : target === "new" ? this.newSkills() : this.expertise();
  }

  protected readonly setSpellPicks = (next: SpellChoices): void => { this.spellPicks.set(next); };

  protected goBack(): void {
    const position = this.position();
    if (position) this.position.set(position - 1);
    else this.onCancel()();
  }
  protected confirm(): void {
    const result = this.result();
    if (result) this.onSave()({ level: this.next(), build: result });
  }
}

export const levelUpAvailable = (level: number) => level < MAX_LEVEL;
