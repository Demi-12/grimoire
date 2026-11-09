/**
 * General feats (level 4+), the extra Fighting Style feats and the extra Epic Boons of the 2024 Player's Handbook
 * beyond the SRD. Names follow the book; the summaries are our own plain-language words, not rules text.
 */
import type { AbilityKey } from "./rules";
import type { FeatInfo } from "./levelup-data";

const t = (en: string, es: string) => ({ en, es });
const mental: AbilityKey[] = ["int", "wis", "cha"];
const physical: AbilityKey[] = ["str", "dex"];
const all: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

const general = (en: string, es: string, abilities: AbilityKey[], sumEn: string, sumEs: string, extra: Partial<FeatInfo> = {}): FeatInfo =>
  ({ category: "general", name: t(en, es), abilities, summary: t(sumEn, sumEs), ...extra });

export type GeneralFeatId =
  | "actor" | "athlete" | "charger" | "chef" | "crossbowExpert" | "crusher" | "defensiveDuelist" | "dualWielder" | "durable"
  | "elementalAdept" | "feyTouched" | "grappler" | "greatWeaponMaster" | "heavilyArmored" | "heavyArmorMaster" | "inspiringLeader"
  | "keenMind" | "lightlyArmored" | "mageSlayer" | "martialWeaponTraining" | "mediumArmorMaster" | "moderatelyArmored"
  | "mountedCombatant" | "observant" | "piercer" | "poisoner" | "polearmMaster" | "resilient" | "ritualCaster" | "sentinel"
  | "shadowTouched" | "sharpshooter" | "shieldMaster" | "skillExpert" | "skulker" | "slasher" | "speedy" | "spellSniper"
  | "telekinetic" | "telepathic" | "warCaster" | "weaponMaster";

export const generalFeats: Record<GeneralFeatId, FeatInfo> = {
  actor: general("Actor", "Actor", ["cha"], "+1 Charisma; advantage when pretending to be someone else, and you can mimic voices.", "+1 a Carisma; ventaja al hacerte pasar por otra persona, y puedes imitar voces.", { requires: ["cha"] }),
  athlete: general("Athlete", "Atleta", physical, "+1 Strength or Dexterity; climb at full speed, stand up quickly and jump with a short run-up.", "+1 a Fuerza o Destreza; trepas a velocidad completa, te levantas rápido y saltas con poca carrerilla.", { requires: physical }),
  charger: general("Charger", "Cargador", physical, "+1 Strength or Dexterity; Dash faster and hit harder or push a foe after charging in a straight line.", "+1 a Fuerza o Destreza; corres más y, tras cargar en línea recta, pegas más fuerte o empujas al enemigo.", { requires: physical }),
  chef: general("Chef", "Chef", ["con", "wis"], "+1 Constitution or Wisdom; cook meals that heal more on rests and treats that give temporary HP.", "+1 a Constitución o Sabiduría; cocinas comidas que curan más al descansar y aperitivos que dan PG temporales."),
  crossbowExpert: general("Crossbow Expert", "Experto en ballestas", ["dex"], "+1 Dexterity; ignore Loading, shoot point-blank without disadvantage and add damage to the off-hand shot.", "+1 a Destreza; ignoras Recarga, disparas a bocajarro sin desventaja y sumas daño al disparo con la otra mano.", { requires: ["dex"] }),
  crusher: general("Crusher", "Aplastador", ["str", "con"], "+1 Strength or Constitution; bludgeoning hits shove foes, and your crits give allies advantage.", "+1 a Fuerza o Constitución; tus golpes contundentes desplazan enemigos, y tus críticos dan ventaja a tus aliados.", { requires: ["str", "con"] }),
  defensiveDuelist: general("Defensive Duelist", "Duelista defensivo", ["dex"], "+1 Dexterity; with a Finesse weapon, use your reaction to add your Proficiency Bonus to AC.", "+1 a Destreza; con un arma sutil, usas tu reacción para sumar tu competencia a la CA.", { requires: ["dex"] }),
  dualWielder: general("Dual Wielder", "Combatiente con dos armas", physical, "+1 Strength or Dexterity; fight with two non-Light weapons, draw two at once and make an extra off-hand attack.", "+1 a Fuerza o Destreza; luchas con dos armas no ligeras, desenvainas dos a la vez y haces un ataque extra con la otra mano.", { requires: physical }),
  durable: general("Durable", "Duradero", ["con"], "+1 Constitution; advantage on death saves and spend Hit Dice to heal as a bonus action.", "+1 a Constitución; ventaja en salvaciones de muerte y gastas dados de golpe para curarte con acción adicional."),
  elementalAdept: general("Elemental Adept", "Adepto elemental", mental, "+1 Int, Wis or Cha; your spells of one damage type ignore resistance and their 1s count as 2s. You can take it again for another type.", "+1 a Int, Sab o Car; tus conjuros de un tipo de daño ignoran la resistencia y sus 1 cuentan como 2. Puedes repetirla con otro tipo.", { requiresCasting: true, repeatable: true }),
  feyTouched: general("Fey Touched", "Tocado por las hadas", mental, "+1 Int, Wis or Cha; learn Misty Step and one level 1 Divination or Enchantment spell, each free once per day.", "+1 a Int, Sab o Car; aprendes Paso brumoso y un conjuro de nivel 1 de adivinación o encantamiento, gratis una vez al día cada uno."),
  grappler: general("Grappler", "Luchador", physical, "+1 Strength or Dexterity, and you get much better at grabbing and pinning enemies.", "+1 a Fuerza o Destreza, y te vuelves mucho mejor agarrando e inmovilizando enemigos.", { requires: physical }),
  greatWeaponMaster: general("Great Weapon Master", "Maestro de armas a dos manos", ["str"], "+1 Strength; Heavy weapon hits deal extra damage, and crits or kills give you a bonus attack.", "+1 a Fuerza; tus golpes con armas pesadas hacen daño extra, y los críticos o las muertes te dan un ataque adicional.", { requires: ["str"] }),
  heavilyArmored: general("Heavily Armored", "Entrenamiento en armadura pesada", ["str", "con"], "+1 Strength or Constitution and training with Heavy armor.", "+1 a Fuerza o Constitución y entrenamiento con armadura pesada.", { requiresArmor: "medium" }),
  heavyArmorMaster: general("Heavy Armor Master", "Maestro en armaduras pesadas", ["str", "con"], "+1 Strength or Constitution; in Heavy armor, reduce weapon damage you take.", "+1 a Fuerza o Constitución; con armadura pesada reduces el daño de armas que recibes.", { requiresArmor: "heavy" }),
  inspiringLeader: general("Inspiring Leader", "Líder inspirador", ["wis", "cha"], "+1 Wisdom or Charisma; give allies temporary HP with a speech after each rest.", "+1 a Sabiduría o Carisma; das PG temporales a tus aliados con un discurso tras cada descanso.", { requires: ["wis", "cha"] }),
  keenMind: general("Keen Mind", "Mente aguda", ["int"], "+1 Intelligence; Expertise in a lore skill and Study as a bonus action.", "+1 a Inteligencia; pericia en una habilidad de conocimiento y Estudiar con acción adicional.", { requires: ["int"] }),
  lightlyArmored: general("Lightly Armored", "Entrenamiento en armadura ligera", physical, "+1 Strength or Dexterity and training with Light armor and Shields.", "+1 a Fuerza o Destreza y entrenamiento con armadura ligera y escudos."),
  mageSlayer: general("Mage Slayer", "Asesino de magos", physical, "+1 Strength or Dexterity; break casters' concentration and shrug off a mental save once per rest.", "+1 a Fuerza o Destreza; rompes la concentración de los lanzadores y superas una salvación mental una vez por descanso."),
  martialWeaponTraining: general("Martial Weapon Training", "Entrenamiento con armas marciales", physical, "+1 Strength or Dexterity and proficiency with Martial weapons.", "+1 a Fuerza o Destreza y competencia con armas marciales."),
  mediumArmorMaster: general("Medium Armor Master", "Maestro en armaduras medias", physical, "+1 Strength or Dexterity; add up to +3 Dexterity to AC in Medium armor.", "+1 a Fuerza o Destreza; sumas hasta +3 de Destreza a la CA con armadura media.", { requiresArmor: "medium" }),
  moderatelyArmored: general("Moderately Armored", "Entrenamiento en armadura media", physical, "+1 Strength or Dexterity and training with Medium armor and Shields.", "+1 a Fuerza o Destreza y entrenamiento con armadura media y escudos.", { requiresArmor: "light" }),
  mountedCombatant: general("Mounted Combatant", "Combatiente montado", ["str", "dex", "wis"], "+1 Str, Dex or Wis; advantage against foes smaller than your mount, and protect your mount.", "+1 a Fue, Des o Sab; ventaja contra enemigos más pequeños que tu montura, y la proteges."),
  observant: general("Observant", "Observador", ["int", "wis"], "+1 Intelligence or Wisdom; Expertise in Insight, Investigation or Perception and Search as a bonus action.", "+1 a Inteligencia o Sabiduría; pericia en Perspicacia, Investigación o Percepción y Buscar con acción adicional.", { requires: ["int", "wis"] }),
  piercer: general("Piercer", "Perforador", physical, "+1 Strength or Dexterity; reroll a piercing damage die, and piercing crits deal an extra die.", "+1 a Fuerza o Destreza; repites un dado de daño perforante, y tus críticos perforantes suman un dado extra."),
  poisoner: general("Poisoner", "Envenenador", ["dex", "int"], "+1 Dexterity or Intelligence; your poison ignores resistance, and you brew potent poison doses.", "+1 a Destreza o Inteligencia; tu veneno ignora la resistencia y preparas dosis de veneno potente."),
  polearmMaster: general("Polearm Master", "Maestro en armas de asta", physical, "+1 Strength or Dexterity; bonus attack with the butt end and strike foes as they come within reach.", "+1 a Fuerza o Destreza; ataque adicional con el regatón y golpeas a quien entra en tu alcance.", { requires: physical }),
  resilient: general("Resilient", "Resiliente", all, "+1 to an ability and proficiency in its saving throws.", "+1 a una característica y competencia en sus salvaciones."),
  ritualCaster: general("Ritual Caster", "Lanzador de rituales", mental, "+1 Int, Wis or Cha; learn ritual spells and cast one quickly once per day.", "+1 a Int, Sab o Car; aprendes conjuros rituales y lanzas uno rápido una vez al día.", { requires: mental }),
  sentinel: general("Sentinel", "Centinela", physical, "+1 Strength or Dexterity; your opportunity attacks stop foes and punish them for attacking your allies.", "+1 a Fuerza o Destreza; tus ataques de oportunidad frenan a los enemigos y los castigan por atacar a tus aliados.", { requires: physical }),
  shadowTouched: general("Shadow Touched", "Tocado por las sombras", mental, "+1 Int, Wis or Cha; learn Invisibility and one level 1 Illusion or Necromancy spell, each free once per day.", "+1 a Int, Sab o Car; aprendes Invisibilidad y un conjuro de nivel 1 de ilusión o nigromancia, gratis una vez al día cada uno."),
  sharpshooter: general("Sharpshooter", "Tirador experto", ["dex"], "+1 Dexterity; ignore cover, shoot far without disadvantage and fire point-blank.", "+1 a Destreza; ignoras la cobertura, disparas lejos sin desventaja y a bocajarro.", { requires: ["dex"] }),
  shieldMaster: general("Shield Master", "Maestro de escudos", ["str"], "+1 Strength; bash with your shield to push or knock foes prone, and take no damage on successful Dexterity saves.", "+1 a Fuerza; golpeas con el escudo para empujar o derribar, y no recibes daño si superas salvaciones de Destreza.", { requiresArmor: "shield" }),
  skillExpert: general("Skill Expert", "Experto en habilidades", all, "+1 to an ability, a new skill and Expertise in one skill.", "+1 a una característica, una habilidad nueva y pericia en una habilidad."),
  skulker: general("Skulker", "Merodeador", ["dex"], "+1 Dexterity; Blindsight 10 ft, stay hidden when you miss and hide in fog or foliage.", "+1 a Destreza; vista ciega 10 pies, sigues oculto al fallar y te escondes entre niebla o follaje.", { requires: ["dex"] }),
  slasher: general("Slasher", "Rajador", physical, "+1 Strength or Dexterity; slashing hits slow foes, and slashing crits weaken their attacks.", "+1 a Fuerza o Destreza; tus golpes cortantes ralentizan, y tus críticos cortantes debilitan sus ataques."),
  speedy: general("Speedy", "Veloz", ["dex", "con"], "+1 Dexterity or Constitution; +10 ft speed, Dash ignores difficult terrain, and opportunity attacks are harder against you.", "+1 a Destreza o Constitución; +10 pies de velocidad, correr ignora el terreno difícil y cuesta más golpearte con ataques de oportunidad.", { requires: ["dex", "con"], effects: [{ kind: "speedBonus", amount: 10 }] }),
  spellSniper: general("Spell Sniper", "Francotirador de conjuros", mental, "+1 Int, Wis or Cha; spell attacks ignore cover, reach farther and work point-blank.", "+1 a Int, Sab o Car; tus ataques de conjuro ignoran la cobertura, llegan más lejos y funcionan a bocajarro.", { requiresCasting: true }),
  telekinetic: general("Telekinetic", "Telequinético", mental, "+1 Int, Wis or Cha; an invisible Mage Hand and a bonus action telekinetic shove.", "+1 a Int, Sab o Car; Mano de mago invisible y un empujón telequinético con acción adicional."),
  telepathic: general("Telepathic", "Telépata", mental, "+1 Int, Wis or Cha; speak telepathically and cast Detect Thoughts once per day.", "+1 a Int, Sab o Car; hablas telepáticamente y lanzas Detectar pensamientos una vez al día."),
  warCaster: general("War Caster", "Lanzador de guerra", mental, "+1 Int, Wis or Cha; advantage to keep concentration and cast a spell as an opportunity attack.", "+1 a Int, Sab o Car; ventaja para mantener la concentración y lanzas un conjuro como ataque de oportunidad.", { requiresCasting: true }),
  weaponMaster: general("Weapon Master", "Maestro de armas", physical, "+1 Strength or Dexterity and the mastery property of one more weapon.", "+1 a Fuerza o Destreza y la propiedad de maestría de un arma más."),
};

export type ExtraFightingStyleId = "blindFighting" | "dueling" | "interception" | "protection" | "thrownWeaponFighting" | "unarmedFighting";

export const extraFightingStyles: Record<ExtraFightingStyleId, FeatInfo> = {
  blindFighting: { category: "fightingStyle", name: t("Blind Fighting", "Combate a ciegas"), summary: t("Blindsight 10 feet.", "Vista ciega 10 pies.") },
  dueling: { category: "fightingStyle", name: t("Dueling", "Duelo"), summary: t("+2 damage with a one-handed melee weapon and no other weapon.", "+2 al daño con un arma cuerpo a cuerpo a una mano y ninguna otra arma.") },
  interception: { category: "fightingStyle", name: t("Interception", "Intercepción"), summary: t("Use your reaction to reduce the damage an ally next to you takes.", "Usa tu reacción para reducir el daño que recibe un aliado junto a ti.") },
  protection: { category: "fightingStyle", name: t("Protection", "Protección"), summary: t("With a shield, use your reaction to give an attack against an ally disadvantage.", "Con escudo, usa tu reacción para dar desventaja a un ataque contra un aliado.") },
  thrownWeaponFighting: { category: "fightingStyle", name: t("Thrown Weapon Fighting", "Combate con armas arrojadizas"), summary: t("+2 damage with thrown weapons, and draw them as part of the attack.", "+2 al daño con armas arrojadizas, y las desenvainas como parte del ataque.") },
  unarmedFighting: { category: "fightingStyle", name: t("Unarmed Fighting", "Combate sin armas"), summary: t("Unarmed Strikes deal d6 (d8 with both hands free) and damage creatures you grapple.", "Tus golpes sin armas hacen d6 (d8 con las manos libres) y dañan a quien agarras.") },
};

export type ExtraEpicBoonId = "energyResistance" | "fortitude" | "recovery" | "skill" | "speed";

export const extraEpicBoons: Record<ExtraEpicBoonId, FeatInfo> = {
  energyResistance: { category: "epicBoon", abilities: all, name: t("Boon of Energy Resistance", "Don de resistencia a la energía"), summary: t("Resist two damage types and redirect that damage to a foe.", "Resistes dos tipos de daño y rediriges ese daño a un enemigo.") },
  fortitude: { category: "epicBoon", abilities: all, effects: [{ kind: "hpBonus", amount: 40 }], name: t("Boon of Fortitude", "Don de fortaleza"), summary: t("+40 Hit Points and extra healing once per turn.", "+40 puntos de golpe y curación extra una vez por turno.") },
  recovery: { category: "epicBoon", abilities: all, name: t("Boon of Recovery", "Don de recuperación"), summary: t("Avoid dropping to 0 HP once per rest and a pool of d10s to heal yourself.", "Evitas caer a 0 PG una vez por descanso y una reserva de d10 para curarte.") },
  skill: { category: "epicBoon", abilities: all, name: t("Boon of Skill", "Don de habilidad"), summary: t("Proficiency in every skill and Expertise in one.", "Competencia en todas las habilidades y pericia en una.") },
  speed: { category: "epicBoon", abilities: all, effects: [{ kind: "speedBonus", amount: 30 }], name: t("Boon of Speed", "Don de velocidad"), summary: t("+30 ft speed, and Disengage as a bonus action that also ends being grappled.", "+30 pies de velocidad, y Retirarse con acción adicional que además te libra de agarres.") },
};
