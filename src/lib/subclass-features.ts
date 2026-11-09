/**
 * Level-by-level features of the 2024 Player's Handbook subclasses that aren't in the SRD (the SRD ones live in
 * levelup-data.ts). Feature names follow the book; the tips are our own plain-language summaries, not rules text.
 * Keyed by the subclass id in subclasses.ts, which attaches them as each subclass's `features`. A feature that
 * changes the sheet or asks for a choice lists its `effects` (see effects.ts and docs/subclass-features.md).
 */
import { feature as f } from "./dnd2024";
import type { Progression } from "./levelup-data";

export const bookSubclassFeatures: Record<string, Progression> = {
  // --- Barbarian ---------------------------------------------------------------------------------------------------
  wildHeart: {
    3: [f("Animal Speaker", "Hablante animal", "Cast Beast Sense and Speak with Animals as rituals.", "Lanzas Sentido de bestia y Hablar con los animales como rituales."),
      f("Rage of the Wild", "Furia de lo salvaje", "Each Rage, pick Bear (resist almost all damage), Eagle (Dash and Disengage as a bonus action) or Wolf (allies get advantage against enemies next to you).", "En cada furia eliges Oso (resistes casi todo el daño), Águila (Correr y Retirarse con acción adicional) o Lobo (tus aliados tienen ventaja contra enemigos junto a ti).")],
    6: [f("Aspect of the Wild", "Aspecto de lo salvaje", "Pick Owl (darkvision), Panther (climb speed) or Salmon (swim speed); change it after a Long Rest.", "Eliges Búho (visión en la oscuridad), Pantera (velocidad trepando) o Salmón (velocidad nadando); se cambia tras un descanso largo.")],
    10: [f("Nature Speaker", "Hablante de la naturaleza", "Cast Commune with Nature as a ritual.", "Lanzas Comunión con la naturaleza como ritual.")],
    14: [f("Power of the Wild", "Poder de lo salvaje", "While raging, pick Falcon (fly), Lion (enemies near you struggle to attack others) or Ram (knock foes prone).", "En furia eliges Halcón (vuelas), León (a los enemigos cercanos les cuesta atacar a otros) o Carnero (derribas enemigos).")],
  },
  worldTree: {
    3: [f("Vitality of the Tree", "Vitalidad del árbol", "Gain temporary HP when you Rage, and hand out temporary HP to an ally each turn while raging.", "Ganas PG temporales al entrar en furia y das PG temporales a un aliado cada turno mientras dura.")],
    6: [f("Branches of the Tree", "Ramas del árbol", "Use your reaction to pull a creature you can see next to you and stop it moving.", "Usas tu reacción para atraer a una criatura junto a ti y frenar su movimiento.")],
    10: [f("Battering Roots", "Raíces arrolladoras", "Heavy and Versatile weapons get 10 more feet of reach, and you can add Push or Topple to your hits.", "Las armas pesadas y versátiles ganan 10 pies de alcance, y puedes añadir Empujar o Derribar a tus golpes.")],
    14: [f("Travel along the Tree", "Viaje por el árbol", "Teleport when you Rage and as a bonus action; once per Rage, take allies with you much farther.", "Te teletransportas al entrar en furia y con acción adicional; una vez por furia llevas aliados mucho más lejos.")],
  },
  zealot: {
    3: [f("Divine Fury", "Furia divina", "While raging, your first hit each turn deals extra radiant or necrotic damage.", "En furia, tu primer golpe de cada turno hace daño radiante o necrótico extra."),
      f("Warrior of the Gods", "Guerrero de los dioses", "A pool of d12s you spend as a bonus action to heal yourself.", "Una reserva de d12 que gastas con acción adicional para curarte.")],
    6: [f("Fanatical Focus", "Concentración fanática", "Once per Rage, reroll a failed saving throw with a bonus.", "Una vez por furia, repites una salvación fallida con un bonificador.")],
    10: [f("Zealous Presence", "Presencia fanática", "Let out a battle cry: allies get advantage on attacks and saves until your next turn.", "Lanzas un grito de guerra: tus aliados tienen ventaja en ataques y salvaciones hasta tu siguiente turno.")],
    14: [f("Rage of the Gods", "Furia de los dioses", "Take a divine form when you Rage: fly, resist radiant, necrotic and psychic damage, and keep allies from dropping to 0 HP.", "Adoptas una forma divina al entrar en furia: vuelas, resistes daño radiante, necrótico y psíquico, y evitas que tus aliados caigan a 0 PG.")],
  },

  // --- Bard --------------------------------------------------------------------------------------------------------
  dance: {
    3: [f("Dazzling Footwork", "Juego de pies deslumbrante", "Without armor or shield: AC 10 + Dexterity + Charisma, and spending Bardic Inspiration lets you make an unarmed strike that uses your inspiration die.", "Sin armadura ni escudo: CA 10 + Destreza + Carisma, y al gastar Inspiración bárdica haces un ataque sin armas que usa tu dado de inspiración.")],
    6: [f("Inspiring Movement", "Movimiento inspirador", "When an enemy ends its turn next to you, spend Bardic Inspiration to move away and let an ally move too.", "Cuando un enemigo acaba su turno junto a ti, gastas Inspiración bárdica para alejarte y que un aliado también se mueva."),
      f("Tandem Footwork", "Pasos en tándem", "Spend Bardic Inspiration when rolling Initiative to boost yours and your allies'.", "Gasta Inspiración bárdica al tirar iniciativa para mejorar la tuya y la de tus aliados.")],
    14: [f("Leading Evasion", "Evasión compartida", "You take no damage on a successful Dexterity save, and nearby allies share the benefit.", "No recibes daño si superas una salvación de Destreza, y tus aliados cercanos también se benefician.")],
  },
  glamour: {
    3: [f("Beguiling Magic", "Magia cautivadora", "Charm Person and Mirror Image always prepared; after an Enchantment or Illusion spell, you can charm or frighten someone.", "Siempre tienes preparados Hechizar persona e Imagen múltiple; tras un conjuro de encantamiento o ilusión puedes hechizar o asustar a alguien."),
      f("Mantle of Inspiration", "Manto de inspiración", "Spend Bardic Inspiration to give several allies temporary HP and a free move.", "Gasta Inspiración bárdica para dar PG temporales y un movimiento gratis a varios aliados.")],
    6: [f("Mantle of Majesty", "Manto de majestad", "Command always prepared; for a minute you can cast it as a bonus action every turn.", "Siempre tienes preparado Orden imperiosa; durante un minuto lo lanzas con acción adicional cada turno.")],
    14: [f("Unbreakable Majesty", "Majestad inquebrantable", "For a minute, anyone who tries to attack you may have to pick another target.", "Durante un minuto, quien intente atacarte puede tener que elegir otro objetivo.")],
  },
  valor: {
    3: [f("Combat Inspiration", "Inspiración de combate", "Allies can use your Bardic Inspiration to add damage or to boost their AC against an attack.", "Tus aliados pueden usar tu Inspiración bárdica para sumar daño o mejorar su CA contra un ataque."),
      f("Martial Training", "Entrenamiento marcial", "Martial weapons, Medium armor and Shields; use a weapon as your spellcasting focus.", "Armas marciales, armadura media y escudos; puedes usar un arma como canalizador mágico.")],
    6: [f("Extra Attack", "Ataque adicional", "Attack twice when you take the Attack action; one attack can be a cantrip.", "Atacas dos veces con la acción de Atacar; uno de los ataques puede ser un truco.")],
    14: [f("Battle Magic", "Magia de batalla", "After casting a spell with your action, make a weapon attack as a bonus action.", "Tras lanzar un conjuro con tu acción, haces un ataque con arma con acción adicional.")],
  },

  // --- Cleric ------------------------------------------------------------------------------------------------------
  light: {
    3: [f("Light Domain Spells", "Conjuros del dominio de la Luz", "Always have fire and light spells like Burning Hands, Faerie Fire and Fireball prepared.", "Siempre tienes preparados conjuros de fuego y luz como Manos ardientes, Fuego feérico y Bola de fuego."),
      f("Radiance of the Dawn", "Resplandor del alba", "Channel Divinity: burst of light that dispels magical darkness and burns nearby foes.", "Canalizar divinidad: estallido de luz que disipa la oscuridad mágica y quema a los enemigos cercanos."),
      f("Warding Flare", "Destello protector", "Use your reaction to give an attacker disadvantage, a few times per Long Rest.", "Usa tu reacción para dar desventaja a un atacante, unas cuantas veces por descanso largo.")],
    6: [f("Improved Warding Flare", "Destello protector mejorado", "Warding Flare recovers on a Short Rest and gives the target temporary HP.", "Destello protector se recupera en descanso corto y da PG temporales al objetivo.")],
    17: [f("Corona of Light", "Corona de luz", "Shine like sunlight; enemies near you are worse at resisting your fire and radiant magic.", "Brillas como la luz del sol; a los enemigos cercanos les cuesta más resistir tu magia de fuego y radiante.")],
  },
  trickery: {
    3: [f("Blessing of the Trickster", "Bendición del embaucador", "Give a creature advantage on Stealth checks.", "Das ventaja a una criatura en pruebas de Sigilo."),
      f("Invoke Duplicity", "Invocar duplicidad", "Channel Divinity: create an illusory double you can cast spells through and that distracts enemies.", "Canalizar divinidad: creas un doble ilusorio desde el que lanzas conjuros y que distrae a los enemigos."),
      f("Trickery Domain Spells", "Conjuros del dominio del Engaño", "Always have spells like Disguise Self, Invisibility and Pass without Trace prepared.", "Siempre tienes preparados conjuros como Disfrazarse, Invisibilidad y Pasar sin rastro.")],
    6: [f("Trickster's Transposition", "Transposición del embaucador", "Swap places with your illusory double.", "Intercambias tu posición con tu doble ilusorio.")],
    17: [f("Improved Duplicity", "Duplicidad mejorada", "Allies also get advantage near your double, and it heals someone when it vanishes.", "Tus aliados también tienen ventaja cerca de tu doble, y este cura a alguien al desaparecer.")],
  },
  war: {
    3: [f("Guided Strike", "Golpe guiado", "Channel Divinity: add +10 to an attack roll that just missed.", "Canalizar divinidad: suma +10 a una tirada de ataque que acaba de fallar."),
      f("War Domain Spells", "Conjuros del dominio de la Guerra", "Always have battle spells like Shield of Faith, Spiritual Weapon and Spirit Guardians prepared.", "Siempre tienes preparados conjuros de batalla como Escudo de fe, Arma espiritual y Espíritus guardianes."),
      f("War Priest", "Sacerdote de guerra", "Make a weapon attack as a bonus action a few times per rest.", "Haces un ataque con arma con acción adicional unas cuantas veces por descanso.")],
    6: [f("War God's Blessing", "Bendición del dios de la guerra", "Channel Divinity to cast Shield of Faith or Spiritual Weapon without a spell slot.", "Usa Canalizar divinidad para lanzar Escudo de fe o Arma espiritual sin gastar espacio.")],
    17: [f("Avatar of Battle", "Avatar de batalla", "Resistance to bludgeoning, piercing and slashing damage.", "Resistencia al daño contundente, perforante y cortante.")],
  },

  // --- Druid -------------------------------------------------------------------------------------------------------
  moon: {
    3: [f("Circle Forms", "Formas del círculo", "Wild Shape into tougher beasts, with better AC and more temporary HP.", "Te transformas en bestias más duras, con mejor CA y más PG temporales."),
      f("Circle of the Moon Spells", "Conjuros del Círculo de la Luna", "Always have moon spells like Moonbeam prepared, and cast them while in Wild Shape.", "Siempre tienes preparados conjuros lunares como Rayo de luna, y puedes lanzarlos en Forma salvaje.")],
    6: [f("Improved Circle Forms", "Formas del círculo mejoradas", "Wild Shape attacks can deal radiant damage, and you add Wisdom to Constitution saves.", "Tus ataques en Forma salvaje pueden hacer daño radiante y sumas Sabiduría a las salvaciones de Constitución.")],
    10: [f("Moonlight Step", "Paso de luz de luna", "Teleport as a bonus action and gain advantage on your next attack.", "Te teletransportas con acción adicional y tienes ventaja en tu siguiente ataque.")],
    14: [f("Lunar Form", "Forma lunar", "Extra radiant damage once per turn in Wild Shape; Moonlight Step can bring an ally.", "Daño radiante extra una vez por turno en Forma salvaje; Paso de luz de luna puede llevar a un aliado.")],
  },
  sea: {
    3: [f("Circle of the Sea Spells", "Conjuros del Círculo del Mar", "Always have storm and water spells like Thunderwave and Lightning Bolt prepared.", "Siempre tienes preparados conjuros de tormenta y agua como Onda atronadora y Relámpago."),
      f("Wrath of the Sea", "Ira del mar", "Spend Wild Shape to surround yourself with ocean spray that hurts and pushes enemies.", "Gasta Forma salvaje para rodearte de espuma marina que daña y empuja a los enemigos.")],
    6: [f("Aquatic Affinity", "Afinidad acuática", "Wrath of the Sea grows larger and you gain a swim speed.", "Ira del mar se hace más grande y ganas velocidad nadando.")],
    10: [f("Stormborn", "Nacido de la tormenta", "While Wrath of the Sea is active, fly and resist cold, lightning and thunder.", "Mientras Ira del mar está activa, vuelas y resistes el frío, el relámpago y el trueno.")],
    14: [f("Oceanic Gift", "Don oceánico", "Place Wrath of the Sea on an ally instead of yourself, or on both of you.", "Pones Ira del mar en un aliado en lugar de en ti, o en los dos.")],
  },
  stars: {
    3: [f("Star Map", "Mapa estelar", "Guidance and Guiding Bolt always prepared; cast Guiding Bolt for free a few times per rest.", "Siempre tienes preparados Orientación y Saeta guía; lanzas Saeta guía gratis varias veces por descanso."),
      f("Starry Form", "Forma estelar", "Spend Wild Shape to become a constellation: Archer (radiant bolts), Chalice (extra healing) or Dragon (steady concentration).", "Gasta Forma salvaje para volverte una constelación: Arquero (saetas radiantes), Cáliz (curación extra) o Dragón (concentración firme).")],
    6: [f("Cosmic Omen", "Presagio cósmico", "After each Long Rest, gain a Weal or Woe omen to add or subtract a die from others' rolls.", "Tras cada descanso largo obtienes un presagio de Bienestar o Aflicción para sumar o restar un dado a tiradas ajenas.")],
    10: [f("Twinkling Constellations", "Constelaciones titilantes", "Starry Form gets stronger, the Dragon lets you fly, and you can switch constellations each turn.", "Forma estelar se vuelve más potente, el Dragón te deja volar y puedes cambiar de constelación cada turno.")],
    14: [f("Full of Stars", "Lleno de estrellas", "In Starry Form, resist bludgeoning, piercing and slashing damage.", "En Forma estelar resistes el daño contundente, perforante y cortante.")],
  },

  // --- Fighter -----------------------------------------------------------------------------------------------------
  battleMaster: {
    3: [f("Combat Superiority", "Superioridad en combate", "Learn 3 maneuvers and get 4 d8 Superiority Dice to fuel them; dice return on a Short Rest.", "Aprendes 3 maniobras y tienes 4 dados de superioridad d8 para usarlas; se recuperan en descanso corto."),
      f("Student of War", "Estudiante de la guerra", "Gain proficiency with one artisan's tool and one Fighter skill.", "Ganas competencia con una herramienta de artesano y una habilidad de guerrero.")],
    7: [f("Know Your Enemy", "Conoce a tu enemigo", "Study a creature to learn its resistances, immunities and vulnerabilities. You also learn 2 more maneuvers and get a fifth die.", "Estudias a una criatura para conocer sus resistencias, inmunidades y vulnerabilidades. Además aprendes 2 maniobras más y ganas un quinto dado.")],
    10: [f("Improved Combat Superiority", "Superioridad en combate mejorada", "Superiority Dice become d10s. Learn 2 more maneuvers.", "Los dados de superioridad pasan a ser d10. Aprendes 2 maniobras más.")],
    15: [f("Relentless", "Implacable", "Once per turn, use a maneuver with a d8 instead of spending a die. You get a sixth die and 2 more maneuvers.", "Una vez por turno, usas una maniobra con un d8 sin gastar dado. Ganas un sexto dado y 2 maniobras más.")],
    18: [f("Ultimate Combat Superiority", "Superioridad en combate definitiva", "Superiority Dice become d12s.", "Los dados de superioridad pasan a ser d12.")],
  },
  eldritchKnight: {
    3: [f("Spellcasting", "Lanzamiento de conjuros", "Cast Wizard spells using Intelligence (a third caster: few spells and slots, which Grimoire doesn't count for you).", "Lanzas conjuros de mago con Inteligencia (lanzador de un tercio: pocos conjuros y espacios, que Grimoire no cuenta por ti)."),
      f("War Bond", "Vínculo bélico", "Bond with up to two weapons: summon them to your hand and you can't be disarmed.", "Te vinculas con hasta dos armas: las llamas a tu mano y no pueden desarmarte.")],
    7: [f("War Magic", "Magia de guerra", "Replace one of your attacks with a cantrip.", "Sustituyes uno de tus ataques por un truco.")],
    10: [f("Eldritch Strike", "Golpe sobrenatural", "A creature you hit is worse at resisting your next spell.", "A una criatura que golpeas le cuesta más resistir tu siguiente conjuro.")],
    15: [f("Arcane Charge", "Carga arcana", "Teleport when you use Action Surge.", "Te teletransportas al usar Oleada de acción.")],
    18: [f("Improved War Magic", "Magia de guerra mejorada", "Replace two attacks with a level 1 or 2 spell.", "Sustituyes dos ataques por un conjuro de nivel 1 o 2.")],
  },
  psiWarrior: {
    3: [f("Psionic Power", "Poder psiónico", "Psionic Energy Dice fuel a protective field, extra force damage on hits and telekinetic shoves.", "Los dados de energía psiónica alimentan un campo protector, daño de fuerza extra al golpear y empujones telequinéticos.")],
    7: [f("Telekinetic Adept", "Adepto telequinético", "Leap through the air with psionic flight, and knock foes prone or push them with your strikes.", "Saltas por el aire con vuelo psiónico y derribas o empujas a los enemigos con tus golpes.")],
    10: [f("Guarded Mind", "Mente protegida", "Resist psychic damage and shake off being Charmed or Frightened.", "Resistes el daño psíquico y te libras de estar hechizado o asustado.")],
    15: [f("Bulwark of Force", "Baluarte de fuerza", "Give several allies half cover for a minute.", "Das media cobertura a varios aliados durante un minuto.")],
    18: [f("Telekinetic Master", "Maestro telequinético", "Cast Telekinesis, and make weapon attacks as a bonus action while you hold it.", "Lanzas Telequinesis, y mientras la mantienes haces ataques con arma con acción adicional.")],
  },

  // --- Monk --------------------------------------------------------------------------------------------------------
  mercy: {
    3: [f("Hand of Harm", "Mano dañina", "Spend Focus on a hit for extra necrotic damage.", "Gasta enfoque al golpear para hacer daño necrótico extra."),
      f("Hand of Healing", "Mano sanadora", "Spend Focus to heal a creature, even in place of a Flurry of Blows strike.", "Gasta enfoque para curar a una criatura, incluso en lugar de un golpe de Ráfaga de golpes."),
      f("Implements of Mercy", "Instrumentos de misericordia", "Proficiency in Insight, Medicine and the herbalism kit.", "Competencia en Perspicacia, Medicina y el útil de herborista.")],
    6: [f("Physician's Touch", "Toque de médico", "Hand of Harm also poisons; Hand of Healing also ends a nasty condition.", "Mano dañina también envenena; Mano sanadora también elimina un estado perjudicial.")],
    11: [f("Flurry of Healing and Harm", "Ráfaga de sanación y daño", "Heal with every Flurry of Blows strike, and use Hand of Harm for free a few times.", "Curas con cada golpe de Ráfaga de golpes y usas Mano dañina gratis varias veces.")],
    17: [f("Hand of Ultimate Mercy", "Mano de la misericordia suprema", "Bring a recently dead creature back to life once per Long Rest.", "Devuelves la vida a una criatura que murió hace poco una vez por descanso largo.")],
  },
  shadow: {
    3: [f("Shadow Arts", "Artes sombrías", "Spend Focus to cast Darkness and see through it; gain darkvision and Minor Illusion.", "Gasta enfoque para lanzar Oscuridad y ver a través de ella; ganas visión en la oscuridad e Ilusión menor.")],
    6: [f("Shadow Step", "Paso sombrío", "Teleport between shadows as a bonus action and get advantage on your next melee attack.", "Te teletransportas entre sombras con acción adicional y tienes ventaja en tu siguiente ataque cuerpo a cuerpo.")],
    11: [f("Improved Shadow Step", "Paso sombrío mejorado", "Spend Focus to Shadow Step anywhere and strike right after.", "Gasta enfoque para usar Paso sombrío en cualquier sitio y golpear justo después.")],
    17: [f("Cloak of Shadows", "Manto de sombras", "Become invisible in darkness, move through creatures and objects, and Flurry for free.", "Te vuelves invisible en la oscuridad, atraviesas criaturas y objetos y usas Ráfaga de golpes gratis.")],
  },
  elements: {
    3: [f("Elemental Attunement", "Sintonía elemental", "Spend Focus to give your strikes longer reach, elemental damage and a push or pull.", "Gasta enfoque para dar a tus golpes más alcance, daño elemental y un empujón o atracción."),
      f("Manipulate Elements", "Manipular los elementos", "Learn the Elementalism cantrip.", "Aprendes el truco Elementalismo.")],
    6: [f("Elemental Burst", "Estallido elemental", "Spend Focus to blast an area with elemental energy.", "Gasta enfoque para golpear una zona con energía elemental.")],
    11: [f("Stride of the Elements", "Zancada de los elementos", "While attuned, gain fly and swim speeds.", "Mientras estás en sintonía, ganas velocidad volando y nadando.")],
    17: [f("Elemental Epitome", "Epítome elemental", "While attuned, resist an element, dash with destructive force and add elemental damage to strikes.", "Mientras estás en sintonía, resistes un elemento, te desplazas con fuerza destructiva y sumas daño elemental a tus golpes.")],
  },

  // --- Paladin -----------------------------------------------------------------------------------------------------
  ancients: {
    3: [f("Nature's Wrath", "Ira de la naturaleza", "Channel Divinity: spectral vines restrain nearby enemies.", "Canalizar divinidad: enredaderas espectrales inmovilizan a los enemigos cercanos."),
      f("Oath of the Ancients Spells", "Conjuros del Juramento de los Antiguos", "Always have nature spells like Ensnaring Strike, Misty Step and Moonbeam prepared.", "Siempre tienes preparados conjuros de la naturaleza como Golpe atrapador, Paso brumoso y Rayo de luna.")],
    7: [f("Aura of Warding", "Aura de protección", "You and allies in your aura resist necrotic, psychic and radiant damage.", "Tú y tus aliados en tu aura resistís el daño necrótico, psíquico y radiante.")],
    15: [f("Undying Sentinel", "Centinela imperecedero", "Once per Long Rest, drop to 1 HP instead of 0, and you stop aging.", "Una vez por descanso largo, te quedas a 1 PG en vez de 0, y dejas de envejecer.")],
    20: [f("Elder Champion", "Campeón ancestral", "Transform for a minute: regain HP each turn, cast spells faster and make enemies worse at resisting them.", "Te transformas durante un minuto: recuperas PG cada turno, lanzas conjuros más rápido y a los enemigos les cuesta resistirlos.")],
  },
  glory: {
    3: [f("Inspiring Smite", "Castigo inspirador", "After a Divine Smite, Channel Divinity to share temporary HP among allies.", "Tras un Castigo divino, usas Canalizar divinidad para repartir PG temporales entre aliados."),
      f("Peerless Athlete", "Atleta sin par", "Channel Divinity: advantage on Athletics and Acrobatics and longer jumps for an hour.", "Canalizar divinidad: ventaja en Atletismo y Acrobacias y saltos más largos durante una hora."),
      f("Oath of Glory Spells", "Conjuros del Juramento de Gloria", "Always have heroic spells like Guiding Bolt, Heroism and Haste prepared.", "Siempre tienes preparados conjuros heroicos como Saeta guía, Heroísmo y Acelerar.")],
    7: [f("Aura of Alacrity", "Aura de presteza", "You move faster, and so do allies who start their turn in your aura.", "Te mueves más rápido, igual que los aliados que empiezan su turno en tu aura.")],
    15: [f("Glorious Defense", "Defensa gloriosa", "Use your reaction to add Charisma to someone's AC; if the attack misses, strike back.", "Usas tu reacción para sumar Carisma a la CA de alguien; si el ataque falla, contraatacas.")],
    20: [f("Living Legend", "Leyenda viviente", "Become legendary for 10 minutes: turn a miss into a hit and reroll failed saves.", "Te vuelves legendario durante 10 minutos: conviertes un fallo en impacto y repites salvaciones fallidas.")],
  },
  vengeance: {
    3: [f("Vow of Enmity", "Voto de enemistad", "Channel Divinity: advantage on attacks against one creature for a minute.", "Canalizar divinidad: ventaja en los ataques contra una criatura durante un minuto."),
      f("Oath of Vengeance Spells", "Conjuros del Juramento de Venganza", "Always have hunting spells like Hunter's Mark, Hold Person and Haste prepared.", "Siempre tienes preparados conjuros de caza como Marca del cazador, Inmovilizar persona y Acelerar.")],
    7: [f("Relentless Avenger", "Vengador implacable", "Your opportunity attacks stop the target and let you move freely.", "Tus ataques de oportunidad detienen al objetivo y te dejan moverte libremente.")],
    15: [f("Soul of Vengeance", "Alma de venganza", "Attack your Vow of Enmity target as a reaction when it attacks.", "Atacas con tu reacción al objetivo de tu Voto de enemistad cuando este ataca.")],
    20: [f("Avenging Angel", "Ángel vengador", "Sprout wings and fly, with a terrifying aura, for 10 minutes.", "Te salen alas y vuelas, con un aura aterradora, durante 10 minutos.")],
  },

  // --- Ranger ------------------------------------------------------------------------------------------------------
  beastMaster: {
    3: [f("Primal Companion", "Compañero primigenio", "Gain a loyal beast of the land, sea or sky that grows with you and attacks on your command.", "Ganas una bestia leal de tierra, mar o cielo que crece contigo y ataca cuando se lo ordenas.")],
    7: [f("Exceptional Training", "Entrenamiento excepcional", "Your beast can Dash, Disengage, Dodge or Help, and its attacks can deal force damage.", "Tu bestia puede Correr, Retirarse, Esquivar o Ayudar, y sus ataques pueden hacer daño de fuerza.")],
    11: [f("Bestial Fury", "Furia bestial", "Your beast attacks twice and hits harder against your marked prey.", "Tu bestia ataca dos veces y pega más fuerte a tu presa marcada.")],
    15: [f("Share Spells", "Compartir conjuros", "Spells you cast on yourself also affect your beast.", "Los conjuros que te lanzas a ti también afectan a tu bestia.")],
  },
  feyWanderer: {
    3: [f("Dreadful Strikes", "Golpes terribles", "Once per turn, your weapon hits deal extra psychic damage.", "Una vez por turno, tus golpes con arma hacen daño psíquico extra."),
      f("Fey Wanderer Spells", "Conjuros del trotamundos feérico", "Always have fey spells like Charm Person, Misty Step and Summon Fey prepared.", "Siempre tienes preparados conjuros feéricos como Hechizar persona, Paso brumoso e Invocar feérico."),
      f("Otherworldly Glamour", "Encanto de otro mundo", "Add Wisdom to Charisma checks and gain a social skill.", "Sumas Sabiduría a tus pruebas de Carisma y ganas una habilidad social.")],
    7: [f("Beguiling Twist", "Giro cautivador", "Resist charm and fear, and redirect it to another creature with your reaction.", "Resistes el hechizo y el miedo, y los rediriges a otra criatura con tu reacción.")],
    11: [f("Fey Reinforcements", "Refuerzos feéricos", "Cast Summon Fey for free once per Long Rest, without concentration if you want.", "Lanzas Invocar feérico gratis una vez por descanso largo, sin concentración si quieres.")],
    15: [f("Misty Wanderer", "Trotamundos brumoso", "Cast Misty Step for free several times and bring an ally along.", "Lanzas Paso brumoso gratis varias veces y llevas a un aliado contigo.")],
  },
  gloomStalker: {
    3: [f("Dread Ambusher", "Emboscador temible", "Add Wisdom to Initiative, move faster on your first turn and deal extra psychic damage a few times per rest.", "Sumas Sabiduría a la iniciativa, te mueves más en tu primer turno y haces daño psíquico extra unas cuantas veces por descanso."),
      f("Umbral Sight", "Visión umbría", "Darkvision, and creatures relying on darkvision can't see you in the dark.", "Visión en la oscuridad, y quienes dependen de la visión en la oscuridad no te ven en la penumbra."),
      f("Gloom Stalker Spells", "Conjuros del acechador en la penumbra", "Always have stealthy spells like Disguise Self, Rope Trick and Fear prepared.", "Siempre tienes preparados conjuros sigilosos como Disfrazarse, Truco de la cuerda y Miedo.")],
    7: [f("Iron Mind", "Mente de hierro", "Proficiency in Wisdom saving throws (or Intelligence or Charisma if you already have it).", "Competencia en salvaciones de Sabiduría (o de Inteligencia o Carisma si ya la tienes).")],
    11: [f("Stalker's Flurry", "Ráfaga del acechador", "Dread Ambusher damage grows and can trigger a follow-up attack or spread fear.", "El daño de Emboscador temible aumenta y puede provocar un ataque extra o sembrar el miedo.")],
    15: [f("Shadowy Dodge", "Esquiva sombría", "Use your reaction to give an attack disadvantage and teleport away.", "Usas tu reacción para dar desventaja a un ataque y teletransportarte.")],
  },

  // --- Rogue -------------------------------------------------------------------------------------------------------
  arcaneTrickster: {
    3: [f("Spellcasting", "Lanzamiento de conjuros", "Cast Wizard spells using Intelligence (a third caster: few spells and slots, which Grimoire doesn't count for you).", "Lanzas conjuros de mago con Inteligencia (lanzador de un tercio: pocos conjuros y espacios, que Grimoire no cuenta por ti)."),
      f("Mage Hand Legerdemain", "Prestidigitación de la mano de mago", "Your invisible Mage Hand can pick pockets and locks.", "Tu Mano de mago invisible puede robar bolsillos y abrir cerraduras.")],
    9: [f("Magical Ambush", "Emboscada mágica", "If you're hidden, targets are worse at resisting your spells.", "Si estás oculto, a los objetivos les cuesta más resistir tus conjuros.")],
    13: [f("Versatile Trickster", "Embaucador versátil", "Use your Mage Hand to trip a second creature with Cunning Strike.", "Usas tu Mano de mago para derribar a una segunda criatura con Golpe astuto.")],
    17: [f("Spell Thief", "Ladrón de conjuros", "Stop a spell cast at you and steal it for yourself, once per Long Rest.", "Detienes un conjuro lanzado contra ti y lo robas para ti, una vez por descanso largo.")],
  },
  assassin: {
    3: [f("Assassinate", "Asesinar", "Advantage on Initiative and big extra damage against creatures in the first round.", "Ventaja en la iniciativa y mucho daño extra contra criaturas en el primer asalto."),
      f("Assassin's Tools", "Herramientas del asesino", "Gain a disguise kit and a poisoner's kit and proficiency with both.", "Ganas un útil de disfraz y uno de envenenador, con competencia en ambos.")],
    9: [f("Infiltration Expertise", "Pericia en infiltración", "Mimic voices and handwriting, and move while using Steady Aim.", "Imitas voces y letra, y te puedes mover mientras usas Apuntar con calma.")],
    13: [f("Envenom Weapons", "Envenenar armas", "Your Poison Cunning Strike deals extra poison damage that ignores resistance.", "Tu Golpe astuto de veneno hace daño de veneno extra que ignora la resistencia.")],
    17: [f("Death Strike", "Golpe mortal", "In the first round, your Sneak Attack can deal double damage.", "En el primer asalto, tu Ataque furtivo puede hacer el doble de daño.")],
  },
  soulknife: {
    3: [f("Psionic Power", "Poder psiónico", "Psionic Energy Dice boost failed skill checks and power telepathic messages.", "Los dados de energía psiónica mejoran pruebas fallidas y permiten mensajes telepáticos."),
      f("Psychic Blades", "Cuchillas psíquicas", "Manifest blades of psychic energy to stab or throw, plus a second one as a bonus action.", "Manifiestas cuchillas de energía psíquica para apuñalar o lanzar, y una segunda con acción adicional.")],
    9: [f("Soul Blades", "Cuchillas del alma", "Spend dice to turn a miss into a hit, or throw a blade to teleport.", "Gastas dados para convertir un fallo en impacto o lanzas una cuchilla para teletransportarte.")],
    13: [f("Psychic Veil", "Velo psíquico", "Turn invisible for up to an hour.", "Te vuelves invisible hasta una hora.")],
    17: [f("Rend Mind", "Desgarrar mente", "Your Sneak Attack with psychic blades can stun the target.", "Tu Ataque furtivo con cuchillas psíquicas puede aturdir al objetivo.")],
  },

  // --- Sorcerer ----------------------------------------------------------------------------------------------------
  aberrant: {
    3: [f("Psionic Spells", "Conjuros psiónicos", "Always have mind spells like Dissonant Whispers, Detect Thoughts and Mind Sliver prepared.", "Siempre tienes preparados conjuros mentales como Susurros discordantes, Detectar pensamientos y Astilla mental."),
      f("Telepathic Speech", "Habla telepática", "Form a telepathic link with a creature.", "Creas un vínculo telepático con una criatura.")],
    6: [f("Psionic Sorcery", "Hechicería psiónica", "Cast your psionic spells with Sorcery Points and no visible components.", "Lanzas tus conjuros psiónicos con puntos de hechicería y sin componentes visibles."),
      f("Psychic Defenses", "Defensas psíquicas", "Resist psychic damage; advantage against being Charmed or Frightened.", "Resistes el daño psíquico; ventaja contra ser hechizado o asustado.")],
    14: [f("Revelation in Flesh", "Revelación en la carne", "Spend Sorcery Points to fly, swim, squeeze through gaps or see the invisible.", "Gasta puntos de hechicería para volar, nadar, colarte por huecos o ver lo invisible.")],
    18: [f("Warping Implosion", "Implosión deformante", "Teleport away and crush nearby creatures with force damage.", "Te teletransportas y aplastas con daño de fuerza a las criaturas cercanas.")],
  },
  clockwork: {
    3: [f("Clockwork Spells", "Conjuros mecánicos", "Always have order spells like Aid, Alarm and Protection from Evil and Good prepared.", "Siempre tienes preparados conjuros del orden como Ayuda, Alarma y Protección contra el bien y el mal."),
      f("Restore Balance", "Restaurar el equilibrio", "Use your reaction to cancel advantage or disadvantage on a roll.", "Usas tu reacción para anular la ventaja o desventaja de una tirada.")],
    6: [f("Bastion of Law", "Bastión de la ley", "Spend Sorcery Points to shield a creature with dice that soak up damage.", "Gasta puntos de hechicería para proteger a una criatura con dados que absorben daño.")],
    14: [f("Trance of Order", "Trance del orden", "For a minute, attacks against you can't have advantage and your low d20 rolls count as 10.", "Durante un minuto, los ataques contra ti no tienen ventaja y tus tiradas bajas de d20 cuentan como 10.")],
    18: [f("Clockwork Cavalcade", "Cabalgata mecánica", "Heal allies, repair objects and end spells in a big area.", "Curas aliados, reparas objetos y acabas con conjuros en una zona grande.")],
  },
  wildMagic: {
    3: [f("Wild Magic Surge", "Oleada de magia salvaje", "Your spells can trigger random magical effects.", "Tus conjuros pueden provocar efectos mágicos aleatorios."),
      f("Tides of Chaos", "Mareas del caos", "Give yourself advantage on a roll; it comes back when a surge happens.", "Te das ventaja en una tirada; la recuperas cuando se produce una oleada.")],
    6: [f("Bend Luck", "Torcer la suerte", "Spend a Sorcery Point to add or subtract a d4 from someone's roll.", "Gasta un punto de hechicería para sumar o restar 1d4 a la tirada de alguien.")],
    14: [f("Controlled Chaos", "Caos controlado", "Roll twice on the surge table and pick.", "Tiras dos veces en la tabla de oleadas y eliges.")],
    18: [f("Tamed Surge", "Oleada domada", "Once per Long Rest, choose your surge effect.", "Una vez por descanso largo, eliges el efecto de la oleada.")],
  },

  // --- Warlock -----------------------------------------------------------------------------------------------------
  archfey: {
    3: [f("Archfey Spells", "Conjuros del archifeérico", "Always have fey spells like Faerie Fire, Misty Step and Sleep prepared.", "Siempre tienes preparados conjuros feéricos como Fuego feérico, Paso brumoso y Dormir."),
      f("Steps of the Fey", "Pasos feéricos", "Cast Misty Step for free a few times, with a bonus: heal someone or distract nearby enemies.", "Lanzas Paso brumoso gratis unas cuantas veces, con un extra: curar a alguien o distraer a los enemigos cercanos.")],
    6: [f("Misty Escape", "Huida brumosa", "Misty Step as a reaction when hurt, turning invisible or hurting enemies as you go.", "Lanzas Paso brumoso como reacción al recibir daño, volviéndote invisible o dañando a los enemigos al irte.")],
    10: [f("Beguiling Defenses", "Defensas cautivadoras", "Immune to being Charmed, and turn part of an attack's damage back on the attacker.", "Inmune a ser hechizado, y devuelves parte del daño de un ataque a quien te ataca.")],
    14: [f("Bewitching Magic", "Magia embrujadora", "After an Enchantment or Illusion spell, cast Misty Step for free.", "Tras un conjuro de encantamiento o ilusión, lanzas Paso brumoso gratis.")],
  },
  celestial: {
    3: [f("Celestial Spells", "Conjuros celestiales", "Always have holy spells like Cure Wounds, Guiding Bolt and Revivify prepared.", "Siempre tienes preparados conjuros sagrados como Curar heridas, Saeta guía y Revivir."),
      f("Healing Light", "Luz sanadora", "A pool of d6s you spend as a bonus action to heal.", "Una reserva de d6 que gastas con acción adicional para curar.")],
    6: [f("Radiant Soul", "Alma radiante", "Resist radiant damage and add Charisma to your fire and radiant spell damage.", "Resistes el daño radiante y sumas Carisma al daño de tus conjuros de fuego y radiantes.")],
    10: [f("Celestial Resilience", "Resiliencia celestial", "You and some allies gain temporary HP after resting.", "Tú y algunos aliados ganáis PG temporales tras descansar.")],
    14: [f("Searing Vengeance", "Venganza abrasadora", "When you or an ally is dying, spring back up with HP and blind and burn nearby foes.", "Cuando tú o un aliado estáis muriendo, os levantáis con PG y cegáis y quemáis a los enemigos cercanos.")],
  },
  greatOldOne: {
    3: [f("Awakened Mind", "Mente despierta", "Talk telepathically with a creature over long distances.", "Hablas telepáticamente con una criatura a gran distancia."),
      f("Great Old One Spells", "Conjuros del primigenio", "Always have mind spells like Dissonant Whispers, Hideous Laughter and Hunger of Hadar prepared.", "Siempre tienes preparados conjuros mentales como Susurros discordantes, Risa horrible y Hambre de Hadar."),
      f("Psychic Spells", "Conjuros psíquicos", "Change your Warlock spells' damage to psychic, and cast enchantments and illusions silently.", "Cambias el daño de tus conjuros de brujo a psíquico, y lanzas encantamientos e ilusiones sin componentes.")],
    6: [f("Clairvoyant Combatant", "Combatiente clarividente", "Read a bonded creature's mind: it's worse at hitting you and you're better at hitting it.", "Lees la mente de una criatura vinculada: le cuesta más acertarte y a ti te cuesta menos acertarle.")],
    10: [f("Eldritch Hex", "Maleficio sobrenatural", "Hex always prepared, and it also weakens the target's saving throws.", "Siempre tienes preparado Maleficio, y además debilita las salvaciones del objetivo."),
      f("Thought Shield", "Escudo mental", "Resist psychic damage and reflect it back.", "Resistes el daño psíquico y lo devuelves.")],
    14: [f("Create Thrall", "Crear siervo", "Summon an aberration that serves you without concentration and stays bonded to you.", "Invocas una aberración que te sirve sin concentración y queda vinculada a ti.")],
  },

  // --- Wizard ------------------------------------------------------------------------------------------------------
  abjurer: {
    3: [f("Abjuration Savant", "Erudito de abjuración", "Learn Abjuration spells for free as you level.", "Aprendes conjuros de abjuración gratis al subir de nivel."),
      f("Arcane Ward", "Salvaguarda arcana", "Abjuration spells create a magical ward that absorbs damage for you.", "Tus conjuros de abjuración crean una salvaguarda mágica que absorbe daño por ti.")],
    6: [f("Projected Ward", "Salvaguarda proyectada", "Use your reaction to have your ward absorb damage for an ally.", "Usas tu reacción para que tu salvaguarda absorba daño por un aliado.")],
    10: [f("Spell Breaker", "Rompeconjuros", "Counterspell and Dispel Magic always prepared, and better at ending spells.", "Siempre tienes preparados Contraconjuro y Disipar magia, y eres mejor acabando con conjuros.")],
    14: [f("Spell Resistance", "Resistencia a conjuros", "Advantage on saves against spells and resistance to their damage.", "Ventaja en salvaciones contra conjuros y resistencia a su daño.")],
  },
  diviner: {
    3: [f("Divination Savant", "Erudito de adivinación", "Learn Divination spells for free as you level.", "Aprendes conjuros de adivinación gratis al subir de nivel."),
      f("Portent", "Augurio", "After each Long Rest, roll two d20s and swap them in for any rolls you see.", "Tras cada descanso largo, tiras dos d20 y los usas en lugar de cualquier tirada que veas.")],
    6: [f("Expert Divination", "Adivinación experta", "Casting Divination spells gives you back a lower-level spell slot.", "Lanzar conjuros de adivinación te devuelve un espacio de conjuro de nivel inferior.")],
    10: [f("The Third Eye", "El tercer ojo", "Gain a sense like darkvision, seeing invisible things or reading any language.", "Ganas un sentido como visión en la oscuridad, ver lo invisible o leer cualquier idioma.")],
    14: [f("Greater Portent", "Augurio mayor", "Roll three Portent dice instead of two.", "Tiras tres dados de Augurio en lugar de dos.")],
  },
  illusionist: {
    3: [f("Illusion Savant", "Erudito de ilusión", "Learn Illusion spells for free as you level.", "Aprendes conjuros de ilusión gratis al subir de nivel."),
      f("Improved Illusions", "Ilusiones mejoradas", "Cast illusions silently and farther away; Minor Illusion as a bonus action with sound and image.", "Lanzas ilusiones sin hablar y más lejos; Ilusión menor con acción adicional, con sonido e imagen.")],
    6: [f("Phantasmal Creatures", "Criaturas fantasmales", "Summon Beast and Summon Fey always prepared as illusions, sometimes for free.", "Siempre tienes preparados Invocar bestia e Invocar feérico como ilusiones, a veces gratis.")],
    10: [f("Illusory Self", "Yo ilusorio", "Use your reaction to make an attack miss you automatically.", "Usas tu reacción para que un ataque contra ti falle automáticamente.")],
    14: [f("Illusory Reality", "Realidad ilusoria", "Make one object from your illusion real for a minute.", "Haces real durante un minuto un objeto de tu ilusión.")],
  },
};
