/**
 * Character creation data for the 2024 rules: the 12 classes with their SRD subclass,
 * the 10 Player's Handbook species plus the species of Eberron: Forge of the Artificer (2025) and
 * Mordenkainen Presents: Monsters of the Multiverse (2022, playable with the 2024 rules), the 16 Player's
 * Handbook backgrounds and the origin feats they grant (the System Reference Document 5.2, CC-BY-4.0,
 * only covers part of it).
 * Names are given in English and Spanish; rules text is summarized, not reproduced.
 */
import type { AbilityKey } from "./rules";
import type { Effect } from "./effects";

export type Text = { en: string; es: string };

export type SkillKey =
  | "acrobatics" | "animalHandling" | "arcana" | "athletics" | "deception" | "history"
  | "insight" | "intimidation" | "investigation" | "medicine" | "nature" | "perception"
  | "performance" | "persuasion" | "religion" | "sleightOfHand" | "stealth" | "survival";

export const skills: Record<SkillKey, AbilityKey> = {
  acrobatics: "dex", animalHandling: "wis", arcana: "int", athletics: "str", deception: "cha",
  history: "int", insight: "wis", intimidation: "cha", investigation: "int", medicine: "wis",
  nature: "int", perception: "wis", performance: "cha", persuasion: "cha", religion: "int",
  sleightOfHand: "dex", stealth: "dex", survival: "wis",
};
export const skillKeys = Object.keys(skills) as SkillKey[];

/** Armor that the starting equipment can grant; used to compute Armor Class. */
export type ArmorKey = "leather" | "studdedLeather" | "chainShirt" | "chainMail";
export const armorTable: Record<ArmorKey, { base: number; dexCap: number | null; name: Text }> = {
  leather: { base: 11, dexCap: null, name: { en: "Leather Armor", es: "Armadura de cuero" } },
  studdedLeather: { base: 12, dexCap: null, name: { en: "Studded Leather Armor", es: "Armadura de cuero tachonado" } },
  chainShirt: { base: 13, dexCap: 2, name: { en: "Chain Shirt", es: "Camisote de mallas" } },
  chainMail: { base: 16, dexCap: 0, name: { en: "Chain Mail", es: "Cota de mallas" } },
};

/** Weapons the starting equipment can grant; used for the attack list on the character sheet. */
export type WeaponId =
  | "dagger" | "handaxe" | "javelin" | "quarterstaff" | "mace" | "sickle" | "spear" | "lightCrossbow" | "shortbow"
  | "greataxe" | "greatsword" | "longsword" | "flail" | "scimitar" | "shortsword" | "longbow";
export type WeaponProperty = "finesse" | "light";
export interface WeaponData { name: Text; dice: string; type: Text; martial?: boolean; properties: WeaponProperty[]; ranged?: boolean }
const piercing = { en: "piercing", es: "perforante" };
const slashing = { en: "slashing", es: "cortante" };
const bludgeoning = { en: "bludgeoning", es: "contundente" };
export const weaponTable: Record<WeaponId, WeaponData> = {
  dagger: { name: { en: "Dagger", es: "Daga" }, dice: "1d4", type: piercing, properties: ["finesse", "light"] },
  handaxe: { name: { en: "Handaxe", es: "Hacha de mano" }, dice: "1d6", type: slashing, properties: ["light"] },
  javelin: { name: { en: "Javelin", es: "Jabalina" }, dice: "1d6", type: piercing, properties: [] },
  quarterstaff: { name: { en: "Quarterstaff", es: "Bastón" }, dice: "1d6", type: bludgeoning, properties: [] },
  mace: { name: { en: "Mace", es: "Maza" }, dice: "1d6", type: bludgeoning, properties: [] },
  sickle: { name: { en: "Sickle", es: "Hoz" }, dice: "1d4", type: slashing, properties: ["light"] },
  spear: { name: { en: "Spear", es: "Lanza" }, dice: "1d6", type: piercing, properties: [] },
  lightCrossbow: { name: { en: "Light Crossbow", es: "Ballesta ligera" }, dice: "1d8", type: piercing, properties: [], ranged: true },
  shortbow: { name: { en: "Shortbow", es: "Arco corto" }, dice: "1d6", type: piercing, properties: [], ranged: true },
  greataxe: { name: { en: "Greataxe", es: "Gran hacha" }, dice: "1d12", type: slashing, martial: true, properties: [] },
  greatsword: { name: { en: "Greatsword", es: "Espadón" }, dice: "2d6", type: slashing, martial: true, properties: [] },
  longsword: { name: { en: "Longsword", es: "Espada larga" }, dice: "1d8", type: slashing, martial: true, properties: [] },
  flail: { name: { en: "Flail", es: "Mayal" }, dice: "1d8", type: bludgeoning, martial: true, properties: [] },
  scimitar: { name: { en: "Scimitar", es: "Cimitarra" }, dice: "1d6", type: slashing, martial: true, properties: ["finesse", "light"] },
  shortsword: { name: { en: "Shortsword", es: "Espada corta" }, dice: "1d6", type: piercing, martial: true, properties: ["finesse", "light"] },
  longbow: { name: { en: "Longbow", es: "Arco largo" }, dice: "1d8", type: piercing, martial: true, properties: [], ranged: true },
};

export interface EquipmentOption {
  id: "A" | "B" | "C";
  items: Text[];
  /** Weapons among `items`, by id. */
  weapons?: WeaponId[];
  gold: number;
  armor?: ArmorKey;
  shield?: boolean;
}

/** A class feature or species trait: its official name, our own one-line summary (not rules text) and the mechanics the app applies (see effects.ts). */
export interface Feature { name: Text; tip: Text; effects?: Effect[] }

export type ClassId =
  | "barbarian" | "bard" | "cleric" | "druid" | "fighter" | "monk"
  | "paladin" | "ranger" | "rogue" | "sorcerer" | "warlock" | "wizard";

export interface ClassData {
  id: ClassId;
  name: Text;
  hitDie: 6 | 8 | 10 | 12;
  primary: AbilityKey[];
  saves: [AbilityKey, AbilityKey];
  skillCount: number;
  /** Empty list means "any skill". */
  skillOptions: SkillKey[];
  armor: Text;
  weapons: Text;
  tools?: Text;
  spellcasting?: { ability: AbilityKey; cantrips: number; prepared: number; slots: Text };
  weaponMasteries?: number;
  /** Rogues gain Expertise in two skills at level 1. */
  expertiseAtLevel1?: number;
  features: Feature[];
  subclass: Text;
  equipment: EquipmentOption[];
  summary: Text;
}

const t = (en: string, es: string): Text => ({ en, es });
export const feature = (en: string, es: string, tipEn: string, tipEs: string, effects?: Effect[]): Feature =>
  ({ name: t(en, es), tip: t(tipEn, tipEs), ...(effects ? { effects } : {}) });
const f = feature;
const gp = (amount: number) => t(`${amount} GP`, `${amount} po`);
const fullCasterSlots = t("2 level 1 slots", "2 espacios de nivel 1");

export const classes: ClassData[] = [
  {
    id: "barbarian", name: t("Barbarian", "Bárbaro"), hitDie: 12, primary: ["str"], saves: ["str", "con"],
    skillCount: 2, skillOptions: ["animalHandling", "athletics", "intimidation", "nature", "perception", "survival"],
    armor: t("Light and Medium armor, Shields", "Armadura ligera y media, escudos"),
    weapons: t("Simple and Martial weapons", "Armas sencillas y marciales"), weaponMasteries: 2,
    features: [
      f("Rage", "Furia", "Bonus action: extra damage with Strength attacks, resistance to bludgeoning, piercing and slashing damage, and advantage on Strength checks and saves. No spellcasting while raging.", "Acción adicional: daño extra con ataques de Fuerza, resistencia al daño contundente, perforante y cortante, y ventaja en pruebas y salvaciones de Fuerza. No puedes lanzar conjuros en furia."),
      f("Unarmored Defense", "Defensa sin armadura", "Without armor, your AC is 10 + Dexterity + Constitution modifiers; a shield still adds its bonus.", "Sin armadura, tu CA es 10 + modificadores de Destreza y Constitución; el escudo sigue sumando.",
        [{ kind: "unarmoredDefense", add: ["con"] }]),
      f("Weapon Mastery", "Maestría con armas", "Use the mastery properties (like Cleave or Topple) of a few kinds of Simple or Martial melee weapons; swap one after a Long Rest.", "Usas las propiedades de maestría (como Hendir o Derribar) de algunos tipos de armas cuerpo a cuerpo sencillas o marciales; puedes cambiar una tras un descanso largo."),
    ],
    subclass: t("Path of the Berserker", "Senda del berserker"),
    summary: t("A fierce warrior fueled by primal rage.", "Un guerrero feroz impulsado por una furia primigenia."),
    equipment: [
      { id: "A", items: [t("Greataxe", "Gran hacha"), t("4 Handaxes", "4 hachas de mano"), t("Explorer's Pack", "Equipo de explorador"), gp(15)], weapons: ["greataxe", "handaxe"], gold: 15 },
      { id: "B", items: [gp(75)], gold: 75 },
    ],
  },
  {
    id: "bard", name: t("Bard", "Bardo"), hitDie: 8, primary: ["cha"], saves: ["dex", "cha"],
    skillCount: 3, skillOptions: [],
    armor: t("Light armor", "Armadura ligera"), weapons: t("Simple weapons", "Armas sencillas"),
    tools: t("Three Musical Instruments", "Tres instrumentos musicales"),
    spellcasting: { ability: "cha", cantrips: 2, prepared: 4, slots: fullCasterSlots },
    features: [
      f("Bardic Inspiration", "Inspiración bárdica", "Bonus action: give an ally within 60 feet a d6 to add to a d20 test they fail. Uses equal to your Charisma modifier per Long Rest.", "Acción adicional: das a un aliado a 60 pies un d6 para sumar a una prueba de d20 que falle. Tantos usos como tu modificador de Carisma por descanso largo."),
      f("Spellcasting", "Lanzamiento de conjuros", "Cast bard spells with Charisma, using a musical instrument as focus; your spell slots come back after a Long Rest.", "Lanzas conjuros de bardo con Carisma, usando un instrumento musical como canalizador; recuperas los espacios de conjuro tras un descanso largo."),
    ],
    subclass: t("College of Lore", "Colegio del Saber"),
    summary: t("An inspiring performer whose words and music weave magic.", "Un artista inspirador cuya música y palabras tejen magia."),
    equipment: [
      { id: "A", items: [t("Leather Armor", "Armadura de cuero"), t("2 Daggers", "2 dagas"), t("Musical Instrument", "Instrumento musical"), t("Entertainer's Pack", "Equipo de artista"), gp(19)], weapons: ["dagger"], gold: 19, armor: "leather" },
      { id: "B", items: [gp(90)], gold: 90 },
    ],
  },
  {
    id: "cleric", name: t("Cleric", "Clérigo"), hitDie: 8, primary: ["wis"], saves: ["wis", "cha"],
    skillCount: 2, skillOptions: ["history", "insight", "medicine", "persuasion", "religion"],
    armor: t("Light and Medium armor, Shields", "Armadura ligera y media, escudos"), weapons: t("Simple weapons", "Armas sencillas"),
    spellcasting: { ability: "wis", cantrips: 3, prepared: 4, slots: fullCasterSlots },
    features: [
      f("Spellcasting", "Lanzamiento de conjuros", "Cast cleric spells with Wisdom, using a holy symbol as focus; your spell slots come back after a Long Rest.", "Lanzas conjuros de clérigo con Sabiduría, usando un símbolo sagrado como canalizador; recuperas los espacios de conjuro tras un descanso largo."),
      f("Divine Order", "Orden divina", "Choose Protector (Heavy armor and Martial weapons) or Thaumaturge (an extra cantrip and your Wisdom bonus on Arcana and Religion checks).", "Eliges Protector (armadura pesada y armas marciales) o Taumaturgo (un truco más y tu bonificador de Sabiduría en pruebas de Arcanos y Religión)."),
    ],
    subclass: t("Life Domain", "Dominio de la Vida"),
    summary: t("A priestly champion who wields divine magic.", "Un campeón sacerdotal que empuña magia divina."),
    equipment: [
      { id: "A", items: [t("Chain Shirt", "Camisote de mallas"), t("Shield", "Escudo"), t("Mace", "Maza"), t("Holy Symbol", "Símbolo sagrado"), t("Priest's Pack", "Equipo de sacerdote"), gp(7)], weapons: ["mace"], gold: 7, armor: "chainShirt", shield: true },
      { id: "B", items: [gp(110)], gold: 110 },
    ],
  },
  {
    id: "druid", name: t("Druid", "Druida"), hitDie: 8, primary: ["wis"], saves: ["int", "wis"],
    skillCount: 2, skillOptions: ["arcana", "animalHandling", "insight", "medicine", "nature", "perception", "religion", "survival"],
    armor: t("Light armor, Shields", "Armadura ligera, escudos"), weapons: t("Simple weapons", "Armas sencillas"),
    tools: t("Herbalism Kit", "Útiles de herborista"),
    spellcasting: { ability: "wis", cantrips: 2, prepared: 4, slots: fullCasterSlots },
    features: [
      f("Spellcasting", "Lanzamiento de conjuros", "Cast druid spells with Wisdom, using a druidic focus; your spell slots come back after a Long Rest.", "Lanzas conjuros de druida con Sabiduría, usando un canalizador druídico; recuperas los espacios de conjuro tras un descanso largo."),
      f("Druidic", "Druídico", "You know the secret language of druids and always have Speak with Animals prepared.", "Conoces el idioma secreto de los druidas y siempre tienes preparado Hablar con los animales."),
      f("Primal Order", "Orden primordial", "Choose Magician (an extra cantrip and your Wisdom bonus on Arcana and Nature checks) or Warden (Martial weapons and Medium armor).", "Eliges Mago (un truco más y tu bonificador de Sabiduría en pruebas de Arcanos y Naturaleza) o Guardián (armas marciales y armadura media)."),
    ],
    subclass: t("Circle of the Land", "Círculo de la Tierra"),
    summary: t("A priest of the old faith wielding the powers of nature.", "Sacerdote de la fe antigua que domina los poderes de la naturaleza."),
    equipment: [
      { id: "A", items: [t("Leather Armor", "Armadura de cuero"), t("Shield", "Escudo"), t("Sickle", "Hoz"), t("Druidic Focus (Quarterstaff)", "Canalizador druídico (bastón)"), t("Explorer's Pack", "Equipo de explorador"), t("Herbalism Kit", "Útiles de herborista"), gp(9)], weapons: ["sickle", "quarterstaff"], gold: 9, armor: "leather", shield: true },
      { id: "B", items: [gp(50)], gold: 50 },
    ],
  },
  {
    id: "fighter", name: t("Fighter", "Guerrero"), hitDie: 10, primary: ["str", "dex"], saves: ["str", "con"],
    skillCount: 2, skillOptions: ["acrobatics", "animalHandling", "athletics", "history", "insight", "intimidation", "persuasion", "perception", "survival"],
    armor: t("Light, Medium and Heavy armor, Shields", "Armadura ligera, media y pesada, escudos"),
    weapons: t("Simple and Martial weapons", "Armas sencillas y marciales"), weaponMasteries: 3,
    features: [
      f("Fighting Style", "Estilo de combate", "Gain a Fighting Style feat of your choice, such as Archery or Defense.", "Ganas una dote de estilo de combate a tu elección, como Arquería o Defensa."),
      f("Second Wind", "Tomar aliento", "Bonus action: regain 1d10 + your Fighter level in hit points. Two uses; one returns on a Short Rest, all on a Long Rest.", "Acción adicional: recuperas 1d10 + tu nivel de guerrero en puntos de golpe. Dos usos; recuperas uno con un descanso corto y todos con uno largo."),
      f("Weapon Mastery", "Maestría con armas", "Use the mastery properties (like Cleave or Topple) of a few weapon kinds you are trained with; swap one after a Long Rest.", "Usas las propiedades de maestría (como Hendir o Derribar) de algunos tipos de armas que dominas; puedes cambiar una tras un descanso largo."),
    ],
    subclass: t("Champion", "Campeón"),
    summary: t("A master of martial combat, skilled with many weapons and armor.", "Maestro del combate marcial, diestro con armas y armaduras."),
    equipment: [
      { id: "A", items: [t("Chain Mail", "Cota de mallas"), t("Greatsword", "Espadón"), t("Flail", "Mayal"), t("8 Javelins", "8 jabalinas"), t("Dungeoneer's Pack", "Equipo de explorador de mazmorras"), gp(4)], weapons: ["greatsword", "flail", "javelin"], gold: 4, armor: "chainMail" },
      { id: "B", items: [t("Studded Leather Armor", "Armadura de cuero tachonado"), t("Scimitar", "Cimitarra"), t("Shortsword", "Espada corta"), t("Longbow", "Arco largo"), t("20 Arrows", "20 flechas"), t("Quiver", "Carcaj"), t("Dungeoneer's Pack", "Equipo de explorador de mazmorras"), gp(11)], weapons: ["scimitar", "shortsword", "longbow"], gold: 11, armor: "studdedLeather" },
      { id: "C", items: [gp(155)], gold: 155 },
    ],
  },
  {
    id: "monk", name: t("Monk", "Monje"), hitDie: 8, primary: ["dex", "wis"], saves: ["str", "dex"],
    skillCount: 2, skillOptions: ["acrobatics", "athletics", "history", "insight", "religion", "stealth"],
    armor: t("None", "Ninguna"), weapons: t("Simple weapons and Martial weapons with the Light property", "Armas sencillas y marciales con la propiedad Ligera"),
    tools: t("One Artisan's Tools or Musical Instrument", "Unas herramientas de artesano o un instrumento musical"),
    features: [
      f("Martial Arts", "Artes marciales", "Unarmed strikes and Monk weapons can use Dexterity and deal your Martial Arts die (d6), and you can make an unarmed strike as a bonus action.", "Tus golpes sin armas y armas de monje pueden usar Destreza y hacer tu dado de artes marciales (d6), y puedes dar un golpe sin armas como acción adicional."),
      f("Unarmored Defense", "Defensa sin armadura", "Without armor or a shield, your AC is 10 + Dexterity + Wisdom modifiers.", "Sin armadura ni escudo, tu CA es 10 + modificadores de Destreza y Sabiduría.",
        [{ kind: "unarmoredDefense", add: ["wis"] }]),
    ],
    subclass: t("Warrior of the Open Hand", "Guerrero de la Mano Abierta"),
    summary: t("A martial artist who channels inner power through body and mind.", "Un artista marcial que canaliza su poder interior."),
    equipment: [
      { id: "A", items: [t("Spear", "Lanza"), t("5 Daggers", "5 dagas"), t("Artisan's Tools or Musical Instrument", "Herramientas de artesano o instrumento musical"), t("Explorer's Pack", "Equipo de explorador"), gp(11)], weapons: ["spear", "dagger"], gold: 11 },
      { id: "B", items: [gp(50)], gold: 50 },
    ],
  },
  {
    id: "paladin", name: t("Paladin", "Paladín"), hitDie: 10, primary: ["str", "cha"], saves: ["wis", "cha"],
    skillCount: 2, skillOptions: ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"],
    armor: t("Light, Medium and Heavy armor, Shields", "Armadura ligera, media y pesada, escudos"),
    weapons: t("Simple and Martial weapons", "Armas sencillas y marciales"), weaponMasteries: 2,
    spellcasting: { ability: "cha", cantrips: 0, prepared: 2, slots: t("2 level 1 slots", "2 espacios de nivel 1") },
    features: [
      f("Lay On Hands", "Imposición de manos", "A pool of healing equal to 5 × your Paladin level. Bonus action: touch a creature to restore hit points, or spend 5 to remove the Poisoned condition. Refills on a Long Rest.", "Una reserva de curación igual a 5 × tu nivel de paladín. Acción adicional: tocas a una criatura para curarla, o gastas 5 para quitarle el estado envenenado. Se recupera con un descanso largo."),
      f("Spellcasting", "Lanzamiento de conjuros", "Cast paladin spells with Charisma, using a holy symbol as focus; your spell slots come back after a Long Rest.", "Lanzas conjuros de paladín con Carisma, usando un símbolo sagrado como canalizador; recuperas los espacios de conjuro tras un descanso largo."),
      f("Weapon Mastery", "Maestría con armas", "Use the mastery properties (like Cleave or Topple) of a few weapon kinds you are trained with; swap one after a Long Rest.", "Usas las propiedades de maestría (como Hendir o Derribar) de algunos tipos de armas que dominas; puedes cambiar una tras un descanso largo."),
    ],
    subclass: t("Oath of Devotion", "Juramento de Devoción"),
    summary: t("A holy warrior bound to a sacred oath.", "Un guerrero sagrado ligado a un juramento."),
    equipment: [
      { id: "A", items: [t("Chain Mail", "Cota de mallas"), t("Shield", "Escudo"), t("Longsword", "Espada larga"), t("6 Javelins", "6 jabalinas"), t("Holy Symbol", "Símbolo sagrado"), t("Priest's Pack", "Equipo de sacerdote"), gp(9)], weapons: ["longsword", "javelin"], gold: 9, armor: "chainMail", shield: true },
      { id: "B", items: [gp(150)], gold: 150 },
    ],
  },
  {
    id: "ranger", name: t("Ranger", "Explorador"), hitDie: 10, primary: ["dex", "wis"], saves: ["str", "dex"],
    skillCount: 3, skillOptions: ["animalHandling", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"],
    armor: t("Light and Medium armor, Shields", "Armadura ligera y media, escudos"),
    weapons: t("Simple and Martial weapons", "Armas sencillas y marciales"), weaponMasteries: 2,
    spellcasting: { ability: "wis", cantrips: 0, prepared: 2, slots: t("2 level 1 slots", "2 espacios de nivel 1") },
    features: [
      f("Spellcasting", "Lanzamiento de conjuros", "Cast ranger spells with Wisdom, using a druidic focus; your spell slots come back after a Long Rest.", "Lanzas conjuros de explorador con Sabiduría, usando un canalizador druídico; recuperas los espacios de conjuro tras un descanso largo."),
      f("Favored Enemy", "Enemigo predilecto", "You always have Hunter's Mark prepared and can cast it twice per Long Rest without a spell slot.", "Siempre tienes preparado Marca del cazador y puedes lanzarlo dos veces por descanso largo sin gastar espacio."),
      f("Weapon Mastery", "Maestría con armas", "Use the mastery properties (like Cleave or Topple) of a few weapon kinds you are trained with; swap one after a Long Rest.", "Usas las propiedades de maestría (como Hendir o Derribar) de algunos tipos de armas que dominas; puedes cambiar una tras un descanso largo."),
    ],
    subclass: t("Hunter", "Cazador"),
    summary: t("A wandering warrior imbued with primal magic.", "Un guerrero errante imbuido de magia primigenia."),
    equipment: [
      { id: "A", items: [t("Studded Leather Armor", "Armadura de cuero tachonado"), t("Scimitar", "Cimitarra"), t("Shortsword", "Espada corta"), t("Longbow", "Arco largo"), t("20 Arrows", "20 flechas"), t("Quiver", "Carcaj"), t("Druidic Focus (sprig of mistletoe)", "Canalizador druídico (ramita de muérdago)"), t("Explorer's Pack", "Equipo de explorador"), gp(7)], weapons: ["scimitar", "shortsword", "longbow"], gold: 7, armor: "studdedLeather" },
      { id: "B", items: [gp(150)], gold: 150 },
    ],
  },
  {
    id: "rogue", name: t("Rogue", "Pícaro"), hitDie: 8, primary: ["dex"], saves: ["dex", "int"],
    skillCount: 4, skillOptions: ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "persuasion", "sleightOfHand", "stealth"],
    armor: t("Light armor", "Armadura ligera"),
    weapons: t("Simple weapons and Martial weapons with the Finesse or Light property", "Armas sencillas y marciales con la propiedad Sutil o Ligera"),
    tools: t("Thieves' Tools", "Herramientas de ladrón"), weaponMasteries: 2, expertiseAtLevel1: 2,
    features: [
      f("Expertise", "Pericia", "Double your proficiency bonus in two skills you are proficient in.", "Duplicas tu bonificador por competencia en dos habilidades que domines."),
      f("Sneak Attack", "Ataque furtivo", "Once per turn, deal an extra 1d6 damage with a Finesse or ranged weapon if you have advantage or an ally is next to the target.", "Una vez por turno, haces 1d6 de daño extra con un arma sutil o a distancia si tienes ventaja o un aliado está junto al objetivo."),
      f("Thieves' Cant", "Jerga de ladrones", "You know the secret mix of jargon and signs rogues use, plus one more language of your choice.", "Conoces la mezcla secreta de jerga y señas de los pícaros, y un idioma más a tu elección."),
      f("Weapon Mastery", "Maestría con armas", "Use the mastery properties (like Cleave or Topple) of a few weapon kinds you are trained with; swap one after a Long Rest.", "Usas las propiedades de maestría (como Hendir o Derribar) de algunos tipos de armas que dominas; puedes cambiar una tras un descanso largo."),
    ],
    subclass: t("Thief", "Ladrón"),
    summary: t("A dexterous expert in stealth and subterfuge.", "Experto diestro en sigilo y subterfugio."),
    equipment: [
      { id: "A", items: [t("Leather Armor", "Armadura de cuero"), t("2 Daggers", "2 dagas"), t("Shortsword", "Espada corta"), t("Shortbow", "Arco corto"), t("20 Arrows", "20 flechas"), t("Quiver", "Carcaj"), t("Thieves' Tools", "Herramientas de ladrón"), t("Burglar's Pack", "Equipo de ladrón"), gp(8)], weapons: ["dagger", "shortsword", "shortbow"], gold: 8, armor: "leather" },
      { id: "B", items: [gp(100)], gold: 100 },
    ],
  },
  {
    id: "sorcerer", name: t("Sorcerer", "Hechicero"), hitDie: 6, primary: ["cha"], saves: ["con", "cha"],
    skillCount: 2, skillOptions: ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"],
    armor: t("None", "Ninguna"), weapons: t("Simple weapons", "Armas sencillas"),
    spellcasting: { ability: "cha", cantrips: 4, prepared: 2, slots: fullCasterSlots },
    features: [
      f("Spellcasting", "Lanzamiento de conjuros", "Cast sorcerer spells with Charisma, using an arcane focus; your spell slots come back after a Long Rest.", "Lanzas conjuros de hechicero con Carisma, usando un canalizador arcano; recuperas los espacios de conjuro tras un descanso largo."),
      f("Innate Sorcery", "Hechicería innata", "Bonus action: for 1 minute, +1 to your spell save DC and advantage on Sorcerer spell attacks. Twice per Long Rest.", "Acción adicional: durante 1 minuto, +1 a la CD de tus conjuros y ventaja en los ataques de conjuro de hechicero. Dos veces por descanso largo."),
    ],
    subclass: t("Draconic Sorcery", "Hechicería dracónica"),
    summary: t("A spellcaster whose magic flows from an innate source.", "Un lanzador cuya magia brota de un origen innato."),
    equipment: [
      { id: "A", items: [t("Spear", "Lanza"), t("2 Daggers", "2 dagas"), t("Arcane Focus (crystal)", "Canalizador arcano (cristal)"), t("Dungeoneer's Pack", "Equipo de explorador de mazmorras"), gp(28)], weapons: ["spear", "dagger"], gold: 28 },
      { id: "B", items: [gp(50)], gold: 50 },
    ],
  },
  {
    id: "warlock", name: t("Warlock", "Brujo"), hitDie: 8, primary: ["cha"], saves: ["wis", "cha"],
    skillCount: 2, skillOptions: ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"],
    armor: t("Light armor", "Armadura ligera"), weapons: t("Simple weapons", "Armas sencillas"),
    spellcasting: { ability: "cha", cantrips: 2, prepared: 2, slots: t("1 Pact Magic slot (level 1)", "1 espacio de Magia del pacto (nivel 1)") },
    features: [
      f("Eldritch Invocations", "Invocaciones sobrenaturales", "Pick an invocation, such as Pact of the Blade or Armor of Shadows, that grants a new power; you learn more as you level.", "Eliges una invocación, como Pacto del filo o Armadura de sombras, que te da un poder nuevo; aprendes más al subir de nivel."),
      f("Pact Magic", "Magia del pacto", "Cast warlock spells with Charisma; your few spell slots are always your highest level and come back after a Short Rest.", "Lanzas conjuros de brujo con Carisma; tus pocos espacios siempre son del nivel más alto y se recuperan con un descanso corto."),
    ],
    subclass: t("Fiend Patron", "Patrón Infernal"),
    summary: t("An occultist whose power comes from a pact with an otherworldly being.", "Un ocultista cuyo poder nace de un pacto con un ser de otro mundo."),
    equipment: [
      { id: "A", items: [t("Leather Armor", "Armadura de cuero"), t("Sickle", "Hoz"), t("2 Daggers", "2 dagas"), t("Arcane Focus (orb)", "Canalizador arcano (orbe)"), t("Book (occult lore)", "Libro (saber oculto)"), t("Scholar's Pack", "Equipo de erudito"), gp(15)], weapons: ["sickle", "dagger"], gold: 15, armor: "leather" },
      { id: "B", items: [gp(100)], gold: 100 },
    ],
  },
  {
    id: "wizard", name: t("Wizard", "Mago"), hitDie: 6, primary: ["int"], saves: ["int", "wis"],
    skillCount: 2, skillOptions: ["arcana", "history", "insight", "investigation", "medicine", "nature", "religion"],
    armor: t("None", "Ninguna"), weapons: t("Simple weapons", "Armas sencillas"),
    spellcasting: { ability: "int", cantrips: 3, prepared: 4, slots: fullCasterSlots },
    features: [
      f("Spellcasting", "Lanzamiento de conjuros", "Cast wizard spells with Intelligence from your spellbook; your spell slots come back after a Long Rest.", "Lanzas conjuros de mago con Inteligencia desde tu libro de conjuros; recuperas los espacios de conjuro tras un descanso largo."),
      f("Ritual Adept", "Adepto de rituales", "Cast any Ritual spell in your spellbook as a ritual without having it prepared.", "Lanzas como ritual cualquier conjuro con la etiqueta Ritual de tu libro, aunque no lo tengas preparado."),
      f("Arcane Recovery", "Recuperación arcana", "Once per day after a Short Rest, regain spell slots whose levels add up to half your Wizard level (rounded up).", "Una vez al día tras un descanso corto, recuperas espacios de conjuro cuyos niveles sumen la mitad de tu nivel de mago (redondeando hacia arriba)."),
    ],
    subclass: t("Evoker", "Evocador"),
    summary: t("A scholarly magic-user who studies the arcane.", "Un estudioso de la magia que domina lo arcano."),
    equipment: [
      { id: "A", items: [t("2 Daggers", "2 dagas"), t("Arcane Focus (Quarterstaff)", "Canalizador arcano (bastón)"), t("Robe", "Túnica"), t("Spellbook", "Libro de conjuros"), t("Scholar's Pack", "Equipo de erudito"), gp(5)], weapons: ["dagger", "quarterstaff"], gold: 5 },
      { id: "B", items: [gp(55)], gold: 55 },
    ],
  },
];

export type FeatId =
  | "alert" | "crafter" | "healer" | "lucky" | "magicInitiate" | "musician" | "savageAttacker" | "skilled" | "tavernBrawler" | "tough";
export const originFeats: Record<FeatId, { name: Text; summary: Text; effects?: Effect[] }> = {
  alert: { name: t("Alert", "Alerta"), summary: t("Add your Proficiency Bonus to Initiative and swap Initiative with a willing ally.", "Suma tu bonificador por competencia a la iniciativa y puedes intercambiarla con un aliado."),
    effects: [{ kind: "initiativeBonus", add: "proficiency" }] },
  crafter: { name: t("Crafter", "Artesano"), summary: t("Proficiency with three Artisan's Tools, a discount on nonmagical items and fast crafting.", "Competencia con tres herramientas de artesano, descuento en objetos no mágicos y fabricación rápida.") },
  healer: { name: t("Healer", "Sanador"), summary: t("Use a Healer's Kit to restore Hit Points to an ally and reroll low healing dice.", "Usa un botiquín de sanador para curar a un aliado y repite los dados de curación bajos.") },
  lucky: { name: t("Lucky", "Afortunado"), summary: t("Luck Points equal to your Proficiency Bonus to gain Advantage or turn an attack against you into a Disadvantage.", "Puntos de suerte igual a tu bonificador por competencia para obtener ventaja o imponer desventaja a un ataque contra ti.") },
  magicInitiate: { name: t("Magic Initiate", "Iniciado en la magia"), summary: t("Learn two cantrips and one level 1 spell from the Cleric, Druid or Wizard list.", "Aprende dos trucos y un conjuro de nivel 1 de la lista de clérigo, druida o mago.") },
  musician: { name: t("Musician", "Músico"), summary: t("Proficiency with three Musical Instruments and a song that grants Heroic Inspiration to allies.", "Competencia con tres instrumentos musicales y una canción que otorga inspiración heroica a tus aliados.") },
  savageAttacker: { name: t("Savage Attacker", "Atacante salvaje"), summary: t("Once per turn, roll weapon damage dice twice and use either roll.", "Una vez por turno, tira dos veces los dados de daño de un arma y elige el resultado.") },
  skilled: { name: t("Skilled", "Habilidoso"), summary: t("Gain proficiency in any combination of three skills or tools.", "Obtienes competencia en tres habilidades o herramientas a tu elección.") },
  tavernBrawler: { name: t("Tavern Brawler", "Pendenciero"), summary: t("Stronger Unarmed Strikes, reroll 1s on their damage and shove after a hit.", "Golpes sin armas más fuertes, repites los 1 en su daño y empujas tras un impacto.") },
  tough: { name: t("Tough", "Duro"), summary: t("Your Hit Point maximum increases by twice your level.", "Tus puntos de golpe máximos aumentan el doble de tu nivel."),
    effects: [{ kind: "hpPerLevel", amount: 2 }] },
};
export const magicInitiateLists = { cleric: t("Cleric", "Clérigo"), druid: t("Druid", "Druida"), wizard: t("Wizard", "Mago") } as const;
export type MagicInitiateList = keyof typeof magicInitiateLists;

export type BackgroundId =
  | "acolyte" | "artisan" | "charlatan" | "criminal" | "entertainer" | "farmer" | "guard" | "guide"
  | "hermit" | "merchant" | "noble" | "sage" | "sailor" | "scribe" | "soldier" | "wayfarer";
export interface BackgroundData {
  id: BackgroundId;
  name: Text;
  abilities: [AbilityKey, AbilityKey, AbilityKey];
  feat: FeatId;
  featList?: MagicInitiateList;
  skills: [SkillKey, SkillKey];
  tool: Text;
  equipment: EquipmentOption[];
  summary: Text;
}

const bgB: EquipmentOption = { id: "B", items: [gp(50)], gold: 50 };
const clothes = t("Traveler's Clothes", "Ropa de viaje");
const pouches = t("2 Pouches", "2 bolsas");
const lamp = t("Lamp", "Lámpara");
const oil = t("Oil (3 flasks)", "Aceite (3 frascos)");
const bedroll = t("Bedroll", "Saco de dormir");
const fineClothes = t("Fine Clothes", "Ropa fina");
const quiver = t("Quiver", "Carcaj");
const arrows = t("20 Arrows", "20 flechas");
const tools = {
  calligrapher: t("Calligrapher's Supplies", "Útiles de calígrafo"),
  thieves: t("Thieves' Tools", "Herramientas de ladrón"),
  gaming: t("One Gaming Set", "Un juego"),
  navigator: t("Navigator's Tools", "Herramientas de navegante"),
};
const gamingSet = t("Gaming Set", "Juego");
const dagger = t("Dagger", "Daga");
const daggers2 = t("2 Daggers", "2 dagas");
const spear = t("Spear", "Lanza");
const healersKit = t("Healer's Kit", "Útiles de sanador");

export const backgrounds: BackgroundData[] = [
  {
    id: "acolyte", name: t("Acolyte", "Acólito"), abilities: ["int", "wis", "cha"], feat: "magicInitiate", featList: "cleric",
    skills: ["insight", "religion"], tool: tools.calligrapher,
    summary: t("You devoted yourself to service in a temple.", "Te consagraste al servicio de un templo."),
    equipment: [
      { id: "A", items: [tools.calligrapher, t("Book (prayers)", "Libro (oraciones)"), t("Holy Symbol", "Símbolo sagrado"), t("Parchment (10 sheets)", "Pergamino (10 hojas)"), t("Robe", "Túnica"), gp(8)], gold: 8 }, bgB,
    ],
  },
  {
    id: "artisan", name: t("Artisan", "Artesano"), abilities: ["str", "dex", "int"], feat: "crafter",
    skills: ["investigation", "persuasion"], tool: t("One Artisan's Tools", "Unas herramientas de artesano"),
    summary: t("You learned a trade as an apprentice and sold your wares.", "Aprendiste un oficio como aprendiz y vendiste tus obras."),
    equipment: [
      { id: "A", items: [t("Artisan's Tools", "Herramientas de artesano"), pouches, clothes, gp(32)], gold: 32 }, bgB,
    ],
  },
  {
    id: "charlatan", name: t("Charlatan", "Charlatán"), abilities: ["dex", "con", "cha"], feat: "skilled",
    skills: ["deception", "sleightOfHand"], tool: t("Forgery Kit", "Kit de falsificación"),
    summary: t("You learned to read people and sell them what they wanted to believe.", "Aprendiste a leer a la gente y a venderle lo que quería creer."),
    equipment: [
      { id: "A", items: [t("Forgery Kit", "Kit de falsificación"), t("Costume", "Disfraz"), fineClothes, gp(15)], gold: 15 }, bgB,
    ],
  },
  {
    id: "criminal", name: t("Criminal", "Criminal"), abilities: ["dex", "con", "int"], feat: "alert",
    skills: ["sleightOfHand", "stealth"], tool: tools.thieves,
    summary: t("You eked out a living in dark alleyways.", "Te ganaste la vida en callejones oscuros."),
    equipment: [
      { id: "A", items: [daggers2, tools.thieves, t("Crowbar", "Palanca"), pouches, clothes, gp(16)], weapons: ["dagger"], gold: 16 }, bgB,
    ],
  },
  {
    id: "entertainer", name: t("Entertainer", "Artista"), abilities: ["str", "dex", "cha"], feat: "musician",
    skills: ["acrobatics", "performance"], tool: t("One Musical Instrument", "Un instrumento musical"),
    summary: t("You thrived in front of an audience, honing your act.", "Floreciste ante el público perfeccionando tu número."),
    equipment: [
      { id: "A", items: [t("Musical Instrument", "Instrumento musical"), t("2 Costumes", "2 disfraces"), t("Mirror", "Espejo"), t("Perfume", "Perfume"), clothes, gp(11)], gold: 11 }, bgB,
    ],
  },
  {
    id: "farmer", name: t("Farmer", "Granjero"), abilities: ["str", "con", "wis"], feat: "tough",
    skills: ["animalHandling", "nature"], tool: t("Carpenter's Tools", "Herramientas de carpintero"),
    summary: t("You grew strong working the land and tending animals.", "Te hiciste fuerte trabajando la tierra y cuidando animales."),
    equipment: [
      { id: "A", items: [t("Sickle", "Hoz"), t("Carpenter's Tools", "Herramientas de carpintero"), healersKit, t("Iron Pot", "Olla de hierro"), t("Shovel", "Pala"), clothes, gp(30)], weapons: ["sickle"], gold: 30 }, bgB,
    ],
  },
  {
    id: "guard", name: t("Guard", "Guardia"), abilities: ["str", "int", "wis"], feat: "alert",
    skills: ["athletics", "perception"], tool: tools.gaming,
    summary: t("You kept watch over a gate, a wall or a caravan.", "Vigilaste una puerta, una muralla o una caravana."),
    equipment: [
      { id: "A", items: [spear, t("Light Crossbow", "Ballesta ligera"), t("20 Bolts", "20 virotes"), gamingSet, t("Hooded Lantern", "Linterna sorda"), t("Manacles", "Grilletes"), quiver, clothes, gp(12)], weapons: ["lightCrossbow", "spear"], gold: 12 }, bgB,
    ],
  },
  {
    id: "guide", name: t("Guide", "Guía"), abilities: ["dex", "con", "wis"], feat: "magicInitiate", featList: "druid",
    skills: ["stealth", "survival"], tool: t("Cartographer's Tools", "Herramientas de cartógrafo"),
    summary: t("You learned the wilds and led others through them.", "Aprendiste los parajes salvajes y guiaste a otros por ellos."),
    equipment: [
      { id: "A", items: [t("Shortbow", "Arco corto"), arrows, t("Cartographer's Tools", "Herramientas de cartógrafo"), bedroll, quiver, t("Tent", "Tienda de campaña"), clothes, gp(3)], weapons: ["shortbow"], gold: 3 }, bgB,
    ],
  },
  {
    id: "hermit", name: t("Hermit", "Ermitaño"), abilities: ["con", "wis", "cha"], feat: "healer",
    skills: ["medicine", "religion"], tool: t("Herbalism Kit", "Útiles de herborista"),
    summary: t("You lived in seclusion, in search of peace or insight.", "Viviste aislado en busca de paz o de revelaciones."),
    equipment: [
      { id: "A", items: [t("Quarterstaff", "Bastón"), t("Herbalism Kit", "Útiles de herborista"), bedroll, t("Book (philosophy)", "Libro (filosofía)"), lamp, oil, clothes, gp(16)], weapons: ["quarterstaff"], gold: 16 }, bgB,
    ],
  },
  {
    id: "merchant", name: t("Merchant", "Mercader"), abilities: ["con", "int", "cha"], feat: "lucky",
    skills: ["animalHandling", "persuasion"], tool: tools.navigator,
    summary: t("You apprenticed with traders and learned to haggle.", "Fuiste aprendiz de comerciantes y aprendiste a regatear."),
    equipment: [
      { id: "A", items: [tools.navigator, pouches, clothes, gp(22)], gold: 22 }, bgB,
    ],
  },
  {
    id: "noble", name: t("Noble", "Noble"), abilities: ["str", "int", "cha"], feat: "skilled",
    skills: ["history", "persuasion"], tool: tools.gaming,
    summary: t("You grew up in wealth, privilege and expectation.", "Creciste entre riquezas, privilegios y expectativas."),
    equipment: [
      { id: "A", items: [gamingSet, fineClothes, t("Perfume", "Perfume"), gp(29)], gold: 29 }, bgB,
    ],
  },
  {
    id: "sage", name: t("Sage", "Sabio"), abilities: ["con", "int", "wis"], feat: "magicInitiate", featList: "wizard",
    skills: ["arcana", "history"], tool: tools.calligrapher,
    summary: t("You spent your formative years among manuscripts.", "Pasaste tus años de formación entre manuscritos."),
    equipment: [
      { id: "A", items: [t("Quarterstaff", "Bastón"), tools.calligrapher, t("Book (history)", "Libro (historia)"), t("Parchment (8 sheets)", "Pergamino (8 hojas)"), t("Robe", "Túnica"), gp(8)], weapons: ["quarterstaff"], gold: 8 }, bgB,
    ],
  },
  {
    id: "sailor", name: t("Sailor", "Marinero"), abilities: ["str", "dex", "wis"], feat: "tavernBrawler",
    skills: ["acrobatics", "perception"], tool: tools.navigator,
    summary: t("You lived aboard a ship, braving the sea and its ports.", "Viviste a bordo de un barco, desafiando el mar y sus puertos."),
    equipment: [
      { id: "A", items: [dagger, tools.navigator, t("Rope", "Cuerda"), clothes, gp(20)], weapons: ["dagger"], gold: 20 }, bgB,
    ],
  },
  {
    id: "scribe", name: t("Scribe", "Escriba"), abilities: ["dex", "int", "wis"], feat: "skilled",
    skills: ["investigation", "perception"], tool: tools.calligrapher,
    summary: t("You copied documents with precision and an eye for detail.", "Copiaste documentos con precisión y buen ojo para el detalle."),
    equipment: [
      { id: "A", items: [tools.calligrapher, fineClothes, lamp, oil, t("Parchment (12 sheets)", "Pergamino (12 hojas)"), gp(23)], gold: 23 }, bgB,
    ],
  },
  {
    id: "soldier", name: t("Soldier", "Soldado"), abilities: ["str", "dex", "con"], feat: "savageAttacker",
    skills: ["athletics", "intimidation"], tool: tools.gaming,
    summary: t("You trained for war from a young age.", "Te entrenaste para la guerra desde joven."),
    equipment: [
      { id: "A", items: [spear, t("Shortbow", "Arco corto"), arrows, gamingSet, healersKit, quiver, clothes, gp(14)], weapons: ["shortbow", "spear"], gold: 14 }, bgB,
    ],
  },
  {
    id: "wayfarer", name: t("Wayfarer", "Trotamundos"), abilities: ["dex", "wis", "cha"], feat: "lucky",
    skills: ["insight", "stealth"], tool: tools.thieves,
    summary: t("You grew up on the streets or the road, relying on your wits.", "Creciste en la calle o en el camino, confiando en tu ingenio."),
    equipment: [
      { id: "A", items: [daggers2, tools.thieves, gamingSet, bedroll, pouches, clothes, gp(16)], weapons: ["dagger"], gold: 16 }, bgB,
    ],
  },
];

export type SpeciesId =
  | "aasimar" | "dragonborn" | "dwarf" | "elf" | "gnome" | "goliath" | "halfling" | "human" | "orc" | "tiefling"
  | "changeling" | "kalashtar" | "khoravar" | "shifter" | "warforged"
  | "aarakocra" | "bugbear" | "centaur" | "deepGnome" | "duergar" | "eladrin" | "fairy" | "firbolg" | "genasi"
  | "githyanki" | "githzerai" | "goblin" | "harengon" | "hobgoblin" | "kenku" | "kobold" | "lizardfolk" | "minotaur"
  | "satyr" | "seaElf" | "shadarKai" | "tabaxi" | "tortle" | "triton" | "yuanTi";
/** Book a species comes from. Monsters of the Multiverse species work with the 2024 rules: ability increases come from the background. */
export type SpeciesSource = "phb2024" | "eberron2025" | "motm2022";
export const speciesSources: Record<SpeciesSource, Text> = {
  phb2024: { en: "Player's Handbook (2024)", es: "Manual del Jugador (2024)" },
  eberron2025: { en: "Eberron: Forge of the Artificer (2025)", es: "Eberron: Forge of the Artificer (2025)" },
  motm2022: { en: "Monsters of the Multiverse (2022)", es: "Monstruos del Multiverso (2022)" },
};
export interface Lineage { id: string; name: Text; detail?: Text; speed?: number; darkvision?: number }
export interface SpeciesData {
  id: SpeciesId;
  name: Text;
  source: SpeciesSource;
  /** Only when it isn't Humanoid (it matters for spells such as Hold Person). */
  creatureType?: Text;
  size: Text;
  speed: number;
  darkvision?: number;
  traits: Feature[];
  lineageLabel?: Text;
  lineages?: Lineage[];
  /** Number of extra skills chosen from the given list (empty = any). */
  skillChoice?: { count: number; options: SkillKey[] };
  /** Skills the species always grants. */
  skills?: SkillKey[];
  /** Human Versatile: choose an origin feat. */
  originFeat?: boolean;
}

export const species: SpeciesData[] = [
  {
    id: "aasimar", name: t("Aasimar", "Aasimar"), source: "phb2024", size: t("Medium or Small", "Mediano o pequeño"), speed: 30, darkvision: 60,
    traits: [
      f("Celestial Resistance", "Resistencia celestial", "Resistance to necrotic and radiant damage.", "Resistencia al daño necrótico y radiante."),
      f("Healing Hands", "Manos curativas", "Magic action: touch a creature to heal it a number of d4 equal to your proficiency bonus. Once per Long Rest.", "Acción mágica: tocas a una criatura y la curas tantos d4 como tu bonificador por competencia. Una vez por descanso largo."),
      f("Light Bearer", "Portador de luz", "You know the Light cantrip; Charisma is your spellcasting ability for it.", "Conoces el truco Luz; lo lanzas con Carisma."),
      f("Celestial Revelation (level 3)", "Revelación celestial (nivel 3)", "Bonus action: transform for 1 minute (spectral wings, a frightening aura or searing light) and deal extra radiant damage once per turn. Once per Long Rest.", "Acción adicional: te transformas durante 1 minuto (alas espectrales, un aura aterradora o luz abrasadora) y haces daño radiante extra una vez por turno. Una vez por descanso largo."),
    ],
  },
  {
    id: "dragonborn", name: t("Dragonborn", "Dracónido"), source: "phb2024", size: t("Medium", "Mediano"), speed: 30, darkvision: 60,
    traits: [
      f("Breath Weapon", "Arma de aliento", "Replace one attack with a 15-foot cone or 30-foot line of your ancestry's damage (1d10, Dexterity save halves it). Uses equal to your proficiency bonus per Long Rest.", "Sustituyes un ataque por un cono de 15 pies o una línea de 30 pies del daño de tu ascendencia (1d10, salvación de Destreza para la mitad). Tantos usos como tu bonificador por competencia por descanso largo."),
      f("Damage Resistance", "Resistencia al daño", "Resistance to the damage type of your draconic ancestry.", "Resistencia al tipo de daño de tu ascendencia dracónica."),
      f("Draconic Flight (level 5)", "Vuelo dracónico (nivel 5)", "Bonus action: sprout spectral wings and gain a fly speed for 10 minutes. Once per Long Rest.", "Acción adicional: te salen alas espectrales y ganas velocidad de vuelo durante 10 minutos. Una vez por descanso largo."),
    ],
    lineageLabel: t("Draconic Ancestry", "Ascendencia dracónica"),
    lineages: [
      ["black", "Black", "Negro", "Acid", "Ácido"], ["blue", "Blue", "Azul", "Lightning", "Relámpago"], ["brass", "Brass", "Latón", "Fire", "Fuego"],
      ["bronze", "Bronze", "Bronce", "Lightning", "Relámpago"], ["copper", "Copper", "Cobre", "Acid", "Ácido"], ["gold", "Gold", "Oro", "Fire", "Fuego"],
      ["green", "Green", "Verde", "Poison", "Veneno"], ["red", "Red", "Rojo", "Fire", "Fuego"], ["silver", "Silver", "Plata", "Cold", "Frío"], ["white", "White", "Blanco", "Cold", "Frío"],
    ].map(([id, en, es, den, des]) => ({ id, name: t(en, es), detail: t(den, des) })),
  },
  {
    id: "dwarf", name: t("Dwarf", "Enano"), source: "phb2024", size: t("Medium", "Mediano"), speed: 30, darkvision: 120,
    traits: [
      f("Dwarven Resilience", "Resistencia enana", "Resistance to poison damage and advantage on saves to avoid or end the Poisoned condition.", "Resistencia al daño de veneno y ventaja en salvaciones para evitar o terminar el estado envenenado."),
      f("Dwarven Toughness", "Dureza enana", "+1 hit point maximum per level (already counted on this sheet).", "+1 punto de golpe máximo por nivel (ya incluido en esta ficha).", [{ kind: "hpPerLevel", amount: 1 }]),
      f("Stonecunning", "Afinidad con la piedra", "Bonus action: gain 60-foot tremorsense for 10 minutes while on or touching stone. Uses equal to your proficiency bonus per Long Rest.", "Acción adicional: ganas sentido de la vibración a 60 pies durante 10 minutos si estás sobre piedra o la tocas. Tantos usos como tu bonificador por competencia por descanso largo."),
    ],
  },
  {
    id: "elf", name: t("Elf", "Elfo"), source: "phb2024", size: t("Medium", "Mediano"), speed: 30, darkvision: 60,
    traits: [
      f("Fey Ancestry", "Linaje feérico", "Advantage on saves to avoid or end the Charmed condition.", "Ventaja en salvaciones para evitar o terminar el estado hechizado."),
      f("Keen Senses", "Sentidos agudos", "Proficiency in Insight, Perception or Survival.", "Competencia en Perspicacia, Percepción o Supervivencia."),
      f("Trance", "Trance", "You don't need to sleep; 4 hours of meditative trance give you the benefits of a Long Rest.", "No necesitas dormir; 4 horas de trance meditativo te dan los beneficios de un descanso largo."),
    ],
    lineageLabel: t("Elven Lineage", "Linaje élfico"),
    lineages: [
      { id: "drow", name: t("Drow", "Drow"), detail: t("Darkvision 120 ft.", "Visión en la oscuridad 120 pies"), darkvision: 120 },
      { id: "high", name: t("High Elf", "Alto elfo"), detail: t("Prestidigitation cantrip", "Truco Prestidigitación") },
      { id: "wood", name: t("Wood Elf", "Elfo de los bosques"), detail: t("Speed 35 ft.", "Velocidad 35 pies"), speed: 35 },
    ],
    skillChoice: { count: 1, options: ["insight", "perception", "survival"] },
  },
  {
    id: "gnome", name: t("Gnome", "Gnomo"), source: "phb2024", size: t("Small", "Pequeño"), speed: 30, darkvision: 60,
    traits: [
      f("Gnomish Cunning", "Astucia gnoma", "Advantage on Intelligence, Wisdom and Charisma saving throws.", "Ventaja en las salvaciones de Inteligencia, Sabiduría y Carisma."),
    ],
    lineageLabel: t("Gnomish Lineage", "Linaje gnomo"),
    lineages: [
      { id: "forest", name: t("Forest Gnome", "Gnomo de los bosques"), detail: t("Minor Illusion, Speak with Animals", "Ilusión menor, Hablar con los animales") },
      { id: "rock", name: t("Rock Gnome", "Gnomo de las rocas"), detail: t("Mending, Prestidigitation, tinkering", "Reparar, Prestidigitación, artilugios") },
    ],
  },
  {
    id: "goliath", name: t("Goliath", "Goliat"), source: "phb2024", size: t("Medium", "Mediano"), speed: 35,
    traits: [
      f("Large Form (level 5)", "Forma grande (nivel 5)", "Bonus action: become Large for 10 minutes, with advantage on Strength checks and +10 feet of speed. Once per Long Rest.", "Acción adicional: pasas a tamaño grande durante 10 minutos, con ventaja en pruebas de Fuerza y +10 pies de velocidad. Una vez por descanso largo."),
      f("Powerful Build", "Complexión poderosa", "Advantage on checks to end the Grappled condition, and you count as one size larger for carrying capacity.", "Ventaja en pruebas para terminar el estado agarrado, y cuentas como un tamaño mayor para la capacidad de carga."),
    ],
    lineageLabel: t("Giant Ancestry", "Ascendencia gigante"),
    lineages: [
      ["cloud", "Cloud's Jaunt", "Paso de las nubes", "Bonus action: teleport up to 30 feet", "Acción adicional: te teletransportas hasta 30 pies"],
      ["fire", "Fire's Burn", "Quemadura de fuego", "+1d10 fire damage when you hit", "+1d10 de daño de fuego al impactar"],
      ["frost", "Frost's Chill", "Gélido de escarcha", "+1d6 cold damage and −10 feet speed to the target when you hit", "+1d6 de daño de frío y −10 pies de velocidad al objetivo al impactar"],
      ["hill", "Hill's Tumble", "Derribo de colina", "Knock a Large or smaller target Prone when you hit", "Derribas a un objetivo grande o menor al impactar"],
      ["stone", "Stone's Endurance", "Aguante de piedra", "Reaction: reduce damage taken by 1d12 + Constitution", "Reacción: reduces el daño recibido en 1d12 + Constitución"],
      ["storm", "Storm's Thunder", "Trueno de tormenta", "Reaction: deal 1d8 thunder damage to a creature that damages you", "Reacción: haces 1d8 de daño de trueno a quien te daña"],
    ].map(([id, en, es, den, des]) => ({ id, name: t(en, es), detail: t(`${den} (proficiency bonus uses per Long Rest)`, `${des} (tantos usos como tu bonificador por competencia por descanso largo)`) })),
  },
  {
    id: "halfling", name: t("Halfling", "Mediano"), source: "phb2024", size: t("Small", "Pequeño"), speed: 30,
    traits: [
      f("Brave", "Valiente", "Advantage on saves to avoid or end the Frightened condition.", "Ventaja en salvaciones para evitar o terminar el estado asustado."),
      f("Halfling Nimbleness", "Agilidad mediana", "You can move through the space of any creature larger than you.", "Puedes atravesar el espacio de cualquier criatura más grande que tú."),
      f("Luck", "Suerte", "When you roll a 1 on a d20 test, reroll it and use the new roll.", "Cuando sacas un 1 en una prueba de d20, repites la tirada y usas el nuevo resultado."),
      f("Naturally Stealthy", "Sigiloso por naturaleza", "You can try to hide behind a creature at least one size larger than you.", "Puedes intentar esconderte detrás de una criatura al menos un tamaño mayor que tú."),
    ],
  },
  {
    id: "human", name: t("Human", "Humano"), source: "phb2024", size: t("Medium or Small", "Mediano o pequeño"), speed: 30,
    traits: [
      f("Resourceful", "Ingenioso", "You gain Heroic Inspiration whenever you finish a Long Rest.", "Ganas Inspiración heroica cada vez que terminas un descanso largo."),
      f("Skillful", "Hábil", "Proficiency in one extra skill of your choice.", "Competencia en una habilidad adicional a tu elección."),
      f("Versatile", "Versátil", "You gain an Origin feat of your choice.", "Ganas una dote de origen a tu elección."),
    ],
    skillChoice: { count: 1, options: [] }, originFeat: true,
  },
  {
    id: "orc", name: t("Orc", "Orco"), source: "phb2024", size: t("Medium", "Mediano"), speed: 30, darkvision: 120,
    traits: [
      f("Adrenaline Rush", "Subidón de adrenalina", "Dash as a bonus action and gain temporary hit points equal to your proficiency bonus. Uses equal to your proficiency bonus per Short or Long Rest.", "Corres como acción adicional y ganas puntos de golpe temporales iguales a tu bonificador por competencia. Tantos usos como ese bonificador por descanso corto o largo."),
      f("Relentless Endurance", "Aguante incansable", "When you drop to 0 hit points without being killed outright, you drop to 1 instead. Once per Long Rest.", "Cuando caes a 0 puntos de golpe sin morir en el acto, te quedas a 1. Una vez por descanso largo."),
    ],
  },
  {
    id: "tiefling", name: t("Tiefling", "Tiflin"), source: "phb2024", size: t("Medium or Small", "Mediano o pequeño"), speed: 30, darkvision: 60,
    traits: [
      f("Otherworldly Presence", "Presencia de otro mundo", "You know the Thaumaturgy cantrip, cast with the same ability as your Fiendish Legacy spells.", "Conoces el truco Taumaturgia, que lanzas con la misma característica que los conjuros de tu legado infernal."),
    ],
    lineageLabel: t("Fiendish Legacy", "Legado infernal"),
    lineages: [
      { id: "abyssal", name: t("Abyssal", "Abisal"), detail: t("Poison resistance", "Resistencia al veneno") },
      { id: "chthonic", name: t("Chthonic", "Ctónico"), detail: t("Necrotic resistance", "Resistencia al daño necrótico") },
      { id: "infernal", name: t("Infernal", "Infernal"), detail: t("Fire resistance", "Resistencia al fuego") },
    ],
  },

  // --- Eberron: Forge of the Artificer (2025), already written for the 2024 rules ---
  {
    id: "changeling", name: t("Changeling", "Cambiante"), source: "eberron2025", creatureType: t("Fey", "Feérico"),
    size: t("Medium or Small", "Mediano o pequeño"), speed: 30,
    traits: [
      f("Changeling Instincts", "Instintos de cambiante", "Proficiency in two of Deception, Insight, Intimidation, Performance and Persuasion.", "Competencia en dos de Engaño, Perspicacia, Intimidación, Interpretación y Persuasión."),
      f("Shape-Shifter", "Cambiaformas", "Action: change your appearance and voice (height, build, features, apparent age), keeping your size and game statistics; the disguise also helps your Charisma checks.", "Acción: cambias tu aspecto y tu voz (altura, complexión, rasgos, edad aparente) sin cambiar tu tamaño ni tus estadísticas; el disfraz también te ayuda en las pruebas de Carisma."),
    ],
    skillChoice: { count: 2, options: ["deception", "insight", "intimidation", "performance", "persuasion"] },
  },
  {
    id: "kalashtar", name: t("Kalashtar", "Kalashtar"), source: "eberron2025", creatureType: t("Aberration", "Aberración"),
    size: t("Medium", "Mediano"), speed: 30,
    traits: [
      f("Dual Mind", "Mente dual", "Advantage on Wisdom and Charisma saving throws.", "Ventaja en las salvaciones de Sabiduría y Carisma."),
      f("Mental Discipline", "Disciplina mental", "Resistance to psychic damage.", "Resistencia al daño psíquico."),
      f("Mind Link", "Vínculo mental", "Telepathy with a creature you can see within 10 feet × your level; it can answer you while the link lasts.", "Telepatía con una criatura que veas a 10 pies × tu nivel; puede responderte mientras dure el vínculo."),
      f("Severed from Dreams", "Separado de los sueños", "Your sleep doesn't touch the plane of dreams: magic that works through dreams can't reach you.", "Tu sueño no toca el plano de los sueños: la magia que actúa a través de ellos no te alcanza."),
    ],
  },
  {
    id: "khoravar", name: t("Khoravar", "Khoravar"), source: "eberron2025", size: t("Medium or Small", "Mediano o pequeño"), speed: 30, darkvision: 60,
    traits: [
      f("Fey Ancestry", "Linaje feérico", "Advantage on saves to avoid or end the Charmed condition.", "Ventaja en salvaciones para evitar o terminar el estado hechizado."),
      f("Fey Gift", "Don feérico", "You know the Friends cantrip; after a Long Rest you can swap it for a Cleric, Druid or Wizard cantrip.", "Conoces el truco Amistad; tras un descanso largo puedes cambiarlo por un truco de clérigo, druida o mago."),
      f("Lethargy Resilience", "Resistencia al letargo", "When you fail a save against the Unconscious condition, you can succeed instead. Usable again after 1d4 Long Rests.", "Cuando fallas una salvación contra el estado inconsciente, puedes superarla. Vuelves a poder usarlo tras 1d4 descansos largos."),
      f("Skill Versatility", "Versatilidad", "Proficiency in one skill or tool of your choice; you can change it after a Long Rest.", "Competencia en una habilidad o herramienta a tu elección; puedes cambiarla tras un descanso largo."),
    ],
    skillChoice: { count: 1, options: [] },
  },
  {
    id: "shifter", name: t("Shifter", "Cambiaformas"), source: "eberron2025", size: t("Medium or Small", "Mediano o pequeño"), speed: 30, darkvision: 60,
    traits: [
      f("Bestial Instincts", "Instintos bestiales", "Proficiency in Acrobatics, Athletics, Intimidation or Survival.", "Competencia en Acrobacias, Atletismo, Intimidación o Supervivencia."),
      f("Shifting", "Transformación", "Bonus action: take on a bestial look for 1 minute and gain temporary hit points equal to twice your proficiency bonus, plus your shift's benefit. Uses equal to your proficiency bonus per Long Rest.", "Acción adicional: adoptas un aspecto bestial durante 1 minuto y ganas puntos de golpe temporales iguales al doble de tu bonificador por competencia, más el beneficio de tu transformación. Tantos usos como ese bonificador por descanso largo."),
    ],
    skillChoice: { count: 1, options: ["acrobatics", "athletics", "intimidation", "survival"] },
    lineageLabel: t("Shift", "Transformación"),
    lineages: [
      ["beasthide", "Beasthide", "Piel de bestia", "+1d6 temporary hit points and +1 AC while shifted", "+1d6 puntos de golpe temporales y +1 a la CA mientras dura"],
      ["longtooth", "Longtooth", "Colmillo largo", "Bonus action fang strike (1d6 + Strength piercing) while shifted", "Mordisco como acción adicional (1d6 + Fuerza perforante) mientras dura"],
      ["swiftstride", "Swiftstride", "Paso veloz", "+10 feet of speed while shifted", "+10 pies de velocidad mientras dura"],
      ["wildhunt", "Wildhunt", "Cacería salvaje", "Advantage on Wisdom checks; nearby creatures can't gain advantage to hit you", "Ventaja en pruebas de Sabiduría; las criaturas cercanas no tienen ventaja al atacarte"],
    ].map(([id, en, es, den, des]) => ({ id, name: t(en, es), detail: t(den, des) })),
  },
  {
    id: "warforged", name: t("Warforged", "Forjado"), source: "eberron2025", creatureType: t("Construct", "Constructo"),
    size: t("Medium", "Mediano"), speed: 30,
    traits: [
      f("Constructed Resilience", "Resistencia de constructo", "Resistance to poison damage and advantage on saves to avoid or end the Poisoned condition.", "Resistencia al daño de veneno y ventaja en salvaciones para evitar o terminar el estado envenenado."),
      f("Integrated Protection", "Protección integrada", "+1 to Armor Class (already counted on this sheet); armor you wear can't be removed against your will.", "+1 a la Clase de Armadura (ya incluido en esta ficha); nadie puede quitarte la armadura contra tu voluntad.", [{ kind: "acBonus", amount: 1 }]),
      f("Sentry's Rest", "Descanso del centinela", "You don't need to sleep and magic can't put you to sleep; a Long Rest is 6 hours of inactive but conscious rest.", "No necesitas dormir y la magia no puede dormirte; un descanso largo son 6 horas de reposo inactivo pero consciente."),
      f("Tireless", "Incansable", "You don't gain Exhaustion from lack of food, water or air.", "No sufres cansancio por falta de comida, agua o aire."),
    ],
  },

  // --- Mordenkainen Presents: Monsters of the Multiverse (2022) ---
  {
    id: "aarakocra", name: t("Aarakocra", "Aarakocra"), source: "motm2022", size: t("Medium", "Mediano"), speed: 30,
    traits: [
      f("Flight", "Vuelo", "Fly speed equal to your walking speed, as long as you aren't wearing Medium or Heavy armor.", "Velocidad de vuelo igual a tu velocidad caminando, si no llevas armadura media ni pesada."),
      f("Talons", "Garras", "Your unarmed strikes can deal 1d6 + Strength slashing damage.", "Tus ataques sin armas pueden hacer 1d6 + Fuerza de daño cortante."),
      f("Wind Caller (level 3)", "Llamada del viento (nivel 3)", "Cast Gust of Wind once per Long Rest without a slot (or with your slots), using Intelligence, Wisdom or Charisma.", "Lanzas Ráfaga de viento una vez por descanso largo sin espacio (o con tus espacios), con Inteligencia, Sabiduría o Carisma."),
    ],
  },
  {
    id: "bugbear", name: t("Bugbear", "Osgo"), source: "motm2022", size: t("Medium", "Mediano"), speed: 30, darkvision: 60,
    traits: [
      f("Fey Ancestry", "Linaje feérico", "Advantage on saves to avoid or end the Charmed condition.", "Ventaja en salvaciones para evitar o terminar el estado hechizado."),
      f("Long-Limbed", "Extremidades largas", "Your melee attacks on your turn have 5 more feet of reach.", "Tus ataques cuerpo a cuerpo en tu turno tienen 5 pies más de alcance."),
      f("Powerful Build", "Complexión poderosa", "Advantage on checks to end the Grappled condition, and you count as one size larger for carrying capacity.", "Ventaja en pruebas para terminar el estado agarrado, y cuentas como un tamaño mayor para la capacidad de carga."),
      f("Sneaky", "Sigiloso", "Proficiency in Stealth, and you can squeeze through spaces made for Small creatures.", "Competencia en Sigilo, y puedes colarte por espacios pensados para criaturas pequeñas."),
      f("Surprise Attack", "Ataque sorpresa", "Deal an extra 2d6 damage once per combat when you hit a creature that hasn't taken a turn yet.", "Haces 2d6 de daño extra una vez por combate al impactar a una criatura que aún no ha tenido turno."),
    ],
    skills: ["stealth"],
  },
  {
    id: "centaur", name: t("Centaur", "Centauro"), source: "motm2022", creatureType: t("Fey", "Feérico"), size: t("Medium", "Mediano"), speed: 40,
    traits: [
      f("Charge", "Carga", "After moving 30 feet straight toward a target and hitting it with a melee attack, make a hooves attack as a bonus action.", "Si te mueves 30 pies en línea recta hacia un objetivo y lo impactas cuerpo a cuerpo, puedes atacar con los cascos como acción adicional."),
      f("Equine Build", "Constitución equina", "You count as one size larger for carrying capacity; climbing costs you 4 extra feet per foot.", "Cuentas como un tamaño mayor para la capacidad de carga; trepar te cuesta 4 pies extra por cada pie."),
      f("Hooves", "Cascos", "Your unarmed strikes can deal 1d6 + Strength bludgeoning damage.", "Tus ataques sin armas pueden hacer 1d6 + Fuerza de daño contundente."),
      f("Natural Affinity", "Afinidad natural", "Proficiency in Animal Handling, Medicine, Nature or Survival.", "Competencia en Trato con animales, Medicina, Naturaleza o Supervivencia."),
    ],
    skillChoice: { count: 1, options: ["animalHandling", "medicine", "nature", "survival"] },
  },
  {
    id: "deepGnome", name: t("Deep Gnome", "Gnomo de las profundidades"), source: "motm2022", size: t("Small", "Pequeño"), speed: 30, darkvision: 120,
    traits: [
      f("Gift of the Svirfneblin (level 3)", "Don de los svirfneblin (nivel 3)", "Cast Disguise Self (level 3) and Nondetection (level 5) once per Long Rest each without a slot, using Intelligence, Wisdom or Charisma.", "Lanzas Disfrazarse (nivel 3) e Indetectable (nivel 5) una vez por descanso largo cada uno sin espacio, con Inteligencia, Sabiduría o Carisma."),
      f("Gnomish Magic Resistance", "Resistencia mágica gnoma", "Advantage on Intelligence, Wisdom and Charisma saves against spells.", "Ventaja en salvaciones de Inteligencia, Sabiduría y Carisma contra conjuros."),
      f("Svirfneblin Camouflage", "Camuflaje svirfneblin", "Give yourself advantage on a Stealth check. Uses equal to your proficiency bonus per Long Rest.", "Te das ventaja en una prueba de Sigilo. Tantos usos como tu bonificador por competencia por descanso largo."),
    ],
  },
  {
    id: "duergar", name: t("Duergar", "Duergar"), source: "motm2022", size: t("Medium", "Mediano"), speed: 30, darkvision: 120,
    traits: [
      f("Duergar Magic (level 3)", "Magia duergar (nivel 3)", "Cast Enlarge/Reduce (level 3) and Invisibility (level 5) on yourself once per Long Rest each without a slot, using Intelligence, Wisdom or Charisma.", "Lanzas Agrandar/reducir (nivel 3) e Invisibilidad (nivel 5) sobre ti una vez por descanso largo cada uno sin espacio, con Inteligencia, Sabiduría o Carisma."),
      f("Dwarven Resilience", "Resistencia enana", "Resistance to poison damage and advantage on saves to avoid or end the Poisoned condition.", "Resistencia al daño de veneno y ventaja en salvaciones para evitar o terminar el estado envenenado."),
      f("Psionic Fortitude", "Fortaleza psiónica", "Advantage on saves to avoid or end the Charmed or Stunned condition.", "Ventaja en salvaciones para evitar o terminar los estados hechizado o aturdido."),
    ],
  },
  {
    id: "eladrin", name: t("Eladrin", "Eladrin"), source: "motm2022", size: t("Medium", "Mediano"), speed: 30, darkvision: 60,
    traits: [
      f("Fey Ancestry", "Linaje feérico", "Advantage on saves to avoid or end the Charmed condition.", "Ventaja en salvaciones para evitar o terminar el estado hechizado."),
      f("Fey Step", "Paso feérico", "Bonus action: teleport up to 30 feet; from level 3 your season adds an effect. Uses equal to your proficiency bonus per Long Rest.", "Acción adicional: te teletransportas hasta 30 pies; desde el nivel 3 tu estación añade un efecto. Tantos usos como tu bonificador por competencia por descanso largo."),
      f("Keen Senses", "Sentidos agudos", "Proficiency in Perception.", "Competencia en Percepción."),
      f("Trance", "Trance", "You don't need to sleep; 4 hours of trance give you a Long Rest and a temporary weapon or tool proficiency.", "No necesitas dormir; 4 horas de trance te dan un descanso largo y una competencia temporal con un arma o herramienta."),
    ],
    skills: ["perception"],
    lineageLabel: t("Season", "Estación"),
    lineages: [
      ["autumn", "Autumn", "Otoño", "Charm up to two creatures within 10 feet for 1 minute", "Hechizas hasta a dos criaturas a 10 pies durante 1 minuto"],
      ["winter", "Winter", "Invierno", "Frighten a creature within 5 feet before you teleport", "Asustas a una criatura a 5 pies antes de teletransportarte"],
      ["spring", "Spring", "Primavera", "Teleport a willing creature within 5 feet instead of yourself", "Teletransportas a una criatura voluntaria a 5 pies en tu lugar"],
      ["summer", "Summer", "Verano", "Fire damage equal to your proficiency bonus to creatures within 5 feet of where you arrive", "Daño de fuego igual a tu bonificador por competencia a las criaturas a 5 pies de donde apareces"],
    ].map(([id, en, es, den, des]) => ({ id, name: t(en, es), detail: t(den, des) })),
  },
  {
    id: "fairy", name: t("Fairy", "Hada"), source: "motm2022", creatureType: t("Fey", "Feérico"), size: t("Small", "Pequeño"), speed: 30,
    traits: [
      f("Fairy Magic", "Magia feérica", "You know Druidcraft; cast Faerie Fire (level 3) and Enlarge/Reduce (level 5) once per Long Rest each without a slot, using Intelligence, Wisdom or Charisma.", "Conoces Saber druídico; lanzas Fuego feérico (nivel 3) y Agrandar/reducir (nivel 5) una vez por descanso largo cada uno sin espacio, con Inteligencia, Sabiduría o Carisma."),
      f("Flight", "Vuelo", "Fly speed equal to your walking speed, as long as you aren't wearing Medium or Heavy armor.", "Velocidad de vuelo igual a tu velocidad caminando, si no llevas armadura media ni pesada."),
    ],
  },
  {
    id: "firbolg", name: t("Firbolg", "Firbolg"), source: "motm2022", size: t("Medium", "Mediano"), speed: 30,
    traits: [
      f("Firbolg Magic", "Magia firbolg", "Cast Detect Magic and Disguise Self once per Long Rest each without a slot, using Intelligence, Wisdom or Charisma.", "Lanzas Detectar magia y Disfrazarse una vez por descanso largo cada uno sin espacio, con Inteligencia, Sabiduría o Carisma."),
      f("Hidden Step", "Paso oculto", "Bonus action: turn invisible until the start of your next turn or until you attack, deal damage or force a save. Uses equal to your proficiency bonus per Long Rest.", "Acción adicional: te vuelves invisible hasta el inicio de tu siguiente turno o hasta que ataques, hagas daño u obligues a una salvación. Tantos usos como tu bonificador por competencia por descanso largo."),
      f("Powerful Build", "Complexión poderosa", "Advantage on checks to end the Grappled condition, and you count as one size larger for carrying capacity.", "Ventaja en pruebas para terminar el estado agarrado, y cuentas como un tamaño mayor para la capacidad de carga."),
      f("Speech of Beast and Leaf", "Habla de bestias y hojas", "Beasts and plants understand the meaning of your words; you have advantage on Charisma checks to influence them.", "Las bestias y las plantas entienden el sentido de tus palabras; tienes ventaja en pruebas de Carisma para influir en ellas."),
    ],
  },
  {
    id: "genasi", name: t("Genasi", "Genasi"), source: "motm2022", size: t("Medium or Small", "Mediano o pequeño"), speed: 30, darkvision: 60,
    traits: [
      f("Elemental Magic", "Magia elemental", "Your element grants a cantrip, a level 1 spell at level 3 and a level 2 spell at level 5 (once per Long Rest each without a slot), using Intelligence, Wisdom or Charisma.", "Tu elemento te da un truco, un conjuro de nivel 1 al nivel 3 y uno de nivel 2 al nivel 5 (una vez por descanso largo cada uno sin espacio), con Inteligencia, Sabiduría o Carisma."),
    ],
    lineageLabel: t("Element", "Elemento"),
    lineages: [
      { id: "air", name: t("Air Genasi", "Genasi de aire"), detail: t("Speed 35 ft., lightning resistance, hold breath indefinitely; Shocking Grasp, Feather Fall, Levitate", "Velocidad 35 pies, resistencia al relámpago, aguantas la respiración indefinidamente; Agarre electrizante, Caída de pluma, Levitar"), speed: 35 },
      { id: "earth", name: t("Earth Genasi", "Genasi de tierra"), detail: t("Ignore difficult terrain of earth or stone; Blade Ward as a bonus action, Pass without Trace", "Ignoras el terreno difícil de tierra o piedra; Custodia contra armas como acción adicional, Pasar sin rastro"), },
      { id: "fire", name: t("Fire Genasi", "Genasi de fuego"), detail: t("Fire resistance; Produce Flame, Burning Hands, Flame Blade", "Resistencia al fuego; Crear llama, Manos ardientes, Hoja de fuego") },
      { id: "water", name: t("Water Genasi", "Genasi de agua"), detail: t("Acid resistance, breathe underwater, swim speed; Acid Splash, Create or Destroy Water, Water Walk", "Resistencia al ácido, respiras bajo el agua, velocidad nadando; Salpicadura ácida, Crear o destruir agua, Caminar sobre el agua") },
    ],
  },
  {
    id: "githyanki", name: t("Githyanki", "Githyanki"), source: "motm2022", size: t("Medium", "Mediano"), speed: 30,
    traits: [
      f("Astral Knowledge", "Conocimiento astral", "After each Long Rest, gain proficiency in one skill and one weapon or tool of your choice until the next one.", "Tras cada descanso largo, ganas competencia en una habilidad y en un arma o herramienta a tu elección hasta el siguiente."),
      f("Githyanki Psionics", "Psiónica githyanki", "You know an invisible Mage Hand; cast Jump (level 3) and Misty Step (level 5) once per Long Rest each without a slot, using Intelligence, Wisdom or Charisma.", "Conoces una Mano de mago invisible; lanzas Salto (nivel 3) y Paso brumoso (nivel 5) una vez por descanso largo cada uno sin espacio, con Inteligencia, Sabiduría o Carisma."),
      f("Psychic Resilience", "Resiliencia psíquica", "Resistance to psychic damage.", "Resistencia al daño psíquico."),
    ],
    skillChoice: { count: 1, options: [] },
  },
  {
    id: "githzerai", name: t("Githzerai", "Githzerai"), source: "motm2022", size: t("Medium", "Mediano"), speed: 30,
    traits: [
      f("Githzerai Psionics", "Psiónica githzerai", "You know an invisible Mage Hand; cast Shield (level 3) and Detect Thoughts (level 5) once per Long Rest each without a slot, using Intelligence, Wisdom or Charisma.", "Conoces una Mano de mago invisible; lanzas Escudo (nivel 3) y Detectar pensamientos (nivel 5) una vez por descanso largo cada uno sin espacio, con Inteligencia, Sabiduría o Carisma."),
      f("Mental Discipline", "Disciplina mental", "Advantage on saves to avoid or end the Charmed and Frightened conditions.", "Ventaja en salvaciones para evitar o terminar los estados hechizado y asustado."),
      f("Psychic Resilience", "Resiliencia psíquica", "Resistance to psychic damage.", "Resistencia al daño psíquico."),
    ],
  },
  {
    id: "goblin", name: t("Goblin", "Goblin"), source: "motm2022", size: t("Small", "Pequeño"), speed: 30, darkvision: 60,
    traits: [
      f("Fey Ancestry", "Linaje feérico", "Advantage on saves to avoid or end the Charmed condition.", "Ventaja en salvaciones para evitar o terminar el estado hechizado."),
      f("Fury of the Small", "Furia de los pequeños", "Once per turn, deal extra damage equal to your proficiency bonus to a creature larger than you. Uses equal to your proficiency bonus per Long Rest.", "Una vez por turno, haces daño extra igual a tu bonificador por competencia a una criatura más grande que tú. Tantos usos como ese bonificador por descanso largo."),
      f("Nimble Escape", "Huida ágil", "Disengage or Hide as a bonus action.", "Retirarte o Esconderte como acción adicional."),
    ],
  },
  {
    id: "harengon", name: t("Harengon", "Harengon"), source: "motm2022", size: t("Medium or Small", "Mediano o pequeño"), speed: 30,
    traits: [
      f("Hare-Trigger", "Gatillo de liebre", "Add your proficiency bonus to Initiative (already counted on this sheet).", "Sumas tu bonificador por competencia a la iniciativa (ya incluido en esta ficha).", [{ kind: "initiativeBonus", add: "proficiency" }]),
      f("Leporine Senses", "Sentidos de liebre", "Proficiency in Perception.", "Competencia en Percepción."),
      f("Lucky Footwork", "Pies afortunados", "Reaction: add 1d4 to a failed Dexterity save, possibly turning it into a success.", "Reacción: sumas 1d4 a una salvación de Destreza fallada, que puede pasar a ser un éxito."),
      f("Rabbit Hop", "Salto de conejo", "Bonus action: jump 5 × your proficiency bonus feet without provoking Opportunity Attacks. Uses equal to your proficiency bonus per Long Rest.", "Acción adicional: saltas 5 × tu bonificador por competencia pies sin provocar ataques de oportunidad. Tantos usos como ese bonificador por descanso largo."),
    ],
    skills: ["perception"],
  },
  {
    id: "hobgoblin", name: t("Hobgoblin", "Hobgoblin"), source: "motm2022", size: t("Medium", "Mediano"), speed: 30, darkvision: 60,
    traits: [
      f("Fey Ancestry", "Linaje feérico", "Advantage on saves to avoid or end the Charmed condition.", "Ventaja en salvaciones para evitar o terminar el estado hechizado."),
      f("Fey Gift", "Don feérico", "Help as a bonus action; from level 3 it also heals, speeds up or hinders. Uses equal to your proficiency bonus per Long Rest.", "Ayudar como acción adicional; desde el nivel 3 además cura, acelera o entorpece. Tantos usos como tu bonificador por competencia por descanso largo."),
      f("Fortune from the Many", "Fortuna de los muchos", "When you miss or fail a check or save, add +1 for each ally you can see within 30 feet (up to +3). Uses equal to your proficiency bonus per Long Rest.", "Si fallas un ataque, prueba o salvación, sumas +1 por cada aliado que veas a 30 pies (hasta +3). Tantos usos como tu bonificador por competencia por descanso largo."),
    ],
  },
  {
    id: "kenku", name: t("Kenku", "Kenku"), source: "motm2022", size: t("Medium or Small", "Mediano o pequeño"), speed: 30,
    traits: [
      f("Expert Duplication", "Copia experta", "Advantage on checks to forge writing or copy craftwork.", "Ventaja en pruebas para falsificar escritos o copiar obras."),
      f("Kenku Recall", "Memoria kenku", "Proficiency in two skills of your choice; give yourself advantage on a check with a proficient skill. Uses equal to your proficiency bonus per Long Rest.", "Competencia en dos habilidades a tu elección; te das ventaja en una prueba de una habilidad que domines. Tantos usos como tu bonificador por competencia por descanso largo."),
      f("Mimicry", "Mimetismo", "You can imitate sounds and voices you have heard; telling them apart takes an Insight check.", "Imitas sonidos y voces que hayas oído; distinguirlos exige una prueba de Perspicacia."),
    ],
    skillChoice: { count: 2, options: [] },
  },
  {
    id: "kobold", name: t("Kobold", "Kobold"), source: "motm2022", size: t("Small", "Pequeño"), speed: 30, darkvision: 60,
    traits: [
      f("Draconic Cry", "Grito dracónico", "Bonus action: until your next turn, you and your allies have advantage on attacks against enemies within 10 feet of you that can hear you. Uses equal to your proficiency bonus per Long Rest.", "Acción adicional: hasta tu siguiente turno, tú y tus aliados tenéis ventaja al atacar a enemigos a 10 pies de ti que te oigan. Tantos usos como tu bonificador por competencia por descanso largo."),
    ],
    lineageLabel: t("Kobold Legacy", "Legado kobold"),
    lineages: [
      { id: "craftiness", name: t("Craftiness", "Astucia"), detail: t("Proficiency in Arcana, Investigation, Medicine, Sleight of Hand or Survival", "Competencia en Arcanos, Investigación, Medicina, Juego de manos o Supervivencia") },
      { id: "defiance", name: t("Defiance", "Desafío"), detail: t("Advantage on saves to avoid or end the Frightened condition", "Ventaja en salvaciones para evitar o terminar el estado asustado") },
      { id: "sorcery", name: t("Draconic Sorcery", "Hechicería dracónica"), detail: t("A Sorcerer cantrip, cast with Intelligence, Wisdom or Charisma", "Un truco de hechicero, lanzado con Inteligencia, Sabiduría o Carisma") },
    ],
  },
  {
    id: "lizardfolk", name: t("Lizardfolk", "Hombre lagarto"), source: "motm2022", size: t("Medium or Small", "Mediano o pequeño"), speed: 30,
    traits: [
      f("Bite", "Mordisco", "Your unarmed strikes can deal 1d6 + Strength slashing damage. You also have a swim speed equal to your walking speed.", "Tus ataques sin armas pueden hacer 1d6 + Fuerza de daño cortante. Además, tienes velocidad nadando igual a tu velocidad caminando."),
      f("Hold Breath", "Aguantar la respiración", "You can hold your breath for up to 15 minutes.", "Puedes aguantar la respiración hasta 15 minutos."),
      f("Hunter's Lore", "Saber del cazador", "Proficiency in two of Animal Handling, Medicine, Nature, Perception, Stealth and Survival.", "Competencia en dos de Trato con animales, Medicina, Naturaleza, Percepción, Sigilo y Supervivencia."),
      f("Hungry Jaws", "Fauces hambrientas", "Bonus action: a bite attack that gives you temporary hit points equal to your proficiency bonus if it hits. Uses equal to your proficiency bonus per Long Rest.", "Acción adicional: un mordisco que, si impacta, te da puntos de golpe temporales iguales a tu bonificador por competencia. Tantos usos como ese bonificador por descanso largo."),
      f("Natural Armor", "Armadura natural", "Without armor, your AC is 13 + Dexterity modifier; a shield still adds its bonus.", "Sin armadura, tu CA es 13 + modificador de Destreza; el escudo sigue sumando.", [{ kind: "naturalArmor", base: 13, addDex: true }]),
    ],
    skillChoice: { count: 2, options: ["animalHandling", "medicine", "nature", "perception", "stealth", "survival"] },
  },
  {
    id: "minotaur", name: t("Minotaur", "Minotauro"), source: "motm2022", size: t("Medium", "Mediano"), speed: 30,
    traits: [
      f("Horns", "Cuernos", "Your unarmed strikes can deal 1d6 + Strength piercing damage.", "Tus ataques sin armas pueden hacer 1d6 + Fuerza de daño perforante."),
      f("Goring Rush", "Embestida", "When you Dash and move at least 20 feet, make a horns attack as a bonus action.", "Cuando corres y te mueves al menos 20 pies, atacas con los cuernos como acción adicional."),
      f("Hammering Horns", "Cornada", "After hitting with a melee attack, try to shove the target 10 feet away as a bonus action.", "Tras impactar cuerpo a cuerpo, intentas empujar al objetivo 10 pies como acción adicional."),
      f("Labyrinthine Recall", "Memoria laberíntica", "You always know which way is north and have advantage on Survival checks to navigate or track.", "Siempre sabes dónde está el norte y tienes ventaja en pruebas de Supervivencia para orientarte o rastrear."),
    ],
  },
  {
    id: "satyr", name: t("Satyr", "Sátiro"), source: "motm2022", creatureType: t("Fey", "Feérico"), size: t("Medium", "Mediano"), speed: 35,
    traits: [
      f("Ram", "Testarazo", "Your unarmed strikes can deal 1d6 + Strength bludgeoning damage.", "Tus ataques sin armas pueden hacer 1d6 + Fuerza de daño contundente."),
      f("Magic Resistance", "Resistencia mágica", "Advantage on saving throws against spells.", "Ventaja en las salvaciones contra conjuros."),
      f("Mirthful Leaps", "Saltos alegres", "Add 1d8 feet to your long or high jumps.", "Sumas 1d8 pies a tus saltos de longitud o altura."),
      f("Reveler", "Juerguista", "Proficiency in Performance and Persuasion and with one musical instrument.", "Competencia en Interpretación, Persuasión y un instrumento musical."),
    ],
    skills: ["performance", "persuasion"],
  },
  {
    id: "seaElf", name: t("Sea Elf", "Elfo marino"), source: "motm2022", size: t("Medium", "Mediano"), speed: 30, darkvision: 60,
    traits: [
      f("Child of the Sea", "Hijo del mar", "Swim speed equal to your walking speed, you can breathe air and water, and you have resistance to cold damage.", "Velocidad nadando igual a tu velocidad caminando, respiras aire y agua y tienes resistencia al frío."),
      f("Fey Ancestry", "Linaje feérico", "Advantage on saves to avoid or end the Charmed condition.", "Ventaja en salvaciones para evitar o terminar el estado hechizado."),
      f("Friend of the Sea", "Amigo del mar", "You can communicate simple ideas to Beasts, Elementals and Monstrosities that have a swim speed.", "Comunicas ideas sencillas a bestias, elementales y monstruosidades con velocidad nadando."),
      f("Keen Senses", "Sentidos agudos", "Proficiency in Perception.", "Competencia en Percepción."),
      f("Trance", "Trance", "You don't need to sleep; 4 hours of trance give you a Long Rest and a temporary weapon or tool proficiency.", "No necesitas dormir; 4 horas de trance te dan un descanso largo y una competencia temporal con un arma o herramienta."),
    ],
    skills: ["perception"],
  },
  {
    id: "shadarKai", name: t("Shadar-kai", "Shadar-kai"), source: "motm2022", size: t("Medium", "Mediano"), speed: 30, darkvision: 60,
    traits: [
      f("Blessing of the Raven Queen", "Bendición de la Reina Cuervo", "Bonus action: teleport up to 30 feet; from level 3 you also resist all damage until your next turn. Uses equal to your proficiency bonus per Long Rest.", "Acción adicional: te teletransportas hasta 30 pies; desde el nivel 3 además resistes todo el daño hasta tu siguiente turno. Tantos usos como tu bonificador por competencia por descanso largo."),
      f("Fey Ancestry", "Linaje feérico", "Advantage on saves to avoid or end the Charmed condition.", "Ventaja en salvaciones para evitar o terminar el estado hechizado."),
      f("Keen Senses", "Sentidos agudos", "Proficiency in Perception.", "Competencia en Percepción."),
      f("Necrotic Resistance", "Resistencia necrótica", "Resistance to necrotic damage.", "Resistencia al daño necrótico."),
      f("Trance", "Trance", "You don't need to sleep; 4 hours of trance give you a Long Rest and a temporary weapon or tool proficiency.", "No necesitas dormir; 4 horas de trance te dan un descanso largo y una competencia temporal con un arma o herramienta."),
    ],
    skills: ["perception"],
  },
  {
    id: "tabaxi", name: t("Tabaxi", "Tabaxi"), source: "motm2022", size: t("Medium or Small", "Mediano o pequeño"), speed: 30, darkvision: 60,
    traits: [
      f("Cat's Claws", "Garras felinas", "Climb speed equal to your walking speed; your unarmed strikes can deal 1d6 + Strength slashing damage.", "Velocidad trepando igual a tu velocidad caminando; tus ataques sin armas pueden hacer 1d6 + Fuerza de daño cortante."),
      f("Cat's Talent", "Talento felino", "Proficiency in Perception and Stealth.", "Competencia en Percepción y Sigilo."),
      f("Feline Agility", "Agilidad felina", "Double your speed until the end of the turn; you can do it again after a turn in which you don't move.", "Duplicas tu velocidad hasta el final del turno; puedes repetirlo tras un turno en el que no te muevas."),
    ],
    skills: ["perception", "stealth"],
  },
  {
    id: "tortle", name: t("Tortle", "Tortle"), source: "motm2022", size: t("Medium or Small", "Mediano o pequeño"), speed: 30,
    traits: [
      f("Claws", "Garras", "Your unarmed strikes can deal 1d6 + Strength slashing damage.", "Tus ataques sin armas pueden hacer 1d6 + Fuerza de daño cortante."),
      f("Hold Breath", "Aguantar la respiración", "You can hold your breath for up to 1 hour.", "Puedes aguantar la respiración hasta 1 hora."),
      f("Natural Armor", "Armadura natural", "Your shell gives you AC 17 (Dexterity doesn't apply); you can't wear armor, but a shield still adds its bonus.", "Tu caparazón te da CA 17 (sin sumar Destreza); no puedes llevar armadura, pero el escudo sigue sumando.", [{ kind: "naturalArmor", base: 17, addDex: false }]),
      f("Nature's Intuition", "Intuición natural", "Proficiency in Animal Handling, Medicine, Nature, Perception, Stealth or Survival.", "Competencia en Trato con animales, Medicina, Naturaleza, Percepción, Sigilo o Supervivencia."),
      f("Shell Defense", "Defensa del caparazón", "Action: withdraw into your shell for +4 AC and advantage on Strength and Constitution saves, but you are Prone and can't move or react. Bonus action to come out.", "Acción: te metes en el caparazón y ganas +4 a la CA y ventaja en salvaciones de Fuerza y Constitución, pero quedas derribado y no puedes moverte ni reaccionar. Sales con una acción adicional."),
    ],
    skillChoice: { count: 1, options: ["animalHandling", "medicine", "nature", "perception", "stealth", "survival"] },
  },
  {
    id: "triton", name: t("Triton", "Tritón"), source: "motm2022", size: t("Medium", "Mediano"), speed: 30, darkvision: 60,
    traits: [
      f("Amphibious", "Anfibio", "You can breathe air and water, and you have a swim speed equal to your walking speed.", "Respiras aire y agua, y tienes velocidad nadando igual a tu velocidad caminando."),
      f("Control Air and Water", "Controlar aire y agua", "Cast Fog Cloud, Gust of Wind (level 3) and Water Walk (level 5) once per Long Rest each without a slot, using Intelligence, Wisdom or Charisma.", "Lanzas Nube de niebla, Ráfaga de viento (nivel 3) y Caminar sobre el agua (nivel 5) una vez por descanso largo cada uno sin espacio, con Inteligencia, Sabiduría o Carisma."),
      f("Emissary of the Sea", "Emisario del mar", "You can communicate simple ideas to Beasts, Elementals and Monstrosities that have a swim speed.", "Comunicas ideas sencillas a bestias, elementales y monstruosidades con velocidad nadando."),
      f("Guardian of the Depths", "Guardián de las profundidades", "Resistance to cold damage.", "Resistencia al daño de frío."),
    ],
  },
  {
    id: "yuanTi", name: t("Yuan-ti", "Yuan-ti"), source: "motm2022", size: t("Medium or Small", "Mediano o pequeño"), speed: 30, darkvision: 60,
    traits: [
      f("Magic Resistance", "Resistencia mágica", "Advantage on saving throws against spells.", "Ventaja en las salvaciones contra conjuros."),
      f("Poison Resilience", "Resistencia al veneno", "Resistance to poison damage and advantage on saves to avoid or end the Poisoned condition.", "Resistencia al daño de veneno y ventaja en salvaciones para evitar o terminar el estado envenenado."),
      f("Serpentine Spellcasting", "Conjuros serpentinos", "You know Poison Spray and can cast Animal Friendship on snakes at will; Suggestion once per Long Rest from level 3. Intelligence, Wisdom or Charisma.", "Conoces Rociada venenosa y lanzas Amistad con los animales sobre serpientes a voluntad; Sugestión una vez por descanso largo desde el nivel 3. Con Inteligencia, Sabiduría o Carisma."),
    ],
  },
];

export const standardLanguages: Text[] = [
  t("Common Sign Language", "Lengua de signos común"), t("Draconic", "Dracónico"), t("Dwarvish", "Enano"), t("Elvish", "Élfico"),
  t("Giant", "Gigante"), t("Gnomish", "Gnomo"), t("Goblin", "Goblin"), t("Halfling", "Mediano"), t("Orc", "Orco"),
];

export const alignments: Text[] = [
  t("Lawful Good", "Legal bueno"), t("Neutral Good", "Neutral bueno"), t("Chaotic Good", "Caótico bueno"),
  t("Lawful Neutral", "Legal neutral"), t("Neutral", "Neutral"), t("Chaotic Neutral", "Caótico neutral"),
  t("Lawful Evil", "Legal malvado"), t("Neutral Evil", "Neutral malvado"), t("Chaotic Evil", "Caótico malvado"),
];

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;
export const POINT_BUY_BUDGET = 27;
export const pointBuyCost: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

export const findClass = (id?: string) => classes.find((item) => item.id === id);
export const findBackground = (id?: string) => backgrounds.find((item) => item.id === id);
export const findSpecies = (id?: string) => species.find((item) => item.id === id);
export const say = (text: Text | undefined, locale: "en" | "es") => (text ? text[locale] : "");
