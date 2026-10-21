/**
 * Spanish vocabulary for the structured fields of SRD stat blocks. The upstream API only
 * serves English, so names and trait/action descriptions stay as received; only the fixed
 * rules terms (size, type, alignment, speeds, senses, damage types, conditions, languages)
 * are translated here.
 */
const dictionaries = {
  size: { tiny: "diminuta", small: "pequeña", medium: "mediana", large: "grande", huge: "enorme", gargantuan: "gargantuesca" },
  type: {
    aberrations: "aberraciones", aberration: "aberración", beasts: "bestias", beast: "bestia", celestials: "celestiales", celestial: "celestial",
    constructs: "constructos", construct: "constructo", dragons: "dragones", dragon: "dragón", elementals: "elementales", elemental: "elemental",
    fey: "feérico", fiends: "infernales", fiend: "infernal", giants: "gigantes", giant: "gigante", humanoids: "humanoides", humanoid: "humanoide",
    monstrosities: "monstruosidades", monstrosity: "monstruosidad", oozes: "cienos", ooze: "cieno", plants: "plantas", plant: "planta",
    undead: "muerto viviente", swarm: "enjambre", of: "de", tiny: "diminutas", small: "pequeñas", medium: "medianas", large: "grandes", huge: "enormes", gargantuan: "gargantuescas", "any race": "de cualquier raza", race: "raza", any: "cualquier",
  },
  alignment: {
    "any non-good alignment": "cualquier alineamiento no bueno", "any non-lawful alignment": "cualquier alineamiento no legal",
    "any non-evil alignment": "cualquier alineamiento no malvado", "any chaotic alignment": "cualquier alineamiento caótico",
    "any evil alignment": "cualquier alineamiento malvado", "any alignment": "cualquier alineamiento", unaligned: "sin alineamiento",
    lawful: "legal", chaotic: "caótico", neutral: "neutral", good: "bueno", evil: "malvado", typically: "normalmente", usually: "normalmente",
    often: "a menudo", always: "siempre", "or": "o", and: "y",
  },
  speed: { walk: "caminar", fly: "volar", swim: "nadar", climb: "trepar", burrow: "excavar", hover: "flotar" },
  sense: {
    darkvision: "visión en la oscuridad", blindsight: "vista ciega", tremorsense: "sentido de vibraciones", truesight: "visión verdadera",
    passive_perception: "Percepción pasiva",
  },
  damage: {
    acid: "ácido", bludgeoning: "contundente", cold: "frío", fire: "fuego", force: "fuerza", lightning: "relámpago", necrotic: "necrótico",
    piercing: "perforante", poison: "veneno", psychic: "psíquico", radiant: "radiante", slashing: "cortante", thunder: "trueno",
    "from nonmagical attacks": "de ataques no mágicos", "that aren't silvered": "que no sean de plata", "that aren't adamantine": "que no sean de adamantina",
    nonmagical: "no mágicos", attacks: "ataques", and: "y", or: "o",
  },
  condition: {
    blinded: "cegado", charmed: "hechizado", deafened: "ensordecido", exhaustion: "agotamiento", frightened: "asustado", grappled: "agarrado",
    incapacitated: "incapacitado", invisible: "invisible", paralyzed: "paralizado", petrified: "petrificado", poisoned: "envenenado",
    prone: "derribado", restrained: "apresado", stunned: "aturdido", unconscious: "inconsciente",
  },
  language: {
    "deep speech": "habla profunda", "thieves' cant": "jerga de ladrones", "common sign language": "lengua de signos común", common: "común",
    draconic: "dracónico", dwarvish: "enano", elvish: "élfico", giant: "gigante", gnomish: "gnomo", goblin: "goblin", halfling: "mediano",
    orc: "orco", abyssal: "abisal", celestial: "celestial", infernal: "infernal", primordial: "primordial", sylvan: "silvano",
    undercommon: "infracomún", aquan: "acuano", auran: "áurico", ignan: "ígneo", terran: "térrico", druidic: "druídico",
    telepathy: "telepatía", understands: "entiende", "but can't speak": "pero no puede hablar", "but can't speak it": "pero no puede hablarlo",
    "plus": "más", "any one language": "un idioma cualquiera", "any two languages": "dos idiomas cualesquiera", none: "ninguno",
    "(usually common)": "(normalmente común)", "usually common": "normalmente común", "and": "y", "ft.": "pies", "ft": "pies",
  },
} satisfies Record<string, Record<string, string>>;

export type VocabularyKind = keyof typeof dictionaries;

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = new Map<VocabularyKind, RegExp>();

function patternFor(kind: VocabularyKind) {
  let pattern = patterns.get(kind);
  if (!pattern) {
    const terms = Object.keys(dictionaries[kind]).sort((a, b) => b.length - a.length).map(escape);
    pattern = new RegExp(`(?<![\\p{L}'])(${terms.join("|")})(?![\\p{L}])`, "giu");
    patterns.set(kind, pattern);
  }
  return pattern;
}

/** Replace every known English rules term in `text`; unknown words are left untouched. */
export function translateTerms(kind: VocabularyKind, text: string | undefined, locale: "en" | "es"): string {
  if (!text || locale === "en") return text ?? "";
  const dictionary: Record<string, string> = dictionaries[kind];
  return text.replace(patternFor(kind), (match) => dictionary[match.toLowerCase()] ?? match).replace(/\b(\d+)\s*ft\.?/g, "$1 pies");
}

const abilityAbbreviations: Record<string, string> = { STR: "FUE", DEX: "DES", CON: "CON", INT: "INT", WIS: "SAB", CHA: "CAR" };
export const translateAbility = (abbreviation: string, locale: "en" | "es") => (locale === "es" ? abilityAbbreviations[abbreviation.toUpperCase()] ?? abbreviation : abbreviation);
