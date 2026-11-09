# Rasgos de subclase y efectos

Cada rasgo de clase, subclase o especie es un `Feature` (`src/lib/dnd2024.ts`): nombre oficial, un resumen de una línea escrito por nosotros y, si cambia algo en la ficha, una lista de `effects`. El motor (`grantedEffects` en `src/lib/character-sheet.ts`) reúne los efectos de la clase, la subclase, la especie y las dotes, y:

- la ficha (`deriveSheet`) aplica los modificadores: `hpPerLevel`, `unarmoredDefense`, `acBonus`, `initiativeBonus` y `saveProficiency`;
- la subida de nivel (`levelUpSteps` en `src/lib/levelup.ts`) convierte las elecciones en pasos: `chooseSkills`, `chooseExpertise` y `chooseFightingStyle`. Lo elegido se guarda en `LevelUpChoice` (`skills`, `expertise`, `fightingStyle`).

Un rasgo sin efectos solo se muestra (reacciones, "una vez por turno"…). Si un rasgo necesita una mecánica que aún no existe, se añade un `kind` nuevo a `Effect` en `src/lib/effects.ts`, se aplica en el motor y se cubre con un test.

## Subclases del Manual del Jugador

Las 48 subclases están en `subclassCatalog` (`src/lib/subclasses.ts`) y se eligen siempre de esa lista. Los rasgos de las 36 que no son del SRD están en `bookSubclassFeatures` (`src/lib/subclass-features.ts`), por id de subclase y nivel, escritos con `feature` (`import { feature as f } from "./dnd2024"`); `s(…)` los asocia solo. Para cambiar o añadir un efecto se edita ese archivo:

```ts
dance: {
  3: [f("Dazzling Footwork", "Juego de pies deslumbrante", "…", "…", [{ kind: "unarmoredDefense", add: ["cha"] }])],
},
```

Las cuatro subclases de una clase ganan rasgos en los mismos niveles (lo comprueba un test).

Normas:

- Solo el nombre oficial del rasgo, un resumen propio y la mecánica como datos. Nunca texto copiado del libro, aunque el repositorio sea privado.
- Cada efecto nuevo lleva un test en `src/lib/levelup.test.ts` con el valor que cambia en la ficha o el paso que aparece.
