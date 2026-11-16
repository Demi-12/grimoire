# Grimoire: mapa de lógicas

Toolkit autohospedado de D&D 5e (reglas 2024): personajes, campañas, encuentros, bestiario, homebrew y mapa de batalla en directo. Este archivo dice **dónde vive cada cosa**; el detalle funcional y de operación está en `README.md` y `docs/`.

Si cambias de sitio una lógica, añades una tabla, una ruta o un módulo de `src/lib`, actualiza este mapa en el mismo PR.

## Stack y comandos

- Next.js 16 (App Router, `output: standalone`), React 19, TypeScript estricto, Tailwind 4, PostgreSQL 17 con `pg` (SQL a mano, sin ORM), better-auth 1.7 (+ passkey, 2FA), Liquibase para el esquema. pnpm 11, Node 22. Alias `@/` → `src/`.
- `pnpm dev` · `pnpm lint` · `pnpm typecheck` · `pnpm test` (vitest) · `pnpm build` · `pnpm test:e2e` (Playwright sobre el build, puerto 3100, API simulada, sin base de datos).
- Antes de un PR: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (lo mismo que el CI).
- Tests de integración (`tests/*.integration.test.ts`): se saltan salvo que `TEST_DATABASE_URL` apunte a un PostgreSQL desechable con el esquema de Liquibase aplicado.
- En vitest, `server-only` está sustituido por `tests/stubs/server-only.ts`, así que los tests pueden importar módulos de servidor.

## Arquitectura en una pantalla

```
Navegador                                 Servidor (Next)                         PostgreSQL
─────────                                 ───────────────                         ──────────
src/components/toolkit.tsx  ──fetch──▶  src/app/api/**/route.ts
  (toda la UI con sesión)                  1. requireUser()      lib/access.ts
  lib/api-client.ts (api.*)                2. rateLimit()        lib/rate-limit.ts
                                           3. readJson()         lib/request-body.ts
                                           4. parse*Input()      lib/permissions.ts · homebrew.ts · battle-map.ts
                                           5. función de datos   lib/data.ts · battle-map-data.ts · backup-data.ts ──▶ pool (lib/db.ts)
                                           6. dataErrorResponse / recordEvent (lib/analytics-server.ts)
src/components/battle-map.tsx ◀──SSE──  api/campaigns/[id]/map/stream  ◀── LISTEN/NOTIFY (lib/battle-map-hub.ts)
```

Patrón que se repite en todo `src/lib`: **reglas puras** (sin base de datos, con su `*.test.ts` al lado) separadas de la **capa de datos** (`import "server-only"`, SQL). Las reglas las comparten navegador, rutas y tests.

| Reglas puras | Capa de datos / servidor |
| --- | --- |
| `permissions.ts` (roles, validación de entradas) | `data.ts`, `access.ts` |
| `battle-map.ts` | `battle-map-data.ts`, `battle-map-hub.ts` |
| `backup.ts` | `backup-data.ts` |
| `analytics.ts` | `analytics-server.ts` |
| `homebrew.ts`, `homebrew-draft.ts` | `data.ts` (funciones `*Homebrew`) |
| `open5e.ts`, `monster-api.ts` (cliente) | `monster-upstream.ts`, `spell-upstream.ts` |
| `auth-email-templates.ts` | `auth-email.ts`, `auth.ts` |

## Rutas y vistas (lo menos obvio del proyecto)

- **Las páginas de `src/app/(app)/**/page.tsx` devuelven `null`.** Toda la UI con sesión la pinta `Toolkit` (`src/components/toolkit.tsx`), montado en `src/app/(app)/layout.tsx` para que no se desmonte (ni pierda datos cargados) al navegar. Elige la vista con `viewFromPath(pathname)`.
- **Añadir una sección** = crear `src/app/(app)/<ruta>/page.tsx` vacío + añadirla a `View`/`viewPaths` en `toolkit.tsx` (y a `playViews`/`runViews` si va en el menú) + textos en `lib/i18n.ts` + `SECTIONS` de `lib/analytics.ts` si debe contarse en `page.view` + los casos de `e2e/ui.spec.ts`.
- `/map/[id]` es la excepción: página propia fuera del shell (`src/app/map/[id]/page.tsx` → `BattleMap`), pensada para pantalla completa.
- `Toolkit` también es dueño de: sesión y puerta de acceso (`AuthPanel`), carga de `/api/me`, tema y idioma (`grimoire.theme.v1`, `grimoire.locale.v1` en `localStorage`, y en la cuenta vía `PATCH /api/me`), invitación pendiente (`?invite=` → `sessionStorage`), importación única de datos antiguos del navegador (`lib/storage.ts` → `POST /api/import`).

| URL | Vista | Componente |
| --- | --- | --- |
| `/` | home | `home-dashboard.tsx` |
| `/characters`, `/characters/new`, `/characters/<id>` | characters | `character-builder.tsx` (lista, edición rápida, hoja PDF) → `character-wizard.tsx` (creador), `level-up.tsx`, `character-sheet-view.tsx` (ficha en pantalla), `character-spells.tsx`, `spell-manager.tsx` |
| `/map` | map | `map-picker.tsx` (orden con `lib/last-map.ts`) |
| `/map/<id>` | (fuera del shell) | `battle-map.tsx` + `battle-map-combat.tsx`, `battle-map-sheet.tsx`, `battle-map-bestiary.ts`, `battle-map-styles.ts` |
| `/dm` | dm | `dm-hub.tsx` (en móvil agrupa las tres siguientes) |
| `/campaigns` | campaigns | `campaign-manager.tsx` → `encounter-journal.tsx` |
| `/encounters` | encounters | `encounter-builder.tsx` |
| `/bestiary` | bestiary | `bestiary-browser.tsx` → `monster-sheet.tsx`, `homebrew-panel.tsx` → `homebrew-editor.tsx` |
| `/account` | account | `auth/auth-panel.tsx` (seguridad), `data-backup.tsx` |
| `/admin`, `/admin/analytics` | admin | `admin-users.tsx`, `admin-analytics.tsx` + `analytics-charts.tsx` |

Menú: grupo **Jugar** (home, characters, map) y grupo **Dirigir** (campaigns, encounters, bestiary). En móvil, barra inferior de 4 pestañas (Resumen, Personajes, Mapa, Dirigir → `/dm`).

## API (`src/app/api`)

Todas las rutas de datos siguen la misma receta: `requireUser()` (cuenta **aprobada**; rol y estado se leen de PostgreSQL en cada petición, nunca de la cookie) → `rateLimit(user, POLÍTICA)` → `readJson` (64 KB) → `parse…Input` → función de `lib/data.ts` que devuelve `{ ok } | { ok: false, error }` → `dataErrorResponse(error)`. Los ids se validan con `isUuid`.

| Ruta | Métodos | Lógica en |
| --- | --- | --- |
| `auth/[...all]` | better-auth | `lib/auth.ts` |
| `me` | GET, PATCH | usuario + preferencias (`readPreferences`, `updatePreferences`) |
| `characters`, `characters/[id]` | GET, POST · PUT, DELETE | `data.ts` (`*Character`) |
| `campaigns`, `campaigns/[id]` | GET, POST · PATCH, DELETE | `data.ts` (`*Campaign`) |
| `campaigns/[id]/members`, `…/members/[userId]` | POST · DELETE | alta por correo/nombre exacto, cambio de rol, expulsión |
| `campaigns/[id]/invites`, `…/invites/[inviteId]` | GET, POST · DELETE | enlaces de invitación |
| `invites/[token]` | GET (vista previa), POST (aceptar) | `readInvite`, `acceptInvite` |
| `campaigns/[id]/characters/[characterId]` | DELETE | el DM saca un personaje de la campaña |
| `campaigns/[id]/encounters`, `…/[encounterId]` | GET, POST · PATCH, DELETE | diario de encuentros (solo DMs) |
| `campaigns/[id]/map` | GET, POST (lote de `MapOp`) | `battle-map-data.ts` |
| `campaigns/[id]/map/stream` | GET (SSE) | `battle-map-hub.ts` |
| `campaigns/[id]/map/background` | GET, PUT, DELETE | imagen de fondo (≤ 5 MB, tipo por bytes) |
| `campaigns/[id]/map/saves`, `…/saves/[saveId]`, `…/map/reset` | GET, POST · POST (cargar), DELETE · POST | mapas guardados (máx. 20) |
| `creatures`, `creatures/[id]` | GET, POST · DELETE | catálogo propio de criaturas |
| `homebrew`, `homebrew/[id]` | GET, POST · GET, PUT, PATCH (bloqueo admin), DELETE | `homebrew.ts` + `data.ts` |
| `monsters`, `monsters/catalog`, `monsters/[slug]` | GET | Open5e (`monster-upstream.ts`); `[slug]` también resuelve homebrew (`homebrew:<id>`) |
| `spells/[id]` | GET | texto del conjuro desde Open5e (`spell-upstream.ts`) |
| `export`, `import` | GET · POST | copia de seguridad (`backup.ts`, `backup-data.ts`); `import` también acepta los datos antiguos del navegador |
| `telemetry` | POST | eventos y errores del navegador (`analytics.ts`) |
| `admin/users`, `admin/users/[id]`, `admin/analytics` | GET · PATCH, DELETE · GET | `requireUser(["admin"])` |

El cliente llama a todo esto a través de `api` en `src/lib/api-client.ts`, que además declara los tipos que devuelve la API (espejo de `data.ts`). **Si cambias la forma de una respuesta, cambia los dos.**

## Dominios: dónde tocar

### Cuentas, sesión y permisos
- `lib/auth.ts`: configuración de better-auth (contraseña ≥ 12, sesiones de 30 días sin `cookieCache`, límites propios de inicio de sesión, 2FA TOTP, passkeys, IP desde `cf-connecting-ip`). Los hooks ponen las cuentas nuevas en `pending` e impiden abrir sesión a las `blocked`.
- `lib/access.ts`: `getCurrentUser`, `requireUser`, `rateLimit`, `dataErrorResponse`, `jsonError`. Aquí también se asciende al primer admin desde `GRIMOIRE_ADMIN_EMAILS` (solo mientras no haya ningún admin aprobado).
- `lib/permissions.ts`: roles de sitio (`admin`/`user`), estados (`pending`/`approved`/`blocked`), roles de campaña (`dm`/`player`; el dueño es `campaign.ownerId`), `checkAdminChange`, y **todos los validadores de entrada** (`parseCharacterInput`, `parseCampaignInput`, `parseCreatureInput`, `parseEncounterInput`, `parsePreferencesInput`).
- **DM y jugador son por campaña**, no por cuenta. Todas las herramientas están abiertas a cualquier cuenta aprobada; solo el diario de encuentros y los controles de DM del mapa dependen del rol en esa campaña.
- UI: `components/auth/auth-panel.tsx` (entrar, registro, 2FA, passkeys, recuperación), `components/admin-users.tsx`.
- Correo: `lib/auth-email.ts` (SMTP con nodemailer, opcional) y `lib/auth-email-templates.ts`.

### Personajes (creador, ficha, subida de nivel)
- Un personaje es una fila de `character` con campos básicos + `build` (JSON, `CharacterBuild` en `lib/character-sheet.ts`). **Sin `build` es un personaje de «edición rápida»** y solo tiene características y notas; hay que soportar ambos.
- Datos de reglas: `lib/dnd2024.ts` (12 clases, 40 especies, 16 trasfondos, dotes de origen, armas, armaduras, habilidades), `lib/subclasses.ts` (catálogo de 48 subclases), `lib/levelup-data.ts` (progresión 2-20, rasgos de clase y de la subclase SRD, dotes al subir), `lib/subclass-features.ts` (rasgos de las 36 subclases fuera del SRD), `lib/general-feats.ts`.
- Motor: `lib/effects.ts` define `Effect` (mecánicas como datos); `grantedEffects` y `deriveSheet` en `lib/character-sheet.ts` las aplican (PG, CA, iniciativa, salvaciones, velocidad…); `lib/levelup.ts` convierte los efectos de elección en pasos (`levelUpSteps`, `levelUpIssues`, `applyLevelUp`). Una mecánica nueva = un `kind` nuevo en `Effect` + aplicarlo en el motor + test en `lib/levelup.test.ts`. Ver `docs/subclass-features.md`.
- Conjuros: `lib/spell-data.ts` (tabla compacta del SRD), `lib/spells.ts` (qué puede elegir cada clase, límites, espacios, `sheetSpells`), descripción bajo demanda desde Open5e.
- Presentación compartida entre tarjetas, hoja PDF y ficha en pantalla: `lib/character-view.ts`. `lib/rules.ts` tiene `abilityModifier` y `proficiencyBonus`.
- La hoja PDF es `window.print()` sobre un bloque oculto en pantalla dentro de `character-builder.tsx` (estilos de impresión en `styles/app.css`).
- Norma de contenido: nombres oficiales y resúmenes con palabras propias; **nunca texto copiado de los libros**.

### Campañas, invitaciones y diario
- Todo en `lib/data.ts` (`*Campaign`, `*CampaignMember`, `*CampaignInvite`, `acceptInvite`, `*Encounter`). UI en `campaign-manager.tsx` y `encounter-journal.tsx`.
- Al borrar una campaña los personajes vuelven a sus dueños. Solo el dueño edita su personaje; los miembros ven las fichas de los demás en solo lectura.

### Encuentros
- `lib/rules.ts`: `encounterBudget` (tabla de XP del SRD 5.2.1) y `suggestEncounters`. UI: `encounter-builder.tsx`, que mezcla el catálogo de Open5e, el catálogo propio (`creature`) y homebrew.

### Bestiario y homebrew
- Open5e: `lib/monster-upstream.ts` (servidor; catálogo compacto en memoria durante un día), `lib/open5e.ts` (mapeo a nuestra ficha, libros reeditados, slugs antiguos), `lib/monster-api.ts` (tipos y llamadas del navegador, `inferMonsterRoles`), `lib/monster-i18n.ts` (vocabulario en español). El texto de los monstruos llega en inglés.
- Homebrew: `lib/homebrew.ts` (validación, XP por VD, reglas `can*Homebrew`, visibilidad `private`/`campaign`/`instance`, slug `homebrew:<id>`), `lib/homebrew-draft.ts` (estado del formulario ↔ payload ↔ vista previa).

### Mapa de batalla en directo
- `lib/battle-map.ts` (puro, 1.000 líneas): `MapState`, el lote de cambios `MapOp`, `parseMapOps`, **`applyMapOps`** (permisos + aplicar, todo o nada), visión y niebla (`tokenSight`, `partySight`, `visibleMapState`: lo que no ve un jugador **no se le envía**), muros y puertas (`blockingEdges`, `lineIsClear`, `canReach`), combate (iniciativa, turnos, movimiento, `movementBudget`).
- `lib/battle-map-data.ts`: lee y escribe `battle_map` con bloqueo de fila y `version`, sincroniza héroes con los miembros, emite `NOTIFY`; fondos y mapas guardados. `audienceOf(request)` → `?audience=players` fuerza la vista de jugadores (Modo mesa).
- `lib/battle-map-hub.ts`: una conexión `LISTEN` por proceso que reparte a los streams abiertos. `api/.../map/stream/route.ts`: SSE con latido de 25 s y resincronización cada 60 s.
- UI: `battle-map.tsx` (tablero SVG, herramientas, SSE), `battle-map-combat.tsx` (iniciativa y movimiento), `battle-map-sheet.tsx` (ficha de la ficha seleccionada), `battle-map-bestiary.ts` (buscar la criatura detrás de un monstruo para tomar velocidad, iniciativa y tamaño).
- Un cambio nuevo en el mapa = variante en `MapOp` + `parseMapOp` + rama en `applyMapOps` + test en `lib/battle-map.test.ts` + botón en `battle-map.tsx`.

### Copia de seguridad
- `lib/backup.ts`: formato JSON versionado, `parseBackup`, `runRestore` (idempotente por huella). Añadir un tipo de dato = registrar un `BackupSection` en `backupSections` e implementar su `SectionStore` en `lib/backup-data.ts`. Ver `docs/data-backup.md`. No entran: mapa, mapas guardados, homebrew ni analíticas.

### Analíticas y errores
- `lib/analytics.ts`: lista cerrada de eventos (`SERVER_EVENTS`, `CLIENT_EVENTS`), saneado (`normalizeRoute`, `sanitizeError`), rangos. Un evento nuevo se declara aquí o se rechaza.
- `lib/analytics-server.ts`: `recordEvent`, `recordError` (nunca lanzan), `buildAnalyticsReport`, purga a los 90 días.
- `lib/telemetry-client.ts`: `track()`, `reportClientError`, `installErrorReporting`. Errores de servidor: `src/instrumentation.ts`. Pantallas de error: `app/error.tsx`, `app/global-error.tsx`, `components/crash-screen.tsx`.

### Seguridad
- `src/proxy.ts` (el «middleware» de Next 16): CSP con nonce por petición + HSTS. `lib/security-headers.ts` construye la CSP; `next.config.ts` pone el resto de cabeceras.
- El script del tema en `<head>` (`lib/theme-init.ts`) entra en la CSP por hash (`THEME_INIT_SCRIPT_HASH`, calculado solo a partir del script). Sus claves de `localStorage` deben coincidir con las de `toolkit.tsx`.
- Un host externo nuevo (imágenes, fetch desde el navegador) exige tocar la CSP. Hoy solo `api.open5e.com`.
- `lib/rate-limit.ts`: limitador en memoria por usuario (`WRITE_LIMIT`, `MAP_LIMIT`, `MAP_STREAM_LIMIT`, `INVITE_LIMIT`, `MEMBER_LOOKUP_LIMIT`, `IMPORT_LIMIT`, `TELEMETRY_LIMIT`, `ERROR_REPORT_LIMIT`). `lib/request-body.ts`: topes de tamaño.
- `tests/security-config.test.mjs` vigila la configuración (compose, `.env.example`, workflows).

## Base de datos

- Esquema solo por Liquibase: `database/changelog/db.changelog-master.yaml` incluye `db.changelog-auth.yaml` (better-auth) y `db.changelog-app.yaml` (la app). **Nunca edites un changeset ya aplicado: añade uno nuevo** con `id` único (`data-0NN-…` o `users-0NN-…`) y su `rollback`. Ver `docs/database-migrations.md`. El workflow `liquibase-pr.yml` lo valida contra un PostgreSQL desechable.
- Tablas de better-auth: `user` (+ `role`, `status`, preferencias, `legacyImportedAt`), `session`, `account`, `verification`, `two_factor`, `passkey`. Los nombres de columna son camelCase entre comillas (`"updatedAt"`).
- Tablas de la app: `campaign`, `campaign_member`, `campaign_invite`, `character`, `creature`, `encounter`, `homebrew_monster`, `homebrew_monster_campaign`, `battle_map`, `battle_map_background`, `battle_map_save`, `usage_event`, `app_error`.
- Acceso: `pool` y `transaction()` en `lib/db.ts`. Consultas parametrizadas escritas a mano dentro de `lib/data.ts` y compañía.

## Interfaz: estilos, textos y piezas comunes

- **Textos**: `lib/i18n.ts`, un diccionario plano por idioma (`es`, `en`) y `translate(locale, "clave", { valores })`. Todo texto visible lleva **las dos** traducciones. Los datos de reglas llevan el par en el propio dato (`Text`/`say` en `dnd2024.ts`). Los mensajes de error de la API están en inglés y el cliente los traduce o sustituye.
- **Colores**: solo los tokens de `src/app/tokens.css` (cambian con `<html data-theme>`), mapeados a Tailwind en `src/app/globals.css` (`bg-surface`, `text-accent`, `border-line`, `font-display`, `rounded-card`…). Nada de hex sueltos. `dark:` sigue al botón de tema, no solo al sistema.
- **CSS**: `src/styles/ui.css` (piezas compartidas: `.button`, `.panel`, `.tabs`, `.chip`, `.choice`, `.field`, `.eyebrow`, `.subheading`), `src/styles/app.css` (3.800 líneas de estilos por clase de las pantallas antiguas, con secciones comentadas: busca ahí la clase antes de crear otra), y `*.module.css` junto a algunos componentes. Las pantallas nuevas usan Tailwind con listas de clases en `section-styles.ts`, `wizard-styles.ts` y `battle-map-styles.ts`.
- **Piezas comunes**: `page-header.tsx` (cabecera única de cada sección), `feedback.tsx` (`useConfirm`, `useToast`: no usar `alert`/`confirm`/`prompt`), `skeleton.tsx` y `loading-shell.tsx` (esqueletos con las clases reales), `icons.tsx` (SVG en línea, no símbolos Unicode), `brand.tsx`, `lib/use-document-title.ts`.
- **Fuentes**: Alegreya autoalojada en `src/app/fonts` (el build de Docker corre sin red; no usar `next/font/google`).
- **Límites que comprueba el e2e** (`e2e/ui.spec.ts`, a 320/360/390/1280 px, claro y oscuro): sin scroll horizontal, nada por debajo de 12 px, cabecera sin desbordes, axe sin violaciones nuevas (las antiguas, en `e2e/known-a11y.ts`).

## Infraestructura

- `Dockerfile` (build sin red) · `compose.yaml` (producción: `app`, `db`, `tunnel` de Cloudflare; PostgreSQL sin puertos) · `compose.dev.yaml` (PostgreSQL local + `migrate`) · `compose.liquibase.yaml` (migración del deploy).
- `.github/workflows/ci.yml` (gitleaks, test, lint, typecheck, build, compose, imagen, e2e) · `deploy.yml` (runner self-hosted en el servidor de casa tras un CI verde en `main`: escribe `.env`, migra y levanta) · `liquibase-pr.yml`.
- Variables: `.env.example`. Nunca secretos en Git, logs ni argumentos.

## Convenciones

- Código y comentarios en inglés; commits, PRs, README y docs en español. Los commits describen el cambio en una frase («Mapa: velocidad, iniciativa y tamaño desde las fichas, sin teclearlos»).
- Cada módulo abre con un comentario `/** … */` que dice qué contiene y qué no: léelo antes de entrar.
- Lógica nueva → función pura en `src/lib` con test al lado; el componente solo recoge y muestra.
- ESLint tiene apagadas tres reglas del React Compiler (`eslint.config.mjs`) porque los componentes cargan datos en efectos; no las reactives de paso.
