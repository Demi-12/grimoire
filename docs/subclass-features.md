# Rasgos de subclase y efectos

Cada rasgo de clase, subclase o especie es un `Feature` (`src/lib/dnd2024.ts`): nombre oficial, un resumen de una línea escrito por nosotros y, si cambia algo en la ficha, una lista de `effects`. El motor (`grantedEffects` en `src/lib/character-sheet.ts`) reúne los efectos de la clase, la subclase, la especie y las dotes, y:

- la ficha (`deriveSheet`) aplica los modificadores: `hpPerLevel`, `hpBonus`, `unarmoredDefense`, `acBonus`, `initiativeBonus`, `speedBonus` y `saveProficiency`;
- la subida de nivel (`levelUpSteps` en `src/lib/levelup.ts`) convierte las elecciones en pasos: `chooseSkills`, `chooseExpertise` y `chooseFightingStyle`. Lo elegido se guarda en `LevelUpChoice` (`skills`, `expertise`, `fightingStyle`).

Un rasgo sin efectos solo se muestra (reacciones, "una vez por turno"…). Si un rasgo necesita una mecánica que aún no existe, se añade un `kind` nuevo a `Effect` en `src/lib/effects.ts`, se aplica en el motor y se cubre con un test.

## Rasgos de las subclases del Manual del Jugador

Las 48 subclases están en `subclassCatalog` (`src/lib/subclasses.ts`) y siempre se eligen de esa lista. La del SRD de cada clase tiene sus rasgos en `subclassFeatures` (`src/lib/levelup-data.ts`); las otras 36 los tienen en `bookSubclassFeatures` (`src/lib/subclass-features.ts`), por id de subclase y nivel, escritos con `feature` (`import { feature as f } from "./dnd2024"`). `subclasses.ts` los pone en el `features` de cada subclase, así que el motor los trata igual que los del SRD:

```ts
wildHeart: {
  3: [f("Animal Speaker", "Hablante animal", "Cast Beast Sense and Speak with Animals as rituals.", "Lanzas Sentido de bestia y Hablar con los animales como rituales.")],
  6: [f("Aspect of the Wild", "Aspecto de lo salvaje", "…", "…", [/* efectos */])],
},
```

Las cuatro subclases de una clase ganan rasgos en los mismos niveles; un test lo comprueba.

Normas:

- Solo el nombre oficial del rasgo, un resumen propio y la mecánica como datos. Nunca texto copiado del libro, aunque el repositorio sea privado.
- Cada efecto nuevo lleva un test en `src/lib/levelup.test.ts` con el valor que cambia en la ficha o el paso que aparece.
