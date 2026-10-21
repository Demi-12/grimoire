/**
 * Character creation data for the 2024 rules: the 12 classes with their SRD subclass,
 * the 10 Player's Handbook species, the 16 Player's Handbook backgrounds and the origin
 * feats they grant (the System Reference Document 5.2, CC-BY-4.0, only covers part of it).
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
  /** Mechanics of the level 1 features (see effects.ts). */
  effects?: Effect[];
  spellcasting?: { ability: AbilityKey; cantrips: number; prepared: number; slots: Text };
  weaponMasteries?: number;
  /** Rogues gain Expertise in two skills at level 1. */
  expertiseAtLevel1?: number;
  features: Text[];
  subclass: Text;
  equipment: EquipmentOption[];
  summary: Text;
}

const t = (en: string, es: string): Text => ({ en, es });
const gp = (amount: number) => t(`${amount} GP`, `${amount} po`);
const fullCasterSlots = t("2 level 1 slots", "2 espacios de nivel 1");

export const classes: ClassData[] = [
  {
    id: "barbarian", name: t("Barbarian", "Bárbaro"), hitDie: 12, primary: ["str"], saves: ["str", "con"],
    skillCount: 2, skillOptions: ["animalHandling", "athletics", "intimidation", "nature", "perception", "survival"],
    armor: t("Light and Medium armor, Shields", "Armadura ligera y media, escudos"),
    weapons: t("Simple and Martial weapons", "Armas sencillas y marciales"), weaponMasteries: 2,
    effects: [{ kind: "unarmoredDefense", add: ["con"] }],
    features: [t("Rage", "Furia"), t("Unarmored Defense", "Defensa sin armadura"), t("Weapon Mastery", "Maestría con armas")],
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
    features: [t("Bardic Inspiration", "Inspiración bárdica"), t("Spellcasting", "Lanzamiento de conjuros")],
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
    features: [t("Spellcasting", "Lanzamiento de conjuros"), t("Divine Order", "Orden divina")],
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
    features: [t("Spellcasting", "Lanzamiento de conjuros"), t("Druidic", "Druídico"), t("Primal Order", "Orden primordial")],
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
    features: [t("Fighting Style", "Estilo de combate"), t("Second Wind", "Tomar aliento"), t("Weapon Mastery", "Maestría con armas")],
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
    effects: [{ kind: "unarmoredDefense", add: ["wis"] }],
    features: [t("Martial Arts", "Artes marciales"), t("Unarmored Defense", "Defensa sin armadura")],
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
    features: [t("Lay On Hands", "Imposición de manos"), t("Spellcasting", "Lanzamiento de conjuros"), t("Weapon Mastery", "Maestría con armas")],
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
    features: [t("Spellcasting", "Lanzamiento de conjuros"), t("Favored Enemy", "Enemigo predilecto"), t("Weapon Mastery", "Maestría con armas")],
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
    features: [t("Expertise", "Pericia"), t("Sneak Attack", "Ataque furtivo"), t("Thieves' Cant", "Jerga de ladrones"), t("Weapon Mastery", "Maestría con armas")],
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
    features: [t("Spellcasting", "Lanzamiento de conjuros"), t("Innate Sorcery", "Hechicería innata")],
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
    features: [t("Eldritch Invocations", "Invocaciones sobrenaturales"), t("Pact Magic", "Magia del pacto")],
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
    features: [t("Spellcasting", "Lanzamiento de conjuros"), t("Ritual Adept", "Adepto de rituales"), t("Arcane Recovery", "Recuperación arcana")],
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

export type SpeciesId = "aasimar" | "dragonborn" | "dwarf" | "elf" | "gnome" | "goliath" | "halfling" | "human" | "orc" | "tiefling";
export interface Lineage { id: string; name: Text; detail?: Text; speed?: number; darkvision?: number }
export interface SpeciesData {
  id: SpeciesId;
  name: Text;
  size: Text;
  speed: number;
  darkvision?: number;
  traits: Text[];
  lineageLabel?: Text;
  lineages?: Lineage[];
  /** Number of extra skills chosen from the given list (empty = any). */
  skillChoice?: { count: number; options: SkillKey[] };
  /** Human Versatile: choose an origin feat. */
  originFeat?: boolean;
  /** Mechanics of the species traits (see effects.ts). */
  effects?: Effect[];
}

export const species: SpeciesData[] = [
  {
    id: "aasimar", name: t("Aasimar", "Aasimar"), size: t("Medium or Small", "Mediano o pequeño"), speed: 30, darkvision: 60,
    traits: [t("Celestial Resistance", "Resistencia celestial"), t("Healing Hands", "Manos curativas"), t("Light Bearer", "Portador de luz"), t("Celestial Revelation (level 3)", "Revelación celestial (nivel 3)")],
  },
  {
    id: "dragonborn", name: t("Dragonborn", "Dracónido"), size: t("Medium", "Mediano"), speed: 30, darkvision: 60,
    traits: [t("Breath Weapon", "Arma de aliento"), t("Damage Resistance", "Resistencia al daño"), t("Draconic Flight (level 5)", "Vuelo dracónico (nivel 5)")],
    lineageLabel: t("Draconic Ancestry", "Ascendencia dracónica"),
    lineages: [
      ["black", "Black", "Negro", "Acid", "Ácido"], ["blue", "Blue", "Azul", "Lightning", "Relámpago"], ["brass", "Brass", "Latón", "Fire", "Fuego"],
      ["bronze", "Bronze", "Bronce", "Lightning", "Relámpago"], ["copper", "Copper", "Cobre", "Acid", "Ácido"], ["gold", "Gold", "Oro", "Fire", "Fuego"],
      ["green", "Green", "Verde", "Poison", "Veneno"], ["red", "Red", "Rojo", "Fire", "Fuego"], ["silver", "Silver", "Plata", "Cold", "Frío"], ["white", "White", "Blanco", "Cold", "Frío"],
    ].map(([id, en, es, den, des]) => ({ id, name: t(en, es), detail: t(den, des) })),
  },
  {
    id: "dwarf", name: t("Dwarf", "Enano"), size: t("Medium", "Mediano"), speed: 30, darkvision: 120, effects: [{ kind: "hpPerLevel", amount: 1 }],
    traits: [t("Dwarven Resilience", "Resistencia enana"), t("Dwarven Toughness", "Dureza enana"), t("Stonecunning", "Afinidad con la piedra")],
  },
  {
    id: "elf", name: t("Elf", "Elfo"), size: t("Medium", "Mediano"), speed: 30, darkvision: 60,
    traits: [t("Fey Ancestry", "Linaje feérico"), t("Keen Senses", "Sentidos agudos"), t("Trance", "Trance")],
    lineageLabel: t("Elven Lineage", "Linaje élfico"),
    lineages: [
      { id: "drow", name: t("Drow", "Drow"), detail: t("Darkvision 120 ft.", "Visión en la oscuridad 120 pies"), darkvision: 120 },
      { id: "high", name: t("High Elf", "Alto elfo"), detail: t("Prestidigitation cantrip", "Truco Prestidigitación") },
      { id: "wood", name: t("Wood Elf", "Elfo de los bosques"), detail: t("Speed 35 ft.", "Velocidad 35 pies"), speed: 35 },
    ],
    skillChoice: { count: 1, options: ["insight", "perception", "survival"] },
  },
  {
    id: "gnome", name: t("Gnome", "Gnomo"), size: t("Small", "Pequeño"), speed: 30, darkvision: 60,
    traits: [t("Gnomish Cunning", "Astucia gnoma")],
    lineageLabel: t("Gnomish Lineage", "Linaje gnomo"),
    lineages: [
      { id: "forest", name: t("Forest Gnome", "Gnomo de los bosques"), detail: t("Minor Illusion, Speak with Animals", "Ilusión menor, Hablar con los animales") },
      { id: "rock", name: t("Rock Gnome", "Gnomo de las rocas"), detail: t("Mending, Prestidigitation, tinkering", "Reparar, Prestidigitación, artilugios") },
    ],
  },
  {
    id: "goliath", name: t("Goliath", "Goliat"), size: t("Medium", "Mediano"), speed: 35,
    traits: [t("Large Form (level 5)", "Forma grande (nivel 5)"), t("Powerful Build", "Complexión poderosa")],
    lineageLabel: t("Giant Ancestry", "Ascendencia gigante"),
    lineages: [
      ["cloud", "Cloud's Jaunt", "Paso de las nubes"], ["fire", "Fire's Burn", "Quemadura de fuego"], ["frost", "Frost's Chill", "Gélido de escarcha"],
      ["hill", "Hill's Tumble", "Derribo de colina"], ["stone", "Stone's Endurance", "Aguante de piedra"], ["storm", "Storm's Thunder", "Trueno de tormenta"],
    ].map(([id, en, es]) => ({ id, name: t(en, es) })),
  },
  {
    id: "halfling", name: t("Halfling", "Mediano"), size: t("Small", "Pequeño"), speed: 30,
    traits: [t("Brave", "Valiente"), t("Halfling Nimbleness", "Agilidad mediana"), t("Luck", "Suerte"), t("Naturally Stealthy", "Sigiloso por naturaleza")],
  },
  {
    id: "human", name: t("Human", "Humano"), size: t("Medium or Small", "Mediano o pequeño"), speed: 30,
    traits: [t("Resourceful", "Ingenioso"), t("Skillful", "Hábil"), t("Versatile", "Versátil")],
    skillChoice: { count: 1, options: [] }, originFeat: true,
  },
  {
    id: "orc", name: t("Orc", "Orco"), size: t("Medium", "Mediano"), speed: 30, darkvision: 120,
    traits: [t("Adrenaline Rush", "Subidón de adrenalina"), t("Relentless Endurance", "Aguante incansable")],
  },
  {
    id: "tiefling", name: t("Tiefling", "Tiflin"), size: t("Medium or Small", "Mediano o pequeño"), speed: 30, darkvision: 60,
    traits: [t("Otherworldly Presence", "Presencia de otro mundo")],
    lineageLabel: t("Fiendish Legacy", "Legado infernal"),
    lineages: [
      { id: "abyssal", name: t("Abyssal", "Abisal"), detail: t("Poison resistance", "Resistencia al veneno") },
      { id: "chthonic", name: t("Chthonic", "Ctónico"), detail: t("Necrotic resistance", "Resistencia al daño necrótico") },
      { id: "infernal", name: t("Infernal", "Infernal"), detail: t("Fire resistance", "Resistencia al fuego") },
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
