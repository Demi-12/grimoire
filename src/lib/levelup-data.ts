/**
 * Level 2-20 progression for the 2024 rules, limited to what the System Reference Document 5.2
 * (CC-BY-4.0, Wizards of the Coast) publishes: the 12 classes with their SRD subclass and the SRD feats.
 * Feature names are official; the one-line tips are our own plain-language summaries, not rules text.
 */
import type { AbilityKey } from "./rules";
import type { ClassId, FeatId, SkillKey, Text } from "./dnd2024";

const t = (en: string, es: string): Text => ({ en, es });

export interface Feature { name: Text; tip: Text }
const f = (en: string, es: string, tipEn: string, tipEs: string): Feature => ({ name: t(en, es), tip: t(tipEn, tipEs) });

export type FightingStyleId = "archery" | "defense" | "greatWeaponFighting" | "twoWeaponFighting";
export type EpicBoonId = "combatProwess" | "dimensionalTravel" | "fate" | "irresistibleOffense" | "spellRecall" | "nightSpirit" | "truesight";
export type LevelFeatId = FeatId | "grappler" | FightingStyleId | EpicBoonId;

export interface FeatInfo {
  name: Text;
  summary: Text;
  category: "origin" | "general" | "fightingStyle" | "epicBoon";
  /** Abilities the feat can raise by 1 (the player picks one). */
  abilities?: AbilityKey[];
  /** Prerequisite: at least one of these abilities must be 13 or higher. */
  requires?: AbilityKey[];
}

const allAbilities: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

export const featCatalog: Record<LevelFeatId, FeatInfo> = {
  alert: { category: "origin", name: t("Alert", "Alerta"), summary: t("Add your Proficiency Bonus to Initiative and swap Initiative with a willing ally.", "Suma tu bonificador por competencia a la iniciativa y puedes intercambiarla con un aliado.") },
  magicInitiate: { category: "origin", name: t("Magic Initiate", "Iniciado en la magia"), summary: t("Learn two cantrips and one level 1 spell from the Cleric, Druid or Wizard list.", "Aprende dos trucos y un conjuro de nivel 1 de la lista de clérigo, druida o mago.") },
  savageAttacker: { category: "origin", name: t("Savage Attacker", "Atacante salvaje"), summary: t("Once per turn, roll weapon damage dice twice and use either roll.", "Una vez por turno, tira dos veces los dados de daño de un arma y elige el resultado.") },
  skilled: { category: "origin", name: t("Skilled", "Habilidoso"), summary: t("Gain proficiency in any combination of three skills or tools.", "Obtienes competencia en tres habilidades o herramientas a tu elección.") },
  grappler: { category: "general", name: t("Grappler", "Luchador"), abilities: ["str", "dex"], requires: ["str", "dex"], summary: t("+1 Strength or Dexterity, and you get much better at grabbing and pinning enemies.", "+1 a Fuerza o Destreza, y te vuelves mucho mejor agarrando e inmovilizando enemigos.") },
  archery: { category: "fightingStyle", name: t("Archery", "Arquería"), summary: t("+2 to attack rolls with ranged weapons.", "+2 a las tiradas de ataque con armas a distancia.") },
  defense: { category: "fightingStyle", name: t("Defense", "Defensa"), summary: t("+1 Armor Class while you wear armor.", "+1 a la Clase de Armadura mientras llevas armadura.") },
  greatWeaponFighting: { category: "fightingStyle", name: t("Great Weapon Fighting", "Combate con armas grandes"), summary: t("When you roll a 1 or 2 on a damage die with a two-handed weapon, treat it as a 3.", "Con un arma a dos manos, un 1 o un 2 en un dado de daño cuenta como 3.") },
  twoWeaponFighting: { category: "fightingStyle", name: t("Two-Weapon Fighting", "Combate con dos armas"), summary: t("Add your ability modifier to the damage of your extra off-hand attack.", "Suma tu modificador al daño del ataque extra con la mano torpe.") },
  combatProwess: { category: "epicBoon", abilities: allAbilities, name: t("Boon of Combat Prowess", "Don de destreza en combate"), summary: t("Once per turn, turn a missed attack into a hit.", "Una vez por turno, convierte un ataque fallado en un impacto.") },
  dimensionalTravel: { category: "epicBoon", abilities: allAbilities, name: t("Boon of Dimensional Travel", "Don de viaje dimensional"), summary: t("Teleport a short distance whenever you attack or cast a spell.", "Te teletransportas a poca distancia cuando atacas o lanzas un conjuro.") },
  fate: { category: "epicBoon", abilities: allAbilities, name: t("Boon of Fate", "Don del destino"), summary: t("Nudge any nearby d20 roll up or down with a bonus die.", "Cambia con un dado extra cualquier tirada de d20 cercana.") },
  irresistibleOffense: { category: "epicBoon", abilities: ["str", "dex"], name: t("Boon of Irresistible Offense", "Don de ofensiva irresistible"), summary: t("Your weapon damage ignores resistance, and critical hits hit harder.", "Tu daño de arma ignora resistencias y tus críticos hacen más daño.") },
  spellRecall: { category: "epicBoon", abilities: ["int", "wis", "cha"], name: t("Boon of Spell Recall", "Don de recuerdo de conjuros"), summary: t("Cast some spells without spending a spell slot.", "Lanza algunos conjuros sin gastar espacio de conjuro.") },
  nightSpirit: { category: "epicBoon", abilities: allAbilities, name: t("Boon of the Night Spirit", "Don del espíritu nocturno"), summary: t("Turn invisible in dim light or darkness and resist most damage there.", "Te vuelves invisible con luz tenue u oscuridad y resistes casi todo el daño.") },
  truesight: { category: "epicBoon", abilities: allAbilities, name: t("Boon of Truesight", "Don de visión verdadera"), summary: t("See through darkness, illusions and invisibility up to 60 feet.", "Ves a través de oscuridad, ilusiones e invisibilidad hasta 60 pies.") },
};

export const featInfo = (id: LevelFeatId): FeatInfo => featCatalog[id];
/** Feats a character can take with an Ability Score Improvement, besides raising scores. */
export const asiFeats: LevelFeatId[] = ["grappler", "alert", "savageAttacker", "skilled", "magicInitiate"];
export const fightingStyles: FightingStyleId[] = ["archery", "defense", "greatWeaponFighting", "twoWeaponFighting"];
export const epicBoons: EpicBoonId[] = ["combatProwess", "dimensionalTravel", "fate", "irresistibleOffense", "spellRecall", "nightSpirit", "truesight"];

// --- Levels at which a choice appears -------------------------------------------------------------------------------

const standardAsi = [4, 8, 12, 16];
export const asiLevels = (classId: ClassId): number[] => [...standardAsi, ...(classId === "fighter" ? [6, 14] : []), ...(classId === "rogue" ? [10] : [])].sort((a, b) => a - b);
export const BOON_LEVEL = 19;
export const SUBCLASS_LEVEL = 3;
export const isAsiLevel = (classId: ClassId, level: number) => asiLevels(classId).includes(level);

/** Expertise a class grants at a level: how many proficient skills to double, optionally from a fixed list. */
export interface ExpertiseGrant { count: number; from?: SkillKey[] }
const scholarSkills: SkillKey[] = ["arcana", "history", "investigation", "medicine", "nature", "religion"];
const expertiseTable: Partial<Record<ClassId, Record<number, ExpertiseGrant>>> = {
  bard: { 2: { count: 2 }, 9: { count: 2 } },
  rogue: { 6: { count: 2 } },
  ranger: { 2: { count: 1 }, 9: { count: 2 } },
  wizard: { 2: { count: 1, from: scholarSkills } },
};
export const expertiseGrant = (classId: ClassId, level: number): ExpertiseGrant | null => expertiseTable[classId]?.[level] ?? null;

/** Levels where the class (or the SRD subclass) grants a Fighting Style choice. */
export function fightingStyleLevel(classId: ClassId, level: number, srdSubclass: boolean): boolean {
  if ((classId === "paladin" || classId === "ranger") && level === 2) return true;
  return classId === "fighter" && srdSubclass && level === 7;
}

// --- Class features -------------------------------------------------------------------------------------------------

type Progression = Partial<Record<number, Feature[]>>;

/** Features gained at each level (2-20). Subclass features, ASIs, Expertise and Fighting Style choices are added by the planner. */
export const classFeatures: Record<ClassId, Progression> = {
  barbarian: {
    2: [f("Danger Sense", "Sentido del peligro", "Advantage on Dexterity saves against effects you can see, like traps and spells.", "Ventaja en salvaciones de Destreza contra efectos que veas, como trampas y conjuros."),
      f("Reckless Attack", "Ataque temerario", "Attack with advantage this turn, but enemies get advantage against you until your next turn.", "Atacas con ventaja este turno, pero los enemigos la tienen contra ti hasta tu próximo turno.")],
    3: [f("Primal Knowledge", "Conocimiento primigenio", "Gain another Barbarian skill; while raging you can use Strength for some skill checks.", "Ganas otra habilidad de bárbaro; en furia puedes usar Fuerza en algunas pruebas.")],
    5: [f("Extra Attack", "Ataque adicional", "Attack twice, instead of once, when you take the Attack action.", "Atacas dos veces, en vez de una, al usar la acción de Atacar."),
      f("Fast Movement", "Movimiento rápido", "+10 feet of speed while you aren't wearing heavy armor.", "+10 pies de velocidad si no llevas armadura pesada.")],
    7: [f("Feral Instinct", "Instinto feral", "Advantage on Initiative rolls.", "Ventaja en las tiradas de iniciativa."),
      f("Instinctive Pounce", "Embestida instintiva", "When you start a Rage, you can move up to half your speed.", "Al empezar una furia, puedes moverte hasta la mitad de tu velocidad.")],
    9: [f("Brutal Strike", "Golpe brutal", "Trade your Reckless Attack advantage for extra damage and a nasty side effect.", "Cambia la ventaja del Ataque temerario por daño extra y un efecto adicional.")],
    11: [f("Relentless Rage", "Furia implacable", "If you drop to 0 HP while raging, a Constitution save can keep you standing.", "Si caes a 0 PG en furia, una salvación de Constitución puede mantenerte en pie.")],
    13: [f("Improved Brutal Strike", "Golpe brutal mejorado", "Brutal Strike gets two new, stronger effects.", "Golpe brutal gana dos efectos nuevos y más potentes.")],
    15: [f("Persistent Rage", "Furia persistente", "Your Rage is much harder to end, and you regain Rages when you roll Initiative.", "Tu furia es mucho más difícil de terminar y recuperas furias al tirar iniciativa.")],
    17: [f("Improved Brutal Strike", "Golpe brutal mejorado", "Brutal Strike gets even stronger.", "Golpe brutal es aún más fuerte.")],
    18: [f("Indomitable Might", "Poder indomable", "If a Strength check total is lower than your Strength score, use the score instead.", "Si el total de una prueba de Fuerza es menor que tu Fuerza, usa el valor de Fuerza.")],
    20: [f("Primal Champion", "Campeón primigenio", "Strength and Constitution each go up by 4 (maximum 25).", "Fuerza y Constitución suben 4 puntos (máximo 25).")],
  },
  bard: {
    2: [f("Jack of All Trades", "Aprendiz de todo", "Add half your Proficiency Bonus to checks you aren't proficient in.", "Suma la mitad de tu competencia a pruebas en las que no eres competente.")],
    5: [f("Font of Inspiration", "Fuente de inspiración", "You regain Bardic Inspiration after a Short or Long Rest.", "Recuperas Inspiración bárdica tras un descanso corto o largo.")],
    7: [f("Countercharm", "Contraencantamiento", "Help allies shake off being Charmed or Frightened.", "Ayuda a tus aliados a librarse de ser hechizados o asustados.")],
    10: [f("Magical Secrets", "Secretos mágicos", "Prepare spells from any class's list, not just the Bard list.", "Prepara conjuros de la lista de cualquier clase, no solo la de bardo.")],
    18: [f("Superior Inspiration", "Inspiración superior", "Start each fight with Bardic Inspiration uses ready.", "Empiezas cada combate con usos de Inspiración bárdica disponibles.")],
    20: [f("Words of Creation", "Palabras de creación", "Learn two powerful spells that can affect extra creatures.", "Aprendes dos conjuros muy poderosos que afectan a una criatura extra.")],
  },
  cleric: {
    2: [f("Channel Divinity", "Canalizar divinidad", "Spend a use to heal or turn undead, plus extras from your subclass.", "Gasta un uso para sanar o expulsar muertos vivientes, más extras de tu subclase.")],
    5: [f("Sear Undead", "Abrasar muertos vivientes", "Turning undead also burns them with radiant damage.", "Expulsar muertos vivientes también les quema con daño radiante.")],
    7: [f("Blessed Strikes", "Golpes bendecidos", "Add extra radiant damage to your cantrips or weapon hits.", "Añade daño radiante extra a tus trucos o golpes con arma.")],
    10: [f("Divine Intervention", "Intervención divina", "Ask your deity to cast a Cleric spell for you once per rest.", "Pide a tu deidad que lance un conjuro de clérigo por ti una vez por descanso.")],
    14: [f("Improved Blessed Strikes", "Golpes bendecidos mejorados", "Your Blessed Strikes bonus damage grows.", "El daño extra de Golpes bendecidos aumenta.")],
    20: [f("Greater Divine Intervention", "Intervención divina superior", "Divine Intervention can now cast the mighty Wish spell.", "Intervención divina ya puede lanzar el poderoso conjuro Deseo.")],
  },
  druid: {
    2: [f("Wild Shape", "Forma salvaje", "Turn into an animal to fight, scout or survive.", "Te transformas en un animal para luchar, explorar o sobrevivir."),
      f("Wild Companion", "Compañero salvaje", "Spend a Wild Shape use to summon a helpful animal spirit.", "Gasta un uso de Forma salvaje para invocar un espíritu animal aliado.")],
    5: [f("Wild Resurgence", "Resurgir salvaje", "Swap spell slots and Wild Shape uses back and forth.", "Intercambia espacios de conjuro y usos de Forma salvaje.")],
    7: [f("Elemental Fury", "Furia elemental", "Add elemental damage to your cantrips or Wild Shape attacks.", "Añade daño elemental a tus trucos o ataques en Forma salvaje.")],
    15: [f("Improved Elemental Fury", "Furia elemental mejorada", "Elemental Fury reaches farther and hits harder.", "Furia elemental llega más lejos y pega más fuerte.")],
    18: [f("Beast Spells", "Conjuros de bestia", "Cast spells while in Wild Shape.", "Lanza conjuros mientras estás en Forma salvaje.")],
    20: [f("Archdruid", "Archidruida", "Wild Shape returns more easily and you stop aging.", "Recuperas Forma salvaje con más facilidad y dejas de envejecer.")],
  },
  fighter: {
    2: [f("Action Surge", "Oleada de acción", "Take one extra action on your turn (once per rest).", "Realizas una acción extra en tu turno (una vez por descanso)."),
      f("Tactical Mind", "Mente táctica", "Add a d10 to a failed skill check by spending Second Wind.", "Suma 1d10 a una prueba de habilidad fallida gastando Tomar aliento.")],
    5: [f("Extra Attack", "Ataque adicional", "Attack twice, instead of once, when you take the Attack action.", "Atacas dos veces, en vez de una, al usar la acción de Atacar."),
      f("Tactical Shift", "Cambio táctico", "Second Wind also lets you move without provoking attacks.", "Tomar aliento también te deja moverte sin provocar ataques.")],
    9: [f("Indomitable", "Indomable", "Reroll a failed saving throw with a bonus.", "Repite una salvación fallida con un bonificador."),
      f("Tactical Master", "Maestro táctico", "Swap your weapon's mastery property for a different one when you attack.", "Cambia la propiedad de maestría del arma al atacar.")],
    11: [f("Two Extra Attacks", "Dos ataques adicionales", "Attack three times when you take the Attack action.", "Atacas tres veces al usar la acción de Atacar.")],
    13: [f("Studied Attacks", "Ataques estudiados", "After you miss a creature, you get advantage on your next attack against it.", "Tras fallar a una criatura, tienes ventaja en tu siguiente ataque contra ella."),
      f("Indomitable (two uses)", "Indomable (dos usos)", "You can use Indomitable twice between long rests.", "Puedes usar Indomable dos veces entre descansos largos.")],
    17: [f("Action Surge (two uses)", "Oleada de acción (dos usos)", "Use Action Surge twice per rest (but only once per turn).", "Usa Oleada de acción dos veces por descanso (una por turno)."),
      f("Indomitable (three uses)", "Indomable (tres usos)", "You can use Indomitable three times between long rests.", "Puedes usar Indomable tres veces entre descansos largos.")],
    20: [f("Three Extra Attacks", "Tres ataques adicionales", "Attack four times when you take the Attack action.", "Atacas cuatro veces al usar la acción de Atacar.")],
  },
  monk: {
    2: [f("Monk's Focus", "Enfoque del monje", "Spend Focus Points on Flurry of Blows, Patient Defense and Step of the Wind.", "Gasta Puntos de enfoque en Ráfaga de golpes, Defensa paciente y Paso del viento."),
      f("Unarmored Movement", "Movimiento sin armadura", "Faster speed while you wear no armor.", "Más velocidad mientras no llevas armadura."),
      f("Uncanny Metabolism", "Metabolismo sobrenatural", "When you roll Initiative, regain Focus Points and some HP (once per long rest).", "Al tirar iniciativa recuperas Puntos de enfoque y algo de PG (una vez por descanso largo).")],
    3: [f("Deflect Attacks", "Desviar ataques", "Use your reaction to reduce damage from a weapon attack, even throw it back.", "Usa tu reacción para reducir el daño de un ataque con arma, incluso devolverlo.")],
    4: [f("Slow Fall", "Caída lenta", "Reduce falling damage with your reaction.", "Reduce el daño por caída con tu reacción.")],
    5: [f("Extra Attack", "Ataque adicional", "Attack twice, instead of once, when you take the Attack action.", "Atacas dos veces, en vez de una, al usar la acción de Atacar."),
      f("Stunning Strike", "Golpe aturdidor", "Spend a Focus Point on a hit to try to stun the target.", "Gasta un Punto de enfoque al impactar para intentar aturdir al objetivo.")],
    6: [f("Empowered Strikes", "Golpes potenciados", "Your unarmed strikes can deal force damage.", "Tus golpes sin armas pueden hacer daño de fuerza.")],
    7: [f("Evasion", "Evasión", "Take no damage on a successful Dexterity save against area effects, and half on a failure.", "No sufres daño si superas una salvación de Destreza contra efectos de área, y la mitad si fallas.")],
    9: [f("Acrobatic Movement", "Movimiento acrobático", "Run up walls and across water without falling.", "Corres por paredes y sobre el agua sin caer.")],
    10: [f("Heightened Focus", "Enfoque intensificado", "Flurry of Blows, Patient Defense and Step of the Wind get stronger.", "Ráfaga de golpes, Defensa paciente y Paso del viento mejoran."),
      f("Self-Restoration", "Autorrestauración", "End a Charmed, Frightened or Poisoned condition on yourself.", "Termina un estado de hechizado, asustado o envenenado en ti.")],
    13: [f("Deflect Energy", "Desviar energía", "Deflect Attacks now works on all damage types.", "Desviar ataques funciona ahora contra todo tipo de daño.")],
    14: [f("Disciplined Survivor", "Superviviente disciplinado", "Proficiency in all saving throws, and spend Focus Points to reroll one.", "Competencia en todas las salvaciones; gasta enfoque para repetir una.")],
    15: [f("Perfect Focus", "Enfoque perfecto", "Regain Focus Points when you roll Initiative with few left.", "Recuperas Puntos de enfoque al tirar iniciativa si te quedan pocos.")],
    18: [f("Superior Defense", "Defensa superior", "Spend Focus Points to resist nearly all damage types for a minute.", "Gasta enfoque para resistir casi todo tipo de daño durante un minuto.")],
    20: [f("Body and Mind", "Cuerpo y mente", "Dexterity and Wisdom each go up by 4 (maximum 25).", "Destreza y Sabiduría suben 4 puntos (máximo 25).")],
  },
  paladin: {
    2: [f("Paladin's Smite", "Castigo del paladín", "Always have Divine Smite ready, free once per long rest.", "Siempre tienes Castigo divino preparado, gratis una vez por descanso largo.")],
    3: [f("Channel Divinity", "Canalizar divinidad", "Spend a use for a divine effect; your subclass adds more options.", "Gasta un uso para un efecto divino; tu subclase añade más opciones.")],
    5: [f("Extra Attack", "Ataque adicional", "Attack twice, instead of once, when you take the Attack action.", "Atacas dos veces, en vez de una, al usar la acción de Atacar."),
      f("Faithful Steed", "Montura fiel", "Cast Find Steed for free once per long rest.", "Lanza Encontrar montura gratis una vez por descanso largo.")],
    6: [f("Aura of Protection", "Aura de protección", "You and allies within 10 feet add your Charisma modifier to saving throws.", "Tú y tus aliados a 10 pies sumáis tu mod. de Carisma a las salvaciones.")],
    9: [f("Abjure Foes", "Repeler enemigos", "Use Channel Divinity to frighten nearby foes.", "Usa Canalizar divinidad para asustar a enemigos cercanos.")],
    10: [f("Aura of Courage", "Aura de valor", "You and allies in your aura can't be Frightened.", "Tú y tus aliados en el aura no podéis ser asustados.")],
    11: [f("Radiant Strikes", "Golpes radiantes", "Your weapon hits deal extra radiant damage.", "Tus golpes con arma hacen daño radiante extra.")],
    14: [f("Restoring Touch", "Toque restaurador", "Lay On Hands can also remove conditions.", "Imposición de manos también puede quitar estados.")],
    18: [f("Aura Expansion", "Expansión del aura", "Your auras reach 30 feet instead of 10.", "Tus auras llegan a 30 pies en vez de 10.")],
  },
  ranger: {
    2: [f("Deft Explorer", "Explorador diestro", "Gain Expertise in one skill, two languages and extra travel know-how.", "Ganas pericia en una habilidad y dos idiomas más.")],
    5: [f("Extra Attack", "Ataque adicional", "Attack twice, instead of once, when you take the Attack action.", "Atacas dos veces, en vez de una, al usar la acción de Atacar.")],
    6: [f("Roving", "Errante", "Extra speed, plus Climb and Swim speeds.", "Más velocidad y velocidades de trepar y nadar.")],
    10: [f("Tireless", "Incansable", "Grant yourself temporary HP and shrug off exhaustion.", "Te das PG temporales y te libras del agotamiento.")],
    13: [f("Relentless Hunter", "Cazador implacable", "Taking damage can't break your concentration on Hunter's Mark.", "Recibir daño no rompe tu concentración en Marca del cazador.")],
    14: [f("Nature's Veil", "Velo de la naturaleza", "Turn invisible for a moment as a bonus action.", "Te vuelves invisible un momento con acción adicional.")],
    17: [f("Precise Hunter", "Cazador preciso", "Advantage on attacks against the creature marked by Hunter's Mark.", "Ventaja en ataques contra la criatura marcada con Marca del cazador.")],
    18: [f("Feral Senses", "Sentidos salvajes", "You can fight foes you can't see more easily.", "Luchas con más facilidad contra enemigos que no ves.")],
    20: [f("Foe Slayer", "Azote de enemigos", "Hunter's Mark damage grows to a d10.", "El daño de Marca del cazador sube a d10.")],
  },
  rogue: {
    2: [f("Cunning Action", "Acción astuta", "Dash, Disengage or Hide as a bonus action.", "Correr, Destrabarte u Ocultarte como acción adicional.")],
    3: [f("Steady Aim", "Puntería firme", "Give up your movement to gain advantage on your next attack (for Sneak Attack).", "Renuncia a moverte para tener ventaja en tu ataque (útil para Ataque furtivo).")],
    5: [f("Cunning Strike", "Golpe astuto", "Trade Sneak Attack dice for effects like poisoning or tripping.", "Cambia dados de Ataque furtivo por efectos como envenenar o derribar."),
      f("Uncanny Dodge", "Esquiva asombrosa", "Use your reaction to halve the damage of one attack.", "Usa tu reacción para reducir a la mitad el daño de un ataque.")],
    7: [f("Evasion", "Evasión", "Take no damage on a successful Dexterity save against area effects, and half on a failure.", "No sufres daño si superas una salvación de Destreza contra efectos de área, y la mitad si fallas."),
      f("Reliable Talent", "Talento fiable", "Any d20 roll of 9 or lower counts as a 10 on skills you're proficient in.", "Un d20 de 9 o menos cuenta como 10 en habilidades en las que eres competente.")],
    11: [f("Improved Cunning Strike", "Golpe astuto mejorado", "Use two Cunning Strike effects on a single hit.", "Usa dos efectos de Golpe astuto en un mismo impacto.")],
    14: [f("Devious Strikes", "Golpes pérfidos", "Cunning Strike unlocks even nastier effects.", "Golpe astuto desbloquea efectos aún más crueles.")],
    15: [f("Slippery Mind", "Mente escurridiza", "Proficiency in Wisdom and Charisma saving throws.", "Competencia en salvaciones de Sabiduría y Carisma.")],
    18: [f("Elusive", "Elusivo", "No attack roll has advantage against you while you aren't incapacitated.", "Ninguna tirada de ataque tiene ventaja contra ti mientras no estés incapacitado.")],
    20: [f("Stroke of Luck", "Golpe de suerte", "Turn a missed attack or failed check into a success (once per rest).", "Convierte un ataque o prueba fallados en un éxito (una vez por descanso).")],
  },
  sorcerer: {
    2: [f("Font of Magic", "Fuente de magia", "Sorcery Points: convert them into spell slots and back.", "Puntos de hechicería: conviértelos en espacios de conjuro y viceversa."),
      f("Metamagic", "Metamagia", "Pick two options to twist your spells, like quickening or twinning them.", "Elige dos opciones para modificar tus conjuros, como acelerarlos o duplicarlos.")],
    5: [f("Sorcerous Restoration", "Restauración hechicera", "Regain Sorcery Points on a Short Rest.", "Recuperas Puntos de hechicería en un descanso corto.")],
    7: [f("Sorcery Incarnate", "Hechicería encarnada", "Spend Sorcery Points to turn on Innate Sorcery again, with a power boost.", "Gasta Puntos de hechicería para reactivar Hechicería innata, con un extra.")],
    10: [f("Metamagic (more options)", "Metamagia (más opciones)", "Learn two additional Metamagic options.", "Aprendes dos opciones de Metamagia más.")],
    17: [f("Metamagic (more options)", "Metamagia (más opciones)", "Learn two more Metamagic options.", "Aprendes otras dos opciones de Metamagia.")],
    20: [f("Arcane Apotheosis", "Apoteosis arcana", "While Innate Sorcery is active, use one Metamagic option per turn for free.", "Con Hechicería innata activa, usa una opción de Metamagia por turno gratis.")],
  },
  warlock: {
    2: [f("Magical Cunning", "Astucia mágica", "Once per long rest, spend a minute to regain half your spell slots.", "Una vez por descanso largo, dedica un minuto a recuperar la mitad de tus espacios.")],
    9: [f("Contact Patron", "Contactar con el patrón", "Cast Contact Other Plane for free to ask your patron for advice.", "Lanza Contactar con otro plano gratis para pedir consejo a tu patrón.")],
    11: [f("Mystic Arcanum (level 6)", "Arcanum místico (nivel 6)", "Gain one level 6 spell you can cast once per long rest.", "Ganas un conjuro de nivel 6 que lanzas una vez por descanso largo.")],
    13: [f("Mystic Arcanum (level 7)", "Arcanum místico (nivel 7)", "Gain one level 7 spell you can cast once per long rest.", "Ganas un conjuro de nivel 7 que lanzas una vez por descanso largo.")],
    15: [f("Mystic Arcanum (level 8)", "Arcanum místico (nivel 8)", "Gain one level 8 spell you can cast once per long rest.", "Ganas un conjuro de nivel 8 que lanzas una vez por descanso largo.")],
    17: [f("Mystic Arcanum (level 9)", "Arcanum místico (nivel 9)", "Gain one level 9 spell you can cast once per long rest.", "Ganas un conjuro de nivel 9 que lanzas una vez por descanso largo.")],
    20: [f("Eldritch Master", "Maestro sobrenatural", "Spend a minute to regain all your Pact Magic slots.", "Dedica un minuto a recuperar todos tus espacios de Magia de pacto.")],
  },
  wizard: {
    2: [f("Scholar", "Erudito", "Gain Expertise in one Arcana, History, Investigation, Medicine, Nature or Religion skill.", "Ganas pericia en una de Arcanos, Historia, Investigación, Medicina, Naturaleza o Religión.")],
    5: [f("Memorize Spell", "Memorizar conjuro", "Swap one prepared spell for another when you finish a Short Rest.", "Cambia un conjuro preparado por otro al terminar un descanso corto.")],
    18: [f("Spell Mastery", "Maestría de conjuros", "Cast a level 1 and a level 2 spell at will, without using slots.", "Lanza un conjuro de nivel 1 y otro de nivel 2 a voluntad, sin gastar espacios.")],
    20: [f("Signature Spells", "Conjuros característicos", "Pick two level 3 spells you can cast for free once per rest.", "Elige dos conjuros de nivel 3 que lanzas gratis una vez por descanso.")],
  },
};

/** Features of the SRD subclass of each class, by level. The level 3 entry is what a beginner sees when picking it. */
export const subclassFeatures: Record<ClassId, Progression> = {
  barbarian: {
    3: [f("Frenzy", "Frenesí", "Hit harder while raging when you attack recklessly.", "Pegas más fuerte en furia cuando atacas de forma temeraria.")],
    6: [f("Mindless Rage", "Furia sin sentido", "You can't be Charmed or Frightened while raging.", "No puedes ser hechizado ni asustado mientras estás en furia.")],
    10: [f("Retaliation", "Represalia", "Hit back at anyone who damages you.", "Contraatacas a quien te hace daño.")],
    14: [f("Intimidating Presence", "Presencia intimidante", "Frighten nearby enemies as a bonus action.", "Asustas a enemigos cercanos con una acción adicional.")],
  },
  bard: {
    3: [f("Bonus Proficiencies", "Competencias adicionales", "Gain proficiency with three more skills.", "Ganas competencia en tres habilidades más."),
      f("Cutting Words", "Palabras cortantes", "Use your reaction to subtract from an enemy's roll.", "Usa tu reacción para restar a la tirada de un enemigo.")],
    6: [f("Magical Discoveries", "Descubrimientos mágicos", "Learn two spells from any class's list.", "Aprendes dos conjuros de la lista de cualquier clase.")],
    14: [f("Peerless Skill", "Habilidad sin par", "Add your Bardic Inspiration die to your own failed checks.", "Suma tu dado de Inspiración bárdica a tus propias pruebas fallidas.")],
  },
  cleric: {
    3: [f("Disciple of Life", "Discípulo de la vida", "Your healing spells restore extra HP.", "Tus conjuros de curación restauran PG extra."),
      f("Life Domain Spells", "Conjuros del dominio de la Vida", "Always have healing spells like Bless and Cure Wounds prepared.", "Siempre tienes preparados conjuros de curación como Bendecir y Curar heridas."),
      f("Preserve Life", "Preservar la vida", "Use Channel Divinity to heal several allies at once.", "Usa Canalizar divinidad para curar a varios aliados a la vez.")],
    6: [f("Blessed Healer", "Sanador bendecido", "When you heal others, you heal yourself too.", "Al curar a otros, también te curas a ti.")],
    17: [f("Supreme Healing", "Curación suprema", "Your healing dice always roll their maximum.", "Tus dados de curación siempre dan su valor máximo.")],
  },
  druid: {
    3: [f("Circle of the Land Spells", "Conjuros del Círculo de la Tierra", "Always have extra spells from your chosen land prepared.", "Siempre tienes preparados conjuros extra del terreno que elijas."),
      f("Land's Aid", "Ayuda de la tierra", "Use Wild Shape to damage foes and heal an ally.", "Usa Forma salvaje para dañar enemigos y curar a un aliado.")],
    6: [f("Natural Recovery", "Recuperación natural", "Cast a Circle spell for free and recover spell slots on a Short Rest.", "Lanza un conjuro de círculo gratis y recupera espacios en un descanso corto.")],
    10: [f("Nature's Ward", "Protección de la naturaleza", "Immune to poison and resistant to an element of your land.", "Inmune al veneno y resistente a un elemento de tu terreno.")],
    14: [f("Nature's Sanctuary", "Santuario de la naturaleza", "Conjure a magical wall of plants that protects you.", "Conjuras un muro mágico de plantas que te protege.")],
  },
  fighter: {
    3: [f("Improved Critical", "Crítico mejorado", "Your weapon attacks score a critical hit on a roll of 19 or 20.", "Tus ataques con arma son críticos con 19 o 20."),
      f("Remarkable Athlete", "Atleta notable", "Better at Strength and Dexterity checks and at jumping.", "Mejor en pruebas de Fuerza y Destreza, y al saltar.")],
    7: [f("Additional Fighting Style", "Estilo de combate adicional", "Choose a second Fighting Style.", "Eliges un segundo Estilo de combate.")],
    10: [f("Heroic Warrior", "Guerrero heroico", "Start each of your turns with Heroic Inspiration if you have none.", "Empiezas cada turno con Inspiración heroica si no la tienes.")],
    15: [f("Superior Critical", "Crítico superior", "Your weapon attacks now crit on 18-20.", "Tus ataques con arma son críticos con 18-20.")],
    18: [f("Survivor", "Superviviente", "Advantage on death saves and regain HP each turn when hurt.", "Ventaja en salvaciones de muerte y recuperas PG cada turno si estás herido.")],
  },
  monk: {
    3: [f("Open Hand Technique", "Técnica de la Mano Abierta", "Flurry of Blows can knock enemies prone, push them or stop their reactions.", "Ráfaga de golpes puede derribar, empujar o impedir reacciones.")],
    6: [f("Wholeness of Body", "Integridad corporal", "Heal yourself as a bonus action a few times per long rest.", "Te curas con una acción adicional varias veces por descanso largo.")],
    11: [f("Fleet Step", "Paso veloz", "Use Step of the Wind right after another bonus action.", "Usa Paso del viento justo después de otra acción adicional.")],
    17: [f("Quivering Palm", "Palma vibrante", "Plant deadly vibrations in a foe that you can trigger later.", "Siembras vibraciones letales en un enemigo que puedes activar después.")],
  },
  paladin: {
    3: [f("Oath of Devotion Spells", "Conjuros del Juramento de Devoción", "Always have extra holy spells prepared.", "Siempre tienes preparados conjuros sagrados extra."),
      f("Sacred Weapon", "Arma sagrada", "Channel Divinity makes your weapon shine and hit more accurately.", "Canalizar divinidad hace brillar tu arma y la vuelve más precisa.")],
    7: [f("Aura of Devotion", "Aura de devoción", "You and allies nearby can't be Charmed.", "Tú y tus aliados cercanos no podéis ser hechizados.")],
    15: [f("Smite of Protection", "Castigo de protección", "Your Divine Smite shields nearby allies.", "Tu Castigo divino protege a los aliados cercanos.")],
    20: [f("Holy Nimbus", "Nimbo sagrado", "Glow with holy light that burns enemies and helps you resist spells.", "Brillas con luz sagrada que quema a los enemigos y te ayuda contra conjuros.")],
  },
  ranger: {
    3: [f("Hunter's Lore", "Saber del cazador", "See if your marked foe is resistant or vulnerable to damage.", "Descubres si tu presa marcada resiste o es vulnerable al daño."),
      f("Hunter's Prey", "Presa del cazador", "Pick Colossus Slayer or Horde Breaker for extra damage.", "Elige Aniquilador de colosos o Rompehordas para hacer daño extra.")],
    7: [f("Defensive Tactics", "Tácticas defensivas", "Pick a defensive trick like Escape the Horde or Multiattack Defense.", "Elige un truco defensivo como Escapar de la horda o Defensa contra multiataque.")],
    11: [f("Superior Hunter's Prey", "Presa del cazador superior", "Hunter's Mark spreads extra damage to a second foe.", "Marca del cazador reparte daño extra a un segundo enemigo.")],
    15: [f("Superior Hunter's Defense", "Defensa del cazador superior", "Use your reaction to resist damage.", "Usa tu reacción para resistir daño.")],
  },
  rogue: {
    3: [f("Fast Hands", "Manos rápidas", "Use Sleight of Hand, a tool or an item as a bonus action.", "Usa Juego de manos, una herramienta o un objeto con acción adicional."),
      f("Second-Story Work", "Trabajo de tejados", "Climb faster and jump farther using Dexterity.", "Trepas más rápido y saltas más lejos con Destreza.")],
    9: [f("Supreme Sneak", "Sigilo supremo", "Stealth Attack: trade Sneak Attack dice to stay hidden.", "Ataque sigiloso: cambia dados de Ataque furtivo por seguir oculto.")],
    13: [f("Use Magic Device", "Usar dispositivo mágico", "Use magic items more easily, even ones you shouldn't.", "Usas objetos mágicos con más facilidad.")],
    17: [f("Thief's Reflexes", "Reflejos de ladrón", "Take two turns in the first round of combat.", "Haces dos turnos en la primera ronda de combate.")],
  },
  sorcerer: {
    3: [f("Draconic Resilience", "Resistencia dracónica", "More HP and natural scaly armor.", "Más PG y una armadura natural de escamas."),
      f("Draconic Spells", "Conjuros dracónicos", "Always have extra dragon-themed spells prepared.", "Siempre tienes preparados conjuros extra de temática dracónica.")],
    6: [f("Elemental Affinity", "Afinidad elemental", "Boost one damage type and resist it.", "Potencias un tipo de daño y lo resistes.")],
    14: [f("Dragon Wings", "Alas de dragón", "Sprout wings and fly.", "Te salen alas y vuelas.")],
    18: [f("Dragon Companion", "Compañero dragón", "Summon a dragon ally once per long rest.", "Invocas a un dragón aliado una vez por descanso largo.")],
  },
  warlock: {
    3: [f("Dark One's Blessing", "Bendición del Oscuro", "Gain temporary HP whenever you defeat an enemy.", "Ganas PG temporales cada vez que derrotas a un enemigo."),
      f("Fiend Spells", "Conjuros del Infernal", "Always have extra fiery spells prepared.", "Siempre tienes preparados conjuros ígneos extra.")],
    6: [f("Dark One's Own Luck", "Suerte del Oscuro", "Add a d10 to a failed check or save.", "Suma 1d10 a una prueba o salvación fallida.")],
    10: [f("Fiendish Resilience", "Resistencia infernal", "Choose a damage type to resist after each rest.", "Eliges un tipo de daño al que resistir tras cada descanso.")],
    14: [f("Hurl Through Hell", "Arrojar por el infierno", "Send a foe through the Lower Planes for devastating damage.", "Envías a un enemigo a los Planos Inferiores para hacerle un daño devastador.")],
  },
  wizard: {
    3: [f("Evocation Savant", "Erudito de evocación", "Copy Evocation spells into your spellbook cheaper and faster.", "Copias conjuros de evocación a tu libro de conjuros más barato y rápido."),
      f("Potent Cantrip", "Truco potente", "Damaging cantrips still hurt a little when targets save.", "Los trucos de daño todavía hacen algo de daño si el objetivo supera la salvación.")],
    6: [f("Sculpt Spells", "Esculpir conjuros", "Protect allies from your area spells.", "Protege a tus aliados de tus conjuros de área.")],
    10: [f("Empowered Evocation", "Evocación potenciada", "Add your Intelligence modifier to Evocation spell damage.", "Suma tu mod. de Inteligencia al daño de conjuros de evocación.")],
    14: [f("Overchannel", "Sobrecanalizar", "Deal maximum damage with a low-level spell, at a cost.", "Haces el daño máximo con un conjuro de nivel bajo, con un coste.")],
  },
};

// --- Spellcasting ---------------------------------------------------------------------------------------------------

const fullSlots: number[][] = [[2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]];
const halfSlots: number[][] = [[2], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1],
  [4, 3, 3, 2], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2]];
const fullPrepared = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
const sorcererPrepared = [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
const halfPrepared = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15];
const warlockPrepared = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15];
const warlockSlotLevel = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
const warlockSlotCount = [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4];
/** Cantrips known: base amount that grows by 1 at level 4 and again at level 10. */
const cantripBase: Partial<Record<ClassId, number>> = { bard: 2, cleric: 3, druid: 2, sorcerer: 4, warlock: 2, wizard: 3 };

export interface SpellProgress {
  cantrips: number;
  prepared: number;
  /** Number of spell slots per spell level, starting at level 1. */
  slots: number[];
  /** Warlock Pact Magic: all slots share one level. */
  pact?: { count: number; level: number };
}

export function spellProgress(classId: ClassId, level: number): SpellProgress | null {
  const index = Math.min(20, Math.max(1, Math.floor(level))) - 1;
  const base = cantripBase[classId];
  const cantrips = base === undefined ? 0 : base + (index + 1 >= 4 ? 1 : 0) + (index + 1 >= 10 ? 1 : 0);
  if (classId === "warlock") return { cantrips, prepared: warlockPrepared[index], slots: [], pact: { count: warlockSlotCount[index], level: warlockSlotLevel[index] } };
  if (classId === "paladin" || classId === "ranger") return { cantrips: 0, prepared: halfPrepared[index], slots: halfSlots[index] };
  if (classId === "sorcerer") return { cantrips, prepared: sorcererPrepared[index], slots: fullSlots[index] };
  if (base !== undefined) return { cantrips, prepared: fullPrepared[index], slots: fullSlots[index] };
  return null;
}

// --- Numbers that grow with level -----------------------------------------------------------------------------------

export interface Scaling { key: string; label: Text; value: string }

const barbarianRages = [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6];
const warlockInvocations = [1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10];
const die = (level: number, steps: [number, number][]) => `d${steps.reduce((value, [from, size]) => (level >= from ? size : value), steps[0][1])}`;

/** Class numbers worth pointing out when they change (damage dice, uses, pools). */
export function classScaling(classId: ClassId, level: number): Scaling[] {
  const index = Math.min(20, Math.max(1, level)) - 1;
  switch (classId) {
    case "barbarian": return [
      { key: "rages", label: t("Rages per long rest", "Furias por descanso largo"), value: String(barbarianRages[index]) },
      { key: "rageDamage", label: t("Rage damage", "Daño de la furia"), value: `+${level >= 16 ? 4 : level >= 9 ? 3 : 2}` }];
    case "bard": return [{ key: "inspiration", label: t("Bardic Inspiration die", "Dado de Inspiración bárdica"), value: die(level, [[1, 6], [5, 8], [10, 10], [15, 12]]) }];
    case "monk": return [
      { key: "martialArts", label: t("Martial Arts die", "Dado de Artes marciales"), value: die(level, [[1, 6], [5, 8], [11, 10], [17, 12]]) },
      ...(level >= 2 ? [{ key: "focus", label: t("Focus Points", "Puntos de enfoque"), value: String(level) }] : [])];
    case "paladin": return [{ key: "layOnHands", label: t("Lay On Hands pool", "Reserva de Imposición de manos"), value: `${level * 5} HP` }];
    case "rogue": return [{ key: "sneak", label: t("Sneak Attack", "Ataque furtivo"), value: `${Math.ceil(level / 2)}d6` }];
    case "sorcerer": return level >= 2 ? [{ key: "sorceryPoints", label: t("Sorcery Points", "Puntos de hechicería"), value: String(level) }] : [];
    case "warlock": return [{ key: "invocations", label: t("Eldritch Invocations known", "Invocaciones sobrenaturales conocidas"), value: String(warlockInvocations[index]) }];
    default: return [];
  }
}
