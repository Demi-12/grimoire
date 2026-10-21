# Copia de seguridad de datos

Cada usuario puede descargar y restaurar sus datos desde la vista de cuenta (`/account`).

## Exportar: `GET /api/export`

Requiere sesión. Devuelve `grimoire-backup-AAAA-MM-DD.json` (`Content-Disposition`, `Cache-Control: no-store`):

```json
{ "version": 1, "exportedAt": "2026-10-21T10:00:00.000Z",
  "campaigns": [], "characters": [], "creatures": [], "encounters": [] }
```

Solo incluye datos del usuario: sus personajes, las campañas que posee (de los demás miembros solo `name` y `role`), su catálogo de criaturas y el diario de encuentros de esas campañas. Cada sección mapea campo a campo (lista blanca), así que nunca salen ids de otras personas, correos, hashes, tokens ni invitaciones. Los ids del archivo son locales al archivo; se usan solo para enlazar personajes y encuentros con sus campañas.

## Restaurar: `POST /api/import`

Si el cuerpo trae `version` se trata como copia de seguridad; si no, como la importación antigua de datos del navegador (sin cambios).

- **Validación estricta** (`parseBackup`, la misma en el navegador y el servidor): versión exacta, fechas ISO, cada elemento con las mismas reglas que los formularios (`permissions.ts`), referencias a campañas que existan en el archivo, ids únicos. Un elemento inválido rechaza **todo** el archivo y se indica cuál (`characters[3]`). Las claves desconocidas se ignoran y se devuelven en `ignored`.
- **Límites**: archivo ≤ 12 MB; 200 campañas, 1000 personajes, 500 criaturas (el tope de la cuenta) y 5000 encuentros por archivo; 500 encuentros por campaña, como en la app. Superarlos responde 413 / 409 y no importa nada.
- **Sin duplicados (idempotente)**: restaurar nunca borra ni sobrescribe. Cada elemento tiene una huella (clave natural) y se omite si la cuenta ya tiene una igual:
  - campaña: nombre (sin distinguir mayúsculas ni espacios); si existe, se reutiliza y no se toca su descripción;
  - personaje: todo su contenido (nombre, nivel, clase, especie, trasfondo, atributos, notas, build);
  - criatura: `monsterSlug`, o nombre+fuente+XP si es propia;
  - encuentro: campaña de destino + contenido.
  
  Importar el mismo archivo dos veces crea elementos solo la primera. Un elemento modificado desde la copia se restaura como elemento nuevo (no se pierde ni pisa nada). Todo ocurre en una transacción, con un bloqueo por usuario para que dos restauraciones simultáneas no dupliquen.
- Respuesta: `{ imported: { campaigns, characters, creatures, encounters }, skipped: { ... }, ignored: [] }`.

## Añadir una sección nueva (p. ej. monstruos homebrew)

1. En `src/lib/backup.ts`, define un `BackupSection` (`parse`, `serialize`, `fingerprint`, `localId` si otras secciones la referencian, `maxItems`) y añádelo a `backupSections` (el orden importa: las referencias van detrás de lo que referencian).
2. En `src/lib/backup-data.ts`, añade su `SectionStore` (`existing` y `create`) en `createStores` y su lectura en `exportBackup`.

El validador, los límites, la exportación y la restauración idempotente recorren el registro; no hay que tocar nada más.

## Pruebas

`src/lib/backup.test.ts` cubre el serializador (sin fugas), el validador y la idempotencia de `runRestore` con una cuenta en memoria. Las consultas SQL se probaron además a mano contra PostgreSQL 16 (ver la descripción del PR).
