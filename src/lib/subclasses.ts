/**
 * Every subclass in the 2024 Player's Handbook, four per class, so players can pick theirs from a list.
 * The SRD subclass (CC-BY-4.0) has its features in levelup-data.ts; the others are names plus a one-line
 * pitch written in our own words, and `features` once their mechanics are added (summaries, never book text).
 */
import { findClass, type ClassId, type Text } from "./dnd2024";
import type { Progression } from "./levelup-data";

// Features of tracked Player's Handbook subclasses are written with `feature` from dnd2024.ts (see docs/subclass-features.md).

const t = (en: string, es: string): Text => ({ en, es });

export interface SubclassInfo {
  id: string;
  name: Text;
  pitch: Text;
  /** Published in the free SRD 5.2, with features tracked by Grimoire. */
  srd?: boolean;
  /** Features by level (3-20) with their effects, for Player's Handbook subclasses Grimoire tracks. */
  features?: Progression;
}

/** Whether Grimoire knows the subclass's features (and applies their effects). */
export const subclassTracked = (entry: SubclassInfo): boolean => !!entry.srd || !!entry.features;

const s = (id: string, en: string, es: string, pitchEn: string, pitchEs: string, srd = false, features?: Progression): SubclassInfo =>
  ({ id, name: t(en, es), pitch: t(pitchEn, pitchEs), ...(srd ? { srd } : {}), ...(features ? { features } : {}) });

export const subclassCatalog: Record<ClassId, SubclassInfo[]> = {
  barbarian: [
    s("berserker", "Path of the Berserker", "Senda del Berserker", "Pure, reckless violence: hit harder the angrier you get.", "Violencia pura y temeraria: pegas más fuerte cuanto más te enfureces.", true),
    s("wildHeart", "Path of the Wild Heart", "Senda del Corazón Salvaje", "Channel animal spirits like the bear, eagle and wolf.", "Canalizas espíritus animales como el oso, el águila y el lobo."),
    s("worldTree", "Path of the World Tree", "Senda del Árbol del Mundo", "Draw on the cosmic tree to protect allies and reposition foes.", "Recurres al árbol cósmico para proteger aliados y mover enemigos."),
    s("zealot", "Path of the Zealot", "Senda del Fanático", "A divine warrior whose god won't let them die easily.", "Un guerrero divino al que su dios no deja morir con facilidad."),
  ],
  bard: [
    s("dance", "College of Dance", "Colegio de la Danza", "An agile, unarmored dancer who fights with graceful moves.", "Un bailarín ágil y sin armadura que lucha con movimientos elegantes."),
    s("glamour", "College of Glamour", "Colegio del Glamour", "Fey-touched charm that dazzles crowds and bolsters allies.", "Un encanto feérico que deslumbra a las multitudes y refuerza a los aliados."),
    s("lore", "College of Lore", "Colegio del Saber", "A collector of secrets who undercuts enemies with sharp words.", "Un coleccionista de secretos que socava a sus enemigos con palabras afiladas.", true),
    s("valor", "College of Valor", "Colegio del Valor", "A battle bard who inspires warriors and fights in the front line.", "Un bardo de batalla que inspira a los guerreros y lucha en primera línea."),
  ],
  cleric: [
    s("life", "Life Domain", "Dominio de la Vida", "The classic healer, keeping the party on its feet.", "El sanador clásico, que mantiene al grupo en pie.", true),
    s("light", "Light Domain", "Dominio de la Luz", "Wield fire and radiance to burn foes and blind attackers.", "Empuña fuego y luz radiante para quemar enemigos y cegar atacantes."),
    s("trickery", "Trickery Domain", "Dominio del Engaño", "A sly priest of illusions, stealth and misdirection.", "Un sacerdote astuto de ilusiones, sigilo y engaños."),
    s("war", "War Domain", "Dominio de la Guerra", "A holy champion who strikes more often and more precisely.", "Un campeón sagrado que ataca más a menudo y con más precisión."),
  ],
  druid: [
    s("land", "Circle of the Land", "Círculo de la Tierra", "Spells shaped by the land you're bound to: arid, polar, temperate or tropical.", "Conjuros moldeados por la tierra a la que estás ligado: árida, polar, templada o tropical.", true),
    s("moon", "Circle of the Moon", "Círculo de la Luna", "Master shapeshifter whose Wild Shape forms are tough fighters.", "Maestro cambiaformas cuyas formas salvajes son combatientes duros."),
    s("sea", "Circle of the Sea", "Círculo del Mar", "Call storms and waves around you to batter enemies.", "Invoca tormentas y olas a tu alrededor para golpear a tus enemigos."),
    s("stars", "Circle of the Stars", "Círculo de las Estrellas", "Take on starry forms to shoot, heal or read omens.", "Adopta formas estelares para disparar, sanar o leer augurios."),
  ],
  fighter: [
    s("battleMaster", "Battle Master", "Maestro del Combate", "A tactician with special maneuvers to trip, push and command.", "Un táctico con maniobras especiales para derribar, empujar y dar órdenes."),
    s("champion", "Champion", "Campeón", "Simple and strong: more critical hits and great athleticism.", "Sencillo y fuerte: más golpes críticos y gran atletismo.", true),
    s("eldritchKnight", "Eldritch Knight", "Caballero Arcano", "Mixes swordplay with wizard spells.", "Combina el manejo de la espada con conjuros de mago."),
    s("psiWarrior", "Psi Warrior", "Guerrero Psiónico", "Psionic power to shield allies, push foes and fly.", "Poder psiónico para proteger aliados, empujar enemigos y volar."),
  ],
  monk: [
    s("mercy", "Warrior of Mercy", "Guerrero de la Misericordia", "Heals with one hand and harms with the other.", "Sana con una mano y daña con la otra."),
    s("openHand", "Warrior of the Open Hand", "Guerrero de la Mano Abierta", "Martial arts master who knocks foes around with each strike.", "Maestro de artes marciales que zarandea a sus enemigos con cada golpe.", true),
    s("shadow", "Warrior of Shadow", "Guerrero de la Sombra", "A ninja-like warrior who hides and teleports through darkness.", "Un guerrero al estilo ninja que se oculta y se teletransporta por la oscuridad."),
    s("elements", "Warrior of the Elements", "Guerrero de los Elementos", "Strikes with elemental force and reach.", "Golpea con fuerza elemental y mayor alcance."),
  ],
  paladin: [
    s("ancients", "Oath of the Ancients", "Juramento de los Antiguos", "Protector of light and life, tied to the fey and nature.", "Protector de la luz y la vida, ligado a las hadas y a la naturaleza."),
    s("devotion", "Oath of Devotion", "Juramento de Devoción", "The classic knight in shining armor, bound to honesty and duty.", "El clásico caballero de brillante armadura, ligado a la honestidad y el deber.", true),
    s("glory", "Oath of Glory", "Juramento de Gloria", "A heroic athlete destined for legendary deeds.", "Un atleta heroico destinado a hazañas legendarias."),
    s("vengeance", "Oath of Vengeance", "Juramento de Venganza", "A relentless hunter of those who have done great wrongs.", "Un cazador implacable de quienes han cometido grandes males."),
  ],
  ranger: [
    s("beastMaster", "Beast Master", "Señor de las Bestias", "Fights alongside a primal animal companion.", "Lucha junto a un compañero animal primigenio."),
    s("feyWanderer", "Fey Wanderer", "Trotamundos Feérico", "Touched by the Feywild, charming and beguiling foes.", "Tocado por el Feywild, encanta y confunde a sus enemigos."),
    s("gloomStalker", "Gloom Stalker", "Acechador en la Penumbra", "Ambush hunter who thrives in darkness and strikes first.", "Cazador emboscado que se crece en la oscuridad y ataca primero."),
    s("hunter", "Hunter", "Cazador", "Specialized monster slayer with flexible combat tactics.", "Cazador de monstruos especializado con tácticas de combate flexibles.", true),
  ],
  rogue: [
    s("arcaneTrickster", "Arcane Trickster", "Embaucador Arcano", "Uses illusion and enchantment magic to steal and deceive.", "Usa magia de ilusión y encantamiento para robar y engañar."),
    s("assassin", "Assassin", "Asesino", "Master of disguise and deadly first strikes.", "Maestro del disfraz y de los primeros golpes letales."),
    s("soulknife", "Soulknife", "Cuchilla Anímica", "Manifests psychic blades and reads minds.", "Manifiesta cuchillas psíquicas y lee mentes."),
    s("thief", "Thief", "Ladrón", "Quick hands, climbing and using items in a hurry.", "Manos rápidas, escalada y uso de objetos a toda prisa.", true),
  ],
  sorcerer: [
    s("aberrant", "Aberrant Sorcery", "Hechicería Aberrante", "Psionic powers from an alien influence.", "Poderes psiónicos de una influencia alienígena."),
    s("clockwork", "Clockwork Sorcery", "Hechicería Mecánica", "Order-born magic that cancels luck and bad rolls.", "Magia nacida del orden que anula la suerte y las malas tiradas."),
    s("draconic", "Draconic Sorcery", "Hechicería Dracónica", "Dragon blood grants tough scales and elemental power.", "La sangre de dragón da escamas resistentes y poder elemental.", true),
    s("wildMagic", "Wild Magic Sorcery", "Hechicería de Magia Salvaje", "Chaotic magic that can surge unpredictably.", "Magia caótica que puede desbordarse de forma impredecible."),
  ],
  warlock: [
    s("archfey", "Archfey Patron", "Patrón Archifeérico", "A fey lord's pact: teleporting and beguiling magic.", "Pacto con un señor feérico: magia de teletransporte y embelesamiento."),
    s("celestial", "Celestial Patron", "Patrón Celestial", "A heavenly pact that grants healing light.", "Un pacto celestial que concede luz sanadora."),
    s("fiend", "Fiend Patron", "Patrón Infernal", "A deal with a devil or demon for fire and toughness.", "Un trato con un diablo o demonio a cambio de fuego y resistencia.", true),
    s("greatOldOne", "Great Old One Patron", "Patrón Primigenio", "Alien knowledge, telepathy and maddening magic.", "Conocimiento alienígena, telepatía y magia enloquecedora."),
  ],
  wizard: [
    s("abjurer", "Abjurer", "Abjurador", "Expert in protective wards and counterspells.", "Experto en salvaguardas protectoras y contraconjuros."),
    s("diviner", "Diviner", "Adivino", "Sees the future and bends fate with omens.", "Ve el futuro y altera el destino con presagios."),
    s("evoker", "Evoker", "Evocador", "Master of destructive spells like Fireball.", "Maestro de conjuros destructivos como Bola de fuego.", true),
    s("illusionist", "Illusionist", "Ilusionista", "Creates convincing illusions that can become real.", "Crea ilusiones convincentes que pueden volverse reales."),
  ],
};

/** Subclasses for a class, with the SRD one first. */
export const subclassesFor = (classId: ClassId): SubclassInfo[] =>
  [...(subclassCatalog[classId] ?? [])].sort((a, b) => Number(!!b.srd) - Number(!!a.srd));

/** A Player's Handbook subclass that isn't the class's SRD one. */
export const findBookSubclass = (classId: ClassId, id: string | undefined): SubclassInfo | undefined =>
  id ? subclassCatalog[classId]?.find((entry) => entry.id === id && !entry.srd) : undefined;

/** Sanity check that the SRD entry here matches the class data; used by tests. */
export const srdSubclassMatches = (classId: ClassId): boolean =>
  subclassCatalog[classId].find((entry) => entry.srd)?.name.en === findClass(classId)?.subclass.en;
