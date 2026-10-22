# Rasgos de subclase y efectos

Cada rasgo de clase, subclase o especie es un `Feature` (`src/lib/dnd2024.ts`): nombre oficial, un resumen de una línea escrito por nosotros y, si cambia algo en la ficha, una lista de `effects`. El motor (`grantedEffects` en `src/lib/character-sheet.ts`) reúne los efectos de la clase, la subclase, la especie y las dotes, y:

- la ficha (`deriveSheet`) aplica los modificadores: `hpPerLevel`, `unarmoredDefense`, `acBonus`, `initiativeBonus` y `saveProficiency`;
- la subida de nivel (`levelUpSteps` en `src/lib/levelup.ts`) convierte las elecciones en pasos: `chooseSkills`, `chooseExpertise` y `chooseFightingStyle`. Lo elegido se guarda en `LevelUpChoice` (`skills`, `expertise`, `fightingStyle`).

Un rasgo sin efectos solo se muestra (reacciones, "una vez por turno"…). Si un rasgo necesita una mecánica que aún no existe, se añade un `kind` nuevo a `Effect` en `src/lib/effects.ts`, se aplica en el motor y se cubre con un test.

## Añadir una subclase del Manual del Jugador

Las subclases están en `subclassCatalog` (`src/lib/subclasses.ts`). Para que Grimoire siga sus rasgos, se pasa `features` por nivel como último argumento de `s(…)`, escritos con `feature` (`import { feature as f } from "./dnd2024"`):

```ts
s("wildHeart", "Path of the Wild Heart", "Senda del Corazón Salvaje", "…", "…", false, {
  3: [f("Animal Speaker", "Hablante animal", "Cast Beast Sense and Speak with Animals as rituals.", "Lanzas Sentido de bestia y Hablar con los animales como rituales.")],
  6: [f("Aspect of the Wilds", "Aspecto de lo salvaje", "…", "…", [/* efectos */])],
}),
```

Normas:

- Solo el nombre oficial del rasgo, un resumen propio y la mecánica como datos. Nunca texto copiado del libro, aunque el repositorio sea privado.
- Cada efecto nuevo lleva un test en `src/lib/levelup.test.ts` con el valor que cambia en la ficha o el paso que aparece.
