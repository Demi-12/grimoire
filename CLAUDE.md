# Grimoire: mapa de lógicas

Toolkit autohospedado de D&D 5e (reglas 2024): personajes, campañas, encuentros, bestiario, homebrew y mapa de batalla en directo. Este archivo dice **dónde vive cada cosa**; el detalle funcional y de operación está en `README.md` y `docs/`.

Si cambias de sitio una lógica, añades una tabla, una ruta o un módulo, actualiza este mapa en el mismo PR.

## Stack y comandos

- Monorepo de pnpm 11 (Node 22) con tres paquetes:
  - `packages/shared` (`@grimoire/shared/<módulo>`): reglas puras en TypeScript, sin base de datos ni framework. Se compila a `dist/` con `tsc`; la API importa ese `dist`, la web lee `src/` directamente (alias en `apps/web/tsconfig.json`).
  - `apps/api`: **NestJS 12** sobre Express, ESM (`module: nodenext`: los imports relativos acaban en `.js`). PostgreSQL 17 con `pg` (SQL a mano, sin ORM), better-auth 1.7 (+ passkey, 2FA). En producción también sirve la web compilada.
  - `apps/web`: **Angular 22** standalone, *zoneless* y con signals; Tailwind 4 (PostCSS en `apps/web/.postcssrc.json`).
- Esquema de base de datos solo con Liquibase (`database/changelog`).
- `pnpm dev`: reglas en vigilancia + API en :3001 (lee el `.env` de la raíz, más `apps/api/dev.env`) + `ng serve` en :3000 con proxy de `/api` (`apps/web/proxy.conf.json`). Se abre http://localhost:3000.
- `pnpm lint` · `pnpm typecheck` · `pnpm test` (vitest en shared, api y `tests/`) · `pnpm build` · `pnpm test:e2e` (Playwright sobre el build: `node apps/api/dist/main.js` en el puerto 3100, API simulada, sin base de datos).
- Antes de un PR: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (lo mismo que el CI).
- Tests de integración (`apps/api/test/*.integration.test.ts`): se saltan salvo que `TEST_DATABASE_URL` apunte a un PostgreSQL desechable con el esquema de Liquibase aplicado.
- Angular y NestJS son más nuevos que muchos ejemplos de internet: ante la duda, mira las definiciones de tipos en `node_modules/@angular/*` y `node_modules/@nestjs/*`.

## Arquitectura en una pantalla

```
Navegador (apps/web)                       Servidor (apps/api, NestJS)                          PostgreSQL
────────────────────                       ───────────────────────────                          ──────────
pages/*.page.ts → components/*  ──fetch──▶ main.ts: compression → security.middleware → auth.middleware (better-auth)
  core/api-client.ts (api())               → web.middleware (archivos de la web) → router de Nest (/api/…)
  core/toolkit.store.ts (estado)           *.controller.ts
                                             1. @Approved() / @SignedIn()   common/auth.guard.ts
                                             2. @RateLimit(POLÍTICA)        common/rate-limit.guard.ts
                                             3. @Param(UuidParam)           common/params.ts
                                             4. @JsonBody() + parse*Input() common/params.ts + @grimoire/shared
                                             5. *.service.ts (SQL)          ──▶ pool (database/db.ts)
                                             6. unwrap()/ApiError → api-exception.filter.ts; recordEvent()
components/battle-map ◀──SSE──           map/map.controller.ts (stream) ◀── LISTEN/NOTIFY (map/battle-map-hub.ts)
```

Patrón que se repite: **reglas puras** en `packages/shared` (con su `*.test.ts` al lado) separadas de la **capa de datos** (servicios de Nest con SQL). Las reglas las comparten navegador, API y tests.

| Reglas puras (`packages/shared/src`) | API (`apps/api/src`) |
| --- | --- |
| `permissions.ts` (roles, validación de entradas) | `*/*.service.ts`, `common/current-user.ts` |
| `battle-map.ts` | `map/map.service.ts`, `map/battle-map-hub.ts`, `map/map-stream.ts` |
| `backup.ts` | `backup/backup.service.ts` |
| `analytics.ts` | `data/analytics-server.ts`, `admin/analytics.service.ts` |
| `homebrew.ts`, `homebrew-draft.ts` | `homebrew/homebrew.service.ts` |
| `open5e.ts`, `monster-api.ts` | `monsters/monster-upstream.ts`, `spells/spells.service.ts` |
| `api-types.ts` (forma de las respuestas) | lo que devuelven los controladores |
| — | `auth/auth-email-templates.ts` (puro, con test), `auth/auth-email.ts`, `auth/auth.ts` |

## Web (`apps/web/src/app`)

- **Rutas:** `app.routes.ts`. `/map/:id` es una página propia fuera del shell (pantalla completa). Todo lo demás cuelga de `ShellComponent` (`shell/`), que pinta la barra lateral, la cabecera, la puerta de acceso y el `<router-outlet>` de la página. `/characters`, `/characters/new` y `/characters/<id>` son una sola ruta (matcher `withOptionalSegment`), igual que `/admin` y `/admin/analytics`, para que la página no se destruya al cambiar entre ellas. Los parámetros llegan a la página como `input()` (`withComponentInputBinding`). Los enlaces con `#ancla` los gestiona `core/anchor-scrolling.ts` (solo desplaza, sin enfocar).
- **Estado compartido:** `core/toolkit.store.ts` (`ToolkitStore`, servicio raíz) guarda la cuenta (`/api/me`), personajes, campañas, catálogo de criaturas, invitación pendiente (`?invite=` → `sessionStorage`) e importación única de datos antiguos del navegador (`storage.ts` → `POST /api/import`). Vive toda la visita, así que navegar no recarga datos. El mapa de batalla no lo usa: carga lo suyo.
- **Shell** (`shell/shell.component.*`): decide qué pintar (`stage`: esqueleto, puerta o app), el menú (`View`, `viewPaths`, `playViews`, `runViews`), el título de la pestaña, `page.view` y las redirecciones (`/admin` sin ser admin, `/map` con una sola mesa).
- **Servicios de `core/`:** `session.service.ts` (sesión de better-auth como signals), `auth-client.ts` (cliente de better-auth sin framework), `i18n.service.ts` (`locale` y `t()`), `preferences.service.ts` (idioma y tema: `<html lang>`, `data-theme`, `localStorage` `grimoire.locale.v1`/`grimoire.theme.v1` y `PATCH /api/me`), `feedback.service.ts` (confirmaciones y avisos; los pinta `FeedbackHostComponent`), `crash.service.ts` (`ErrorHandler`: informa y muestra la pantalla de error si falló el pintado), `telemetry-client.ts` (`track()`, errores del navegador; `installErrorReporting()` en `main.ts`), `document-title.ts`.
- **`index.html`** lleva el script del tema (`THEME_INIT_SCRIPT` de `packages/shared/src/theme-init.ts`) **byte a byte**: la CSP lo permite por hash y un test lo comprueba. La API añade `data-session-hint` a `<html>` si llega una cookie de sesión, para pintar el esqueleto adecuado.
- **Añadir una sección** = página en `pages/` + línea en `app.routes.ts` + entrada en `View`/`viewPaths` de `shell.component.ts` (y en `playViews`/`runViews` si va en el menú) + textos en `packages/shared/src/i18n.ts` + `SECTIONS` de `analytics.ts` si debe contarse en `page.view` + casos de `e2e/ui.spec.ts`.

| URL | Página | Componentes |
| --- | --- | --- |
| `/` | `home.page.ts` | `home-dashboard.component` |
| `/characters`, `/characters/new`, `/characters/<id>` | `characters.page.ts` | `character-builder.component` (lista, edición rápida, hoja PDF) → `character-wizard.component` (creador), `level-up.component`, `character-sheet-view.component`, `character-spells.component`, `spell-manager.component` |
| `/map` | `map.page.ts` | `map-picker.component` (orden con `last-map.ts`) |
| `/map/<id>` | `battle-map.page.ts` (fuera del shell) | `battle-map.component` + `battle-map-tools.component` (herramientas del DM, mapas guardados, textos), `battle-map-combat.component`, `battle-map-sheet.component`, `battle-map-bestiary.ts`, `battle-map-styles.ts` |
| `/dm` | `dm.page.ts` | `dm-hub.component` (en móvil agrupa las tres siguientes) |
| `/campaigns` | `campaigns.page.ts` | `campaign-manager.component` → `encounter-journal.component` |
| `/encounters` | `encounters.page.ts` | `encounter-builder.component` (+ catálogo propio en la página) |
| `/bestiary` | `bestiary.page.ts` | `bestiary-browser.component` → `monster-sheet.component`, `homebrew-panel.component` → `homebrew-editor.component` |
| `/account` | `account.page.ts` | `auth/auth-panel.component` (seguridad), `data-backup.component` |
| `/admin`, `/admin/analytics` | `admin.page.ts` | `admin-users.component`, `admin-analytics.component` + `analytics-charts.component` |

Menú: grupo **Jugar** (home, characters, map) y grupo **Dirigir** (campaigns, encounters, bestiary). En móvil, barra inferior de 4 pestañas (Resumen, Personajes, Mapa, Dirigir → `/dm`).

### Convenciones de componentes

- Standalone, `ChangeDetectionStrategy.OnPush`, `host: { class: "contents" }` en los que tienen selector de elemento (el elemento anfitrión no debe afectar al diseño). **Todo estado que se pinta es un signal** (`signal`, `computed`, `input`, `linkedSignal`): la app no usa zone.js, así que un campo normal que cambia no repinta.
- Entradas con `input()`. Las devoluciones de llamada también son `input()` de tipo función (`onSave = input.required<(draft) => Promise<void>>()`, llamadas como `this.onSave()(draft)`), y el padre pasa propiedades flecha estables. No se usa `output()`.
- Algunos componentes van sobre el elemento que pintan para no añadir nodos (`svg[appIcon]`, `header[appPageHeader]`, `span[appSkeleton]`, `li[appSpellRow]`…), porque la CSS global depende de la estructura (`a > b`, `:first-child`).
- Sin `FormsModule`: campos controlados con `[value]` + `(input)`/`(change)`; en `<select>`, `[selected]` en cada `<option>`. Sin `alert/confirm/prompt`: `FeedbackService`.
- Angular quita el espacio en blanco entre dos elementos: si el diseño necesita un espacio entre dos elementos en línea, escribe `&ngsp;`.

## API (`apps/api/src`)

Un módulo por dominio (`*.module.ts` + `*.controller.ts` + `*.service.ts`), registrados en `app.module.ts`. Receta de cada ruta: `@Approved()` en el controlador (cuenta **aprobada**; rol y estado se leen de PostgreSQL en cada petición, nunca de la cookie; `@Approved("admin")` para admins, `@SignedIn()` para `/api/me`) → `@RateLimit(POLÍTICA)` → `@Param("id", UuidParam)` → `@JsonBody()` (64 KB por defecto, solo `application/json`) → `parse…Input` de `@grimoire/shared` → servicio que devuelve `{ ok } | { ok: false, error }` → `unwrap()` (o `throw new ApiError(status, mensaje, code?)`). El body parser global de Nest está apagado: cada ruta lee su cuerpo con su propio tope (`common/request-body.ts`).

| Ruta (`/api/…`) | Métodos | Controlador / lógica |
| --- | --- | --- |
| `auth/*` | better-auth | `auth/auth.middleware.ts` → `auth/auth.ts` |
| `me` | GET, PATCH | `me/` (usuario + preferencias) |
| `characters`, `characters/:id` | GET, POST · PUT, DELETE | `characters/` |
| `campaigns`, `campaigns/:id` | GET, POST · PATCH, DELETE | `campaigns/campaigns.controller.ts` |
| `campaigns/:id/members`, `…/members/:userId` | POST · DELETE | ídem (alta por correo/nombre exacto, cambio de rol, expulsión) |
| `campaigns/:id/invites`, `…/invites/:inviteId` | GET, POST · DELETE | ídem (enlaces de invitación) |
| `campaigns/:id/characters/:characterId` | DELETE | ídem (el DM saca un personaje) |
| `campaigns/:id/encounters`, `…/:encounterId` | GET, POST · PATCH, DELETE | `campaigns/encounters.controller.ts` (solo DMs) |
| `invites/:token` | GET (vista previa), POST (aceptar) | `invites/` |
| `campaigns/:id/map`, `…/map/stream`, `…/map/background`, `…/map/saves`, `…/saves/:saveId`, `…/map/reset` | ver `map/map.controller.ts` | `map/` (SSE en `map-stream.ts`, fondo ≤ 5 MB con tipo por bytes, máx. 20 mapas guardados) |
| `creatures`, `creatures/:id` | GET, POST · DELETE | `creatures/` |
| `homebrew`, `homebrew/:id` | GET, POST · GET, PUT, PATCH (bloqueo admin), DELETE | `homebrew/` |
| `monsters`, `monsters/catalog`, `monsters/:slug` | GET | `monsters/` (Open5e; `:slug` también resuelve `homebrew:<id>`) |
| `spells/:id` | GET | `spells/` (texto del conjuro desde Open5e) |
| `export`, `import` | GET · POST | `backup/` (`import` también acepta los datos antiguos del navegador) |
| `telemetry` | POST | `telemetry/` (eventos y errores del navegador) |
| `admin/users`, `admin/users/:id`, `admin/analytics` | GET · PATCH, DELETE · GET | `admin/` |

El navegador llama a todo esto con `api()` de `apps/web/src/app/core/api-client.ts`, que reexporta los tipos de `packages/shared/src/api-types.ts`. **Si cambias la forma de una respuesta, cambia el tipo compartido.**

## Dominios: dónde tocar

### Cuentas, sesión y permisos
- `apps/api/src/auth/auth.ts`: configuración de better-auth (contraseña ≥ 12, sesiones de 30 días sin `cookieCache`, límites propios de inicio de sesión, 2FA TOTP, passkeys, IP desde `cf-connecting-ip`). Los hooks ponen las cuentas nuevas en `pending` e impiden abrir sesión a las `blocked`. `auth.middleware.ts` le pasa `/api/auth/*`.
- `common/current-user.ts` (`getCurrentUser`, cacheado por petición; aquí también se asciende al primer admin desde `GRIMOIRE_ADMIN_EMAILS`, solo mientras no haya ningún admin aprobado), `common/auth.guard.ts` (`@Approved`, `@SignedIn`, `@CurrentUser`), `common/rate-limit.guard.ts`, `common/api-error.ts`, `admin/admin-count.ts`.
- `packages/shared/src/permissions.ts`: roles de sitio (`admin`/`user`), estados (`pending`/`approved`/`blocked`), roles de campaña (`dm`/`player`; el dueño es `campaign.ownerId`), `checkAdminChange`, y **todos los validadores de entrada** (`parseCharacterInput`, `parseCampaignInput`, `parseCreatureInput`, `parseEncounterInput`, `parsePreferencesInput`).
- **DM y jugador son por campaña**, no por cuenta. Todas las herramientas están abiertas a cualquier cuenta aprobada; solo el diario de encuentros y los controles de DM del mapa dependen del rol en esa campaña.
- UI: `components/auth/auth-panel.component.*` (entrar, registro, 2FA, passkeys, recuperación, seguridad de la cuenta), `components/admin-users.component.*`.
- Correo: `auth/auth-email.ts` (SMTP con nodemailer, opcional) y `auth/auth-email-templates.ts`.

### Personajes (creador, ficha, subida de nivel)
- Un personaje es una fila de `character` con campos básicos + `build` (JSON, `CharacterBuild` en `character-sheet.ts`). **Sin `build` es un personaje de «edición rápida»** y solo tiene características y notas; hay que soportar ambos.
- Datos de reglas (`packages/shared/src`): `dnd2024.ts` (12 clases, 40 especies, 16 trasfondos, dotes de origen, armas, armaduras, habilidades), `subclasses.ts` (catálogo de 48 subclases), `levelup-data.ts` (progresión 2-20, rasgos de clase y de la subclase SRD, dotes al subir), `subclass-features.ts` (rasgos de las 36 subclases fuera del SRD), `general-feats.ts`.
- Motor: `effects.ts` define `Effect` (mecánicas como datos); `grantedEffects` y `deriveSheet` en `character-sheet.ts` las aplican (PG, CA, iniciativa, salvaciones, velocidad…); `levelup.ts` convierte los efectos de elección en pasos (`levelUpSteps`, `levelUpIssues`, `applyLevelUp`). Una mecánica nueva = un `kind` nuevo en `Effect` + aplicarlo en el motor + test en `levelup.test.ts`. Ver `docs/subclass-features.md`.
- Conjuros: `spell-data.ts` (tabla compacta del SRD), `spells.ts` (qué puede elegir cada clase, límites, espacios, `sheetSpells`), descripción bajo demanda desde Open5e (`/api/spells/:id`).
- Presentación compartida entre tarjetas, hoja PDF y ficha en pantalla: `character-view.ts`. `rules.ts` tiene `abilityModifier` y `proficiencyBonus`.
- La hoja PDF es `window.print()` sobre un bloque oculto en pantalla dentro de `character-builder.component` (estilos de impresión en `apps/web/src/styles/app.css`, `body[data-printing-sheet]`).
- Norma de contenido: nombres oficiales y resúmenes con palabras propias; **nunca texto copiado de los libros**.

### Campañas, invitaciones y diario
- API: `campaigns/campaigns.service.ts` (campañas, miembros, invitaciones, personajes en campaña), `campaigns/encounters.service.ts` (diario), `invites/invites.service.ts` (`readInvite`, `acceptInvite`). UI: `campaign-manager.component` y `encounter-journal.component`.
- Al borrar una campaña los personajes vuelven a sus dueños. Solo el dueño edita su personaje; los miembros ven las fichas de los demás en solo lectura.

### Encuentros
- `rules.ts`: `encounterBudget` (tabla de XP del SRD 5.2.1) y `suggestEncounters`. UI: `encounter-builder.component`, que mezcla el catálogo de Open5e, el catálogo propio (`creature`) y homebrew.

### Bestiario y homebrew
- Open5e: `apps/api/src/monsters/monster-upstream.ts` (catálogo compacto en memoria durante un día; fichas y textos de conjuros en caché un día), `open5e.ts` (mapeo a nuestra ficha, libros reeditados, slugs antiguos), `monster-api.ts` (tipos y llamadas del navegador, `inferMonsterRoles`), `monster-i18n.ts` (vocabulario en español). El texto de los monstruos llega en inglés.
- Homebrew: `homebrew.ts` (validación, XP por VD, reglas `can*Homebrew`, visibilidad `private`/`campaign`/`instance`, slug `homebrew:<id>`), `homebrew-draft.ts` (estado del formulario ↔ payload ↔ vista previa), `apps/api/src/homebrew/homebrew.service.ts`.

### Mapa de batalla en directo
- `packages/shared/src/battle-map.ts` (puro, 1.000 líneas): `MapState`, el lote de cambios `MapOp`, `parseMapOps`, **`applyMapOps`** (permisos + aplicar, todo o nada), visión y niebla (`tokenSight`, `partySight`, `visibleMapState`: lo que no ve un jugador **no se le envía**), muros y puertas (`blockingEdges`, `lineIsClear`, `canReach`), combate (iniciativa, turnos, movimiento, `movementBudget`).
- `apps/api/src/map/map.service.ts`: lee y escribe `battle_map` con bloqueo de fila y `version`, sincroniza héroes con los miembros, emite `NOTIFY`; fondos y mapas guardados. `?audience=players` fuerza la vista de jugadores (Modo mesa).
- `map/battle-map-hub.ts`: una conexión `LISTEN` por proceso que reparte a los streams abiertos. `map/map-stream.ts`: SSE con latido de 25 s y resincronización cada 60 s (la membresía se recomprueba en cada lectura; quien sale de la campaña recibe `gone`).
- UI: `battle-map.component` (tablero SVG, herramientas, SSE), `battle-map-tools.component` (herramientas del DM, mapas guardados, textos), `battle-map-combat.component` (iniciativa y movimiento), `battle-map-sheet.component` (ficha de la ficha seleccionada), `battle-map-bestiary.ts` (buscar la criatura detrás de un monstruo para tomar velocidad, iniciativa y tamaño).
- Un cambio nuevo en el mapa = variante en `MapOp` + `parseMapOp` + rama en `applyMapOps` + test en `battle-map.test.ts` + botón en `battle-map.component`.

### Copia de seguridad
- `packages/shared/src/backup.ts`: formato JSON versionado, `parseBackup`, `runRestore` (idempotente por huella). Añadir un tipo de dato = registrar un `BackupSection` en `backupSections` e implementar su `SectionStore` en `apps/api/src/backup/backup.service.ts`. Ver `docs/data-backup.md`. No entran: mapa, mapas guardados, homebrew ni analíticas.

### Analíticas y errores
- `packages/shared/src/analytics.ts`: lista cerrada de eventos (`SERVER_EVENTS`, `CLIENT_EVENTS`), saneado (`normalizeRoute`, `sanitizeError`, `isForeignScriptError`: los scripts propios son los paquetes `main-*.js`/`chunk-*.js`/`polyfills-*.js` de la raíz), rangos. Un evento nuevo se declara aquí o se rechaza.
- `apps/api/src/data/analytics-server.ts`: `recordEvent`, `recordError` (nunca lanzan), purga a los 90 días; `admin/analytics.service.ts`: el informe del panel.
- Navegador: `core/telemetry-client.ts` (`track()`, `reportClientError`, `installErrorReporting`) y `core/crash.service.ts` + `components/crash-screen.component.ts`. Servidor: `common/api-exception.filter.ts` guarda toda excepción no prevista.

### Seguridad
- `apps/api/src/common/security-headers.ts` construye la CSP (sin nonce: scripts solo del propio sitio + el script del tema por hash, `THEME_INIT_SCRIPT_HASH`) y el resto de cabeceras; `security.middleware.ts` las aplica a toda respuesta y pone `Cache-Control: no-store` en `/api`. HSTS solo si `BETTER_AUTH_URL` es `https://`.
- El build de Angular tiene `inlineCritical: false`: el CSS crítico en línea usa manejadores `onload` que la CSP bloquea.
- Un host externo nuevo (imágenes, fetch desde el navegador) exige tocar la CSP. Hoy solo `api.open5e.com`.
- `common/rate-limit.ts`: limitador en memoria por usuario (`WRITE_LIMIT`, `MAP_LIMIT`, `MAP_STREAM_LIMIT`, `INVITE_LIMIT`, `MEMBER_LOOKUP_LIMIT`, `IMPORT_LIMIT`, `TELEMETRY_LIMIT`, `ERROR_REPORT_LIMIT`). `common/request-body.ts`: topes de tamaño.
- `web/web.middleware.ts`: sirve la web compilada (`WEB_DIST`, o `apps/web/dist/web/browser`) y `index.html` para cualquier otra ruta que no sea `/api`; las rutas `/api` nunca se sirven desde disco.
- `tests/security-config.test.mjs` vigila la configuración (compose, `.env.example`, `.dockerignore`).

## Base de datos

- Esquema solo por Liquibase: `database/changelog/db.changelog-master.yaml` incluye `db.changelog-auth.yaml` (better-auth) y `db.changelog-app.yaml` (la app). **Nunca edites un changeset ya aplicado: añade uno nuevo** con `id` único (`data-0NN-…` o `users-0NN-…`) y su `rollback`. Ver `docs/database-migrations.md`. El workflow `liquibase-pr.yml` lo valida contra un PostgreSQL desechable.
- Tablas de better-auth: `user` (+ `role`, `status`, preferencias, `legacyImportedAt`), `session`, `account`, `verification`, `two_factor`, `passkey`. Los nombres de columna son camelCase entre comillas (`"updatedAt"`).
- Tablas de la app: `campaign`, `campaign_member`, `campaign_invite`, `character`, `creature`, `encounter`, `homebrew_monster`, `homebrew_monster_campaign`, `battle_map`, `battle_map_background`, `battle_map_save`, `usage_event`, `app_error`.
- Acceso: `pool` y `transaction()` en `apps/api/src/database/db.ts`. Consultas parametrizadas escritas a mano dentro de los servicios.

## Interfaz: estilos, textos y piezas comunes

- **Textos**: `packages/shared/src/i18n.ts`, un diccionario plano por idioma (`es`, `en`); en la web, `t('clave', { valores })` de `I18nService`. Todo texto visible lleva **las dos** traducciones. Algunos componentes tienen su propio diccionario `copy = { en, es }` leído con `computed`. Los datos de reglas llevan el par en el propio dato (`Text`/`say` en `dnd2024.ts`). Los mensajes de error de la API están en inglés y el cliente los traduce o sustituye.
- **Colores**: solo los tokens de `apps/web/src/styles/tokens.css` (cambian con `<html data-theme>`), mapeados a Tailwind en `apps/web/src/styles.css` (`bg-surface`, `text-accent`, `border-line`, `font-display`, `rounded-card`…). Nada de hex sueltos. `dark:` sigue al botón de tema, no solo al sistema.
- **CSS**: `apps/web/src/styles/ui.css` (piezas compartidas: `.button`, `.panel`, `.tabs`, `.chip`, `.choice`, `.field`, `.eyebrow`, `.subheading`), `styles/app.css` (3.800 líneas de estilos por clase, con secciones comentadas: busca ahí la clase antes de crear otra), y `*.component.css` junto a algunos componentes (encapsulados por Angular: solo alcanzan la plantilla de su componente). Un nombre de clase de un `*.component.css` **no puede coincidir** con una clase global ni con una utilidad de Tailwind, porque también la recibiría. Las pantallas nuevas usan Tailwind con listas de clases en `section-styles.ts`, `wizard-styles.ts` y `battle-map-styles.ts`; Tailwind solo genera las clases que aparecen literales en `.ts`/`.html` de `apps/web/src/app`.
- **Piezas comunes** (`components/`): `page-header.component.ts` (cabecera única de cada sección), `feedback.component.ts` + `core/feedback.service.ts` (confirmaciones y avisos), `skeleton.component.ts` y `loading-shell.component.*` (esqueletos con las clases reales), `icons.component.ts` (SVG en línea, no símbolos Unicode), `brand.component.ts`, `core/document-title.ts`.
- **Fuentes**: Alegreya autoalojada en `apps/web/public/fonts` y declarada en `styles/fonts.css` (el build de Docker corre sin red).
- **Límites que comprueba el e2e** (`e2e/ui.spec.ts`, a 320/360/390/1280 px, claro y oscuro): sin scroll horizontal, nada por debajo de 12 px, cabecera sin desbordes, axe sin violaciones nuevas (las antiguas, en `e2e/known-a11y.ts`).

## Infraestructura

- `Dockerfile` (dependencias con red; build de shared, API y web **sin red**; `pnpm deploy --legacy --prod` de la API en una etapa con red, porque necesita metadatos del registro que la instalación no guardó; imagen final con `dist/`, `node_modules` de producción y la web en `/app/web`) · `compose.yaml` (producción: `app`, `db`, `tunnel` de Cloudflare; PostgreSQL sin puertos) · `compose.dev.yaml` (PostgreSQL local + `migrate`) · `compose.liquibase.yaml` (migración del deploy).
- `.github/workflows/ci.yml` (gitleaks, test, lint, typecheck, build, compose, imagen, e2e) · `deploy.yml` (runner self-hosted en el servidor de casa tras un CI verde en `main`: escribe `.env`, migra y levanta) · `liquibase-pr.yml`.
- Variables: `.env.example`. Nunca secretos en Git, logs ni argumentos.

## Convenciones

- Código y comentarios en inglés; commits, PRs, README y docs en español. Los commits describen el cambio en una frase («Mapa: velocidad, iniciativa y tamaño desde las fichas, sin teclearlos»).
- Cada módulo abre con un comentario `/** … */` que dice qué contiene y qué no: léelo antes de entrar.
- Lógica nueva → función pura en `packages/shared/src` con test al lado; el componente solo recoge y muestra, y el servicio de la API solo guarda y lee.
