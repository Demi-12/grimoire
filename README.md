# Grimoire

Toolkit autohospedado para preparar partidas de Dungeons & Dragons 5e (2024). Incluye un creador inicial de personajes y un generador de encuentros basado en el presupuesto de XP de las reglas de 2024.

## Desarrollo local

La app necesita PostgreSQL (cuentas, personajes y campañas viven allí), así que para verla funcionando en tu máquina hacen falta tres cosas: una base de datos, un `.env` y `pnpm dev`.

**Requisitos:** Node.js 22+, pnpm 11 (`corepack enable`) y Docker (Docker Desktop en Windows o macOS) para la base de datos.

### 1. Variables de entorno

Crea un `.env` en la raíz (está ignorado por Git; `.env.example` lista todas las variables posibles, pero en local solo hacen falta estas):

```sh
POSTGRES_PASSWORD=pon-aqui-una-contrasena-solo-con-letras-y-numeros
DATABASE_URL=postgres://grimoire:pon-aqui-una-contrasena-solo-con-letras-y-numeros@localhost:5432/grimoire
BETTER_AUTH_SECRET=genera-uno-aleatorio-como-se-indica-abajo
BETTER_AUTH_URL=http://localhost:3000
GRIMOIRE_ADMIN_EMAILS=tu@correo.com
```

- La contraseña de `POSTGRES_PASSWORD` tiene que ser la misma que la de `DATABASE_URL`. Usa solo letras y números: en la URL, los símbolos habría que codificarlos.
- `BETTER_AUTH_SECRET`: en Linux, macOS o Git Bash, `openssl rand -base64 32`; en PowerShell, `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))`.
- `BETTER_AUTH_URL` debe ser exactamente la dirección con la que abres la app: las cookies de sesión y las passkeys dependen de ella.
- `GRIMOIRE_ADMIN_EMAILS` es tu correo: al registrarte con él, tu cuenta es admin del sitio y no necesita aprobación.

### 2. Base de datos

`compose.dev.yaml` levanta PostgreSQL 17 solo en `127.0.0.1:5432` y aplica las migraciones de Liquibase (`database/changelog/`). No es el `compose.yaml` de producción, que no publica puertos.

```sh
docker compose -f compose.dev.yaml up -d db
docker compose -f compose.dev.yaml run --rm migrate
```

Repite el segundo comando cada vez que cambie `database/changelog/` (por ejemplo, tras hacer `git pull`): solo aplica lo que falte. Para borrar todos los datos locales: `docker compose -f compose.dev.yaml down -v`.

### 3. La aplicación

```sh
corepack enable
pnpm install
pnpm dev
```

Abre http://localhost:3000, crea una cuenta con el correo de `GRIMOIRE_ADMIN_EMAILS` y entrarás como admin. El registro no pide verificar el correo y la recuperación de contraseña por correo no funciona sin SMTP (ver `.env.example`).

### 4. Comprobaciones antes de abrir un PR

```sh
pnpm typecheck
pnpm test
pnpm build
```

Son las mismas que ejecuta el CI.

### Problemas habituales

- **`npm` o `pnpm` no se reconocen en Windows:** instala o repara Node.js 22 desde el instalador oficial (npm viene incluido), abre una terminal nueva y comprueba `node -v`. Después `corepack enable` habilita pnpm.
- **`Could not validate the database schema` en la consola:** la base de datos no está levantada o falta el paso `migrate`.
- **`port is already allocated` al levantar la base de datos:** ya hay un PostgreSQL usando el puerto 5432. Páralo o cambia el puerto publicado en `compose.dev.yaml`, y usa ese mismo puerto en `DATABASE_URL`.
- **No puedo iniciar sesión tras cambiar de puerto o de dirección:** actualiza `BETTER_AUTH_URL` y reinicia `pnpm dev`; si abres la app desde otra URL (por ejemplo, la IP de tu LAN), añádela a `BETTER_AUTH_TRUSTED_ORIGINS`.

## Lint y pruebas

```sh
pnpm lint        # ESLint (eslint-config-next)
pnpm typecheck
pnpm test        # pruebas unitarias (vitest)
```

### Pruebas e2e de interfaz (Playwright)

Las pruebas de `e2e/` abren la app compilada en Chromium, simulan toda la API con `page.route('**/api/**')` (no hace falta base de datos) y, para cada ruta (`/`, `/characters`, `/campaigns`, `/encounters`, `/account`, `/admin`), en anchos de 320, 360, 390 y 1280 px, en tema claro y oscuro y con un usuario admin, comprueban: sin scroll horizontal, cabecera sin desbordes, icono del botón de tema visible, ningún texto por debajo de 12 px y accesibilidad con axe (contraste de color y landmarks).

```sh
pnpm build
pnpm exec playwright install chromium   # solo la primera vez
pnpm test:e2e
```

Si ya tienes un Chromium instalado, usa `PLAYWRIGHT_CHROMIUM_PATH=/ruta/a/chromium pnpm test:e2e` en lugar de instalar el navegador. Playwright arranca `pnpm start` en el puerto 3100 con un `BETTER_AUTH_SECRET` ficticio (si ya hay algo escuchando ahí, lo reutiliza; recuerda recompilar con `pnpm build` tras tocar el código). El informe HTML de un fallo en CI se descarga como artefacto del job.

Las violaciones de accesibilidad que ya existían están listadas en `e2e/known-a11y.ts`; el test solo falla con violaciones nuevas. Corrige una en la app y borra su línea de esa lista.

## Secretos: regla del proyecto

- No guardar credenciales, tokens, claves privadas, contraseñas ni datos de producción en Git, issues o logs.
- `.env.example` solo contiene nombres de variables y valores vacíos/ficticios. Los secretos reales se guardan localmente en `.env` (ignorado por Git), en GitHub Actions Secrets/Environments o en el gestor de secretos del servidor.
- No imprimir secretos en logs ni pasarlos como argumentos visibles de línea de comandos.
- No copiar archivos de entorno ni claves a imágenes Docker; `.dockerignore` aplica la misma exclusión que `.gitignore`.
- El CI ejecuta Gitleaks sobre el historial del repositorio y detiene PRs con credenciales detectadas. Si se filtra alguna, hay que revocarla y rotarla; borrarla del último commit no invalida el secreto anterior.
- PostgreSQL no publica puertos al host ni a Internet. La aplicación se conecta por la red privada de Docker.
- El deploy se ejecuta en un runner self-hosted dentro del servidor de casa, así que no hace falta abrir puertos. Los secretos se pueden guardar en GitHub Actions Secrets (el deploy los escribe en el `.env` del servidor, ver [Variables del servidor desde GitHub](#variables-del-servidor-desde-github)) o directamente en ese `.env`. Antes de levantar la nueva versión aplica las migraciones de Liquibase (ver `docs/database-migrations.md`).

## Servidor y acceso público

El servidor debe tener Git, Docker Compose v2 y un checkout de este repositorio en `~/grimoire`. La configuración son las variables de `.env.example`, que el deploy escribe en un `.env` fuera de Git a partir de GitHub (ver [Variables del servidor desde GitHub](#variables-del-servidor-desde-github)) o que puedes crear a mano en el servidor: PostgreSQL, `BETTER_AUTH_SECRET` (genera uno con `openssl rand -base64 32`) y `GRIMOIRE_ADMIN_EMAILS` con tu correo, `BETTER_AUTH_URL` con la URL pública exacta del toolkit (la de Cloudflare; las passkeys y las cookies dependen de ella), y opcionalmente SMTP y `CLOUDFLARE_TUNNEL_TOKEN`. Liquibase usa por defecto el mismo usuario de PostgreSQL. Genera contraseñas aleatorias y mantén `DATABASE_URL` correctamente codificada; no reutilices credenciales. El servicio `tunnel` mantiene una conexión saliente con Cloudflare y comparte una red Docker con `app`; en el panel de Cloudflare, configura el hostname público para que llegue a `http://app:3000`. No abras puertos entrantes en el router ni publiques PostgreSQL.

Los ajustes propios del servidor (por ejemplo publicar la app en la IP de la LAN) van en un `compose.override.yaml` junto al checkout, que está fuera de Git y Docker Compose combina automáticamente con `compose.yaml`; así no bloquean los deploys:

```yaml
services:
  app:
    ports:
      - "192.168.1.210:3000:3000"
```

Si abres el toolkit desde varias URLs (la de la LAN y la pública), pon la principal en `BETTER_AUTH_URL` y las demás en `BETTER_AUTH_TRUSTED_ORIGINS`, separadas por comas. Con `http://` las cookies de sesión no se marcan como seguras para que el inicio de sesión funcione en la LAN; las passkeys necesitan HTTPS.

El token del túnel es un secreto: guárdalo como GitHub Secret o en el `.env` del servidor, nunca en Git. Usa un túnel dedicado para este servicio y limita su hostname al toolkit.

## Cabeceras de seguridad y límites de uso

- **CSP** (`src/proxy.ts`, `src/lib/security-headers.ts`): se genera por petición con un nonce para los scripts de Next y el hash del script del tema; no se usa `'unsafe-inline'` en scripts. Los estilos sí lo permiten porque la UI usa atributos `style`. Las ilustraciones de monstruos se permiten desde `api.open5e.com`. No se activa `upgrade-insecure-requests` porque la app también se abre por `http://` en la LAN.
- **Resto de cabeceras** (`next.config.ts`): `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y `X-Frame-Options` (más `frame-ancestors 'none'` en la CSP).
- **HSTS**: solo se envía si `BETTER_AUTH_URL` empieza por `https://`, y se lee al arrancar el servidor (la imagen se construye sin `.env`). Sin `includeSubDomains` ni `preload`.
- **Rate limiting**: better-auth ya limita inicio de sesión, registro y restablecimiento (`auth.ts`). Las rutas de datos tienen un limitador propio en memoria (`src/lib/rate-limit.ts`), por usuario: 60 escrituras/min, 300 cambios del mapa de batalla/min, 30 conexiones al mapa en directo/min, 10 invitaciones/min, 20 altas de miembros/min y 5 importaciones cada 10 min. Los contadores viven en el proceso: con varias réplicas el límite efectivo se multiplica y un reinicio los pone a cero. Hoy `compose.yaml` ejecuta una sola instancia `app`.
- **Tamaño de cuerpo**: las rutas JSON rechazan cuerpos de más de 64 KB (4 MB en `/api/import`, 16 KB en `/api/telemetry`).
- **Telemetría** (`/api/telemetry`): 120 eventos/min por cuenta y 20 informes de error/min por cuenta (o por IP antes de iniciar sesión). Solo acepta `Content-Type: application/json`, así que un envío desde otro sitio necesita un *preflight* CORS que la app nunca concede.

## Analíticas de uso y errores

Los admins tienen en **Usuarios → Analíticas** (`/admin/analytics`) un panel con los últimos 7, 30 o 90 días, comparados con el periodo anterior:

- **Indicadores:** cuentas activas (hoy, nuevas y aprobadas), personajes creados (con el creador o en edición rápida), encuentros generados (y guardados en un diario), campañas creadas (y jugadores que se unieron) y errores (cuentas afectadas, de servidor y de navegador), cada uno con su tendencia diaria.
- **Gráficas:** cuentas activas por día, porcentaje del creador de personajes que termina en un personaje guardado, secciones más visitadas y errores por día. Todas se leen con el teclado (flechas, Inicio y Fin) y las cifras diarias se pueden ver como tabla.
- **Registro de errores:** agrupados por tipo (misma clase, mensaje sin números y ruta), con número de veces, cuentas afectadas, última y primera vez, dispositivo, *digest* y traza.

Cómo se recoge (todo queda en el PostgreSQL de la app; no hay servicios de terceros ni scripts externos, así que la CSP no cambia):

- **Eventos de servidor:** las rutas de la API registran `character.created`, `character.deleted`, `campaign.created`, `campaign.joined`, `encounter.saved` y `homebrew.created` al terminar bien. El navegador no puede enviar estos nombres.
- **Eventos del navegador** (`src/lib/telemetry-client.ts` → `/api/telemetry`): `page.view` (sección visitada), `character.wizard_started`, `character.level_up` y `encounter.generated`. Solo cuentan para cuentas aprobadas y solo con los nombres y propiedades permitidos en `src/lib/analytics.ts`.
- **Errores de servidor:** `src/instrumentation.ts` (`onRequestError` de Next) guarda toda excepción no capturada en rutas de la API, renderizado y *proxy*.
- **Errores del navegador:** `error` y `unhandledrejection` de `window`, más las pantallas de error de React (`src/app/error.tsx` y `src/app/global-error.tsx`). Como mucho 10 por carga de página, sin repetir el mismo mensaje.

Privacidad: los eventos no llevan nombres, notas ni texto libre; las rutas se guardan como patrón (`/characters/:id`, sin parámetros, así que tampoco tokens de invitación); los mensajes y trazas ocultan correos, UUID y tokens largos, y del navegador solo se guarda «Navegador versión · Sistema». Las filas se borran a los 90 días (la app lo hace sola, como mucho una vez por hora). Al eliminar una cuenta, sus filas se quedan pero pierden el vínculo con ella. Las tablas son `usage_event` y `app_error` (migración `data-009-usage-analytics`) y no entran en la copia de seguridad.

## Deploy con runner self-hosted

El workflow `Deploy` se lanza solo cuando el CI de `main` termina bien, o a mano desde Actions → Deploy → Run workflow (eligiendo rama). Corre en el propio servidor con un runner self-hosted:

1. En GitHub: Settings → Actions → Runners → New self-hosted runner → Linux x64, y sigue los comandos en el servidor (`./config.sh --url https://github.com/Demi-12/grimoire --token ...`).
2. Instálalo como servicio para que siga activo tras reiniciar: `sudo ./svc.sh install && sudo ./svc.sh start`.
3. Da acceso a Docker al usuario del runner: `sudo usermod -aG docker <usuario>` y reinicia el servicio (`sudo ./svc.sh stop && sudo ./svc.sh start`).
4. Comprueba que en Settings → Actions → Runners aparece en verde como *Idle*.

El job pide las etiquetas `self-hosted` y `linux`, que el runner Linux tiene por defecto. El checkout de producción está en `~/grimoire` (se clona solo si no existe; se puede cambiar con la variable de repo `GRIMOIRE_DIR`) y debe contener el `.env` (o el deploy lo genera desde GitHub, ver abajo). Si el `.env` tiene `CLOUDFLARE_TUNNEL_TOKEN`, también se levanta el túnel; si no, solo `app` y `db`. Antes de reconstruir la app levanta `db` y aplica las migraciones de Liquibase; el `.env` necesita además las variables de Better Auth, SMTP y Liquibase de `.env.example`.

### Variables del servidor desde GitHub

Para no tener que entrar al servidor a editar el `.env`, guarda las variables en GitHub (Settings → Secrets and variables → Actions) con el mismo nombre que en `.env.example`:

- **Secrets** para lo sensible: `POSTGRES_PASSWORD`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `CLOUDFLARE_TUNNEL_TOKEN`, `SMTP_USER`, `SMTP_PASSWORD`, `LIQUIBASE_DB_PASSWORD`. No se pueden volver a leer, solo sobrescribir.
- **Variables** para el resto: `POSTGRES_DB`, `POSTGRES_USER`, `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`, `PASSKEY_RP_ID`, `GRIMOIRE_ADMIN_EMAILS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `LIQUIBASE_DB_USERNAME`.

En cada deploy, las que estén definidas en GitHub sustituyen a su línea del `.env` del servidor (que se reescribe con permisos `600`); las que no, se quedan como estén, así que puedes migrar poco a poco. Para aplicar un cambio, lanza Actions → Deploy → Run workflow. Los valores no pueden llevar comillas simples ni saltos de línea.

Cambiar el valor no basta en dos casos:

- **`POSTGRES_PASSWORD`** solo se aplica al crear el volumen de PostgreSQL. Para rotarla, cambia antes la contraseña en la base de datos (`docker compose exec db psql -U grimoire -d grimoire`, y dentro `\password grimoire`) y después actualiza `POSTGRES_PASSWORD` y `DATABASE_URL` en GitHub y despliega.
- **`BETTER_AUTH_SECRET`**: al cambiarlo se cierran todas las sesiones.

## Usuarios y acceso

Grimoire es privado: hay que iniciar sesión para usarlo. Cualquiera puede registrarse, pero la cuenta queda **pendiente** hasta que un admin la apruebe en **Usuarios**. Mientras tanto, esa persona solo ve un aviso de espera. Se puede entrar con correo y contraseña o passkey.

- **Admin del sitio:** pon tu correo en `GRIMOIRE_ADMIN_EMAILS` (como variable de Actions o en el `.env` del servidor; admite varios separados por comas). Esa cuenta se aprueba y es admin al registrarse o en su próximo acceso, también si ya existía. El admin aprueba las cuentas nuevas y puede bloquear (cierra sus sesiones y le impide entrar), cerrar sesiones o borrar cuentas, y asignar otros admins. No puede modificarse a sí mismo y siempre queda al menos un admin aprobado.
- **DM y jugador son por campaña:** quien crea una campaña es su DM; quien se une por enlace de invitación es jugador, y el DM puede ascender a co-DM. El rol es independiente en cada campaña: la misma cuenta puede ser DM en una y jugador en otra. Todas las herramientas (personajes, generador de encuentros, bestiario) están disponibles para todas las cuentas; el diario de encuentros de una campaña solo lo ven sus DMs.
- **Campañas compartidas:** el DM crea la campaña y suma gente con enlaces de invitación o escribiendo el correo o nombre exacto de la cuenta desde su campaña (no hay lista de cuentas: solo el admin del sitio las ve, en **Usuarios**; si un nombre se repite, hay que usar el correo). Cada jugador pone sus personajes en la campaña; todos los miembros ven el grupo y el generador de encuentros puede cargar el grupo de una campaña de un clic. Solo el dueño edita su personaje; el DM puede sacarlo de la campaña. Al borrar una campaña los personajes vuelven a sus dueños.
- **Datos anteriores:** si el navegador tenía personajes o campañas de la versión local, el resumen ofrece importarlos a la cuenta una vez.

Personajes (incluidas las elecciones del creador paso a paso) y campañas viven en PostgreSQL (migración `database/changelog/db.changelog-app.yaml`). El catálogo de criaturas de cada cuenta y los monstruos homebrew también viven en PostgreSQL.

## Primera versión

- El creador de personajes guía paso a paso con las reglas de 2024 (SRD 5.2): clase, trasfondo (aumentos de característica, dote de origen, habilidades), especie, características (matriz estándar, compra por 27 puntos o 4d6), competencias, equipo inicial y detalles. La ficha calcula PG, CA, iniciativa, salvaciones, habilidades con pericia, percepción pasiva, CD de conjuros y oro, y se imprime con esos valores. Los personajes antiguos siguen editándose con la edición rápida.
- El creador incluye los 16 trasfondos del Manual del Jugador 2024, sus 10 dotes de origen y 40 especies: las 10 del Manual del Jugador 2024, las 5 de *Eberron: Forge of the Artificer* (2025; cambiante, kalashtar, khoravar, cambiaformas y forjado) y las 25 de *Mordenkainen Presents: Monsters of the Multiverse* (2022) que no repiten una del manual (compatibles con 2024: los aumentos de característica vienen del trasfondo). Cada especie indica su libro de origen; la subclase se elige siempre de la lista de las 48 del Manual del Jugador 2024, todas con sus rasgos nivel a nivel (ver [docs/subclass-features.md](docs/subclass-features.md)). Al subir de nivel se ofrecen todas las dotes generales, estilos de combate y dones épicos del manual, con sus requisitos de característica, armadura y lanzamiento de conjuros. Los rasgos y dotes fuera del SRD están resumidos con nuestras palabras: si algo no cuadra con el libro, se corrige en `src/lib/subclass-features.ts` o `src/lib/general-feats.ts`. Las mecánicas de rasgos, dotes y especies (PG extra, CA sin armadura, salvaciones, habilidades, pericia, estilos de combate) se describen como efectos en `src/lib/effects.ts` y las aplica un único motor en la ficha y en la subida de nivel.
- **Ficha completa en la web:** cada tarjeta tiene un botón *Ver ficha* que abre `/characters/<id>` con todo lo del personaje: características, tiradas de salvación, las 18 habilidades con competencia y pericia, CA, PG, iniciativa, velocidad, percepción pasiva, ataques, rasgos de clase y de especie, dotes, competencias, lenguas, equipo, oro, historia y notas. Los personajes hechos con el creador paso a paso muestran todos los cálculos; los de edición rápida solo características y notas. El DM y los jugadores de una campaña pueden abrir la ficha de los demás miembros (en solo lectura) desde la lista de héroes de la campaña. *Exportar hoja · PDF* sigue imprimiendo la hoja de 2 páginas.
- El generador usa presupuestos por personaje de dificultad baja, moderada y alta; suma el presupuesto según el nivel de cada aventurero y propone combinaciones que no exceden el total.
- El generador puede usar todos los monstruos de [Open5e](https://open5e.com) (unos 3.500 de todos los libros de 5e con licencia libre), filtrar por libro y por tipo de criatura y limitar cada encuentro a 1-3 tipos de criatura. El servidor descarga el catálogo la primera vez (unos segundos) y lo guarda en memoria un día; necesita salida a Internet hacia `api.open5e.com`.
- El catálogo inicial usa perfiles genéricos. Puedes añadir criaturas propias con sus XP; el catálogo queda en el almacenamiento local del navegador.
- Las cuentas incluyen registro e inicio de sesión, recuperación de contraseña por correo, 2FA TOTP con códigos de respaldo y passkeys. No se verifica el correo al registrarse: las cuentas nuevas quedan pendientes hasta que un admin las aprueba. La recuperación usa SMTP de cualquier proveedor (p. ej. Brevo) y es opcional: sin SMTP no se puede recuperar la contraseña por correo. El TOTP protege el acceso con contraseña; el acceso con passkey es passwordless y no pide un segundo código por defecto.
- El bestiario consulta la API de Open5e desde rutas del servidor: SRD 5.2 y 5.1, Tome of Beasts 1-3, Creature Codex, Black Flag, el Monstrous Menagerie de Level Up y otros libros con licencia CC-BY u OGL. Se filtra por libro, valor de desafío y nombre; cuando un libro reedita a otro (SRD 5.2 sobre 5.1, Tome of Beasts 2023 sobre el original) solo se lista la versión nueva. Cada ficha indica su libro y su licencia. Los encuentros guardados con identificadores antiguos (`goblin`) siguen abriéndose: se buscan en el SRD 5.2 y después en el 5.1. Las etiquetas tácticas se infieren de sus estadísticas y no sustituyen el juicio del DM.
- **Monstruos homebrew:** en el bestiario, la pestaña *Homebrew* permite crear monstruos con una ficha completa (características, defensas, velocidades, sentidos, rasgos, acciones, reacciones y acciones legendarias) con vista previa en vivo. El XP y la competencia se calculan a partir del valor de desafío. Cada monstruo es **privado** por defecto; su autor puede compartirlo con campañas de las que es miembro o publicarlo para **todas las cuentas del servidor**. Los monstruos homebrew se añaden al generador de encuentros igual que los del SRD y su ficha se abre desde allí. Un admin puede retirar y **bloquear** un monstruo publicado (vuelve a privado y su autor no puede volver a publicarlo hasta que se desbloquee), pero nunca ve el trabajo privado de otras cuentas. Aún no hay copiar un monstruo público a tu cuenta, tiradas de salvación ni habilidades con pericia en el editor.
- **Mapa de batalla en directo:** cada campaña tiene un mapa compartido (botón *Mapa de batalla* en su tarjeta, o `/map/<id>`). Es una cuadrícula con coordenadas tipo «C4» y fichas de héroes y monstruos. Cada jugador abre el mismo enlace en su móvil y coloca o mueve a su héroe (tocando la ficha y luego la casilla, arrastrándola o con las flechas del teclado); solo el DM mueve los monstruos y el resto de héroes. El DM añade monstruos a mano o desde un encuentro del diario, puede dejarlos **ocultos** hasta revelarlos (a los jugadores ni siquiera les llegan), marcarlos como derrotados, cambiar su tamaño y el de la cuadrícula. El **Modo mesa** pone el mapa a pantalla completa, sin controles, con la leyenda, la pantalla siempre encendida y la vista de los jugadores, pensado para una tablet o tele en el centro de la mesa. Cada ficha puede tener un **cono de visión**: los héroes ven por defecto 18 m (12 casillas) en un cono de 90°, y cada jugador gira a su héroe con los botones ⟲/⟳ o las teclas Q y E; el DM ajusta alcance (de 3 a 36 m) y amplitud (60°, 90°, 120°, 180° o alrededor) de cualquier ficha, incluidos los monstruos. Con la **niebla de guerra** activada, los jugadores solo ven las casillas que cubren los conos de los héroes, y los monstruos fuera de ellas ni siquiera les llegan (el DM ve la niebla semitransparente y esos monstruos marcados como «fuera de la vista»); lo que el grupo ya ha visto queda en **penumbra** (se ve el fondo, pero no los monstruos), y el DM puede hacer que lo olvide. **Muros y puertas:** el DM los dibuja sobre las líneas de la cuadrícula (herramientas *Muro*, *Puerta* y *Borrar*: se toca una esquina y luego otra en la misma fila o columna, y los muros se encadenan). Tapan la vista de los conos y no dejan pasar a los jugadores, que tienen que rodearlos (tampoco en diagonal por una esquina); el DM puede seguir moviendo cualquier ficha a cualquier sitio. Las puertas hacen lo mismo mientras están cerradas, y las abre o cierra el DM o un jugador cuyo héroe esté como mucho a una casilla (tocándola o con el botón que aparece al seleccionar al héroe). A los jugadores solo les llegan los tramos de muro junto a casillas que ven o han explorado, y el servidor les calcula qué casillas ven, porque ellos no conocen todos los muros. El DM puede subir una **imagen de fondo** (PNG, JPEG, WebP o GIF de hasta 5 MB, comprobada por sus bytes) que se estira sobre la cuadrícula, ajustar las filas a la proporción de la imagen y ocultar las líneas de la cuadrícula; se guarda en la tabla `battle_map_background` y la sirve `/api/campaigns/<id>/map/background` solo a miembros de la campaña (la niebla tapa la imagen en pantalla, pero un jugador podría descargarla entera). El mapa de la mesa se guarda solo tras cada cambio, así que una partida a medias sigue ahí al volver. Además, el DM tiene **mapas guardados** (hasta 20 por campaña, tabla `battle_map_save`): guarda una copia con nombre del mapa entero (fichas, muros, puertas, niebla con lo explorado y la imagen de fondo), empieza uno vacío o carga otro, y más tarde vuelve a cargar el primero; los héroes que hayan salido de la campaña desde entonces desaparecen al cargarlo. Los cambios llegan a todos los dispositivos al instante por Server-Sent Events (`/api/campaigns/<id>/map/stream`), avisados con `LISTEN/NOTIFY` de PostgreSQL, así que también funcionaría con varias instancias; el túnel de Cloudflare deja pasar el stream sin configurar nada (lleva un latido cada 25 s). El mapa y los mapas guardados no entran en la copia de seguridad.
- Las propuestas son orientativas. Revisa capacidades especiales, composición y contexto antes de usar un encuentro.

## Atribución de reglas

La tabla de presupuestos de encuentros se basa en System Reference Document 5.2.1 (SRD 5.2.1) de Wizards of the Coast LLC, disponible en https://www.dndbeyond.com/srd y licenciada bajo Creative Commons Attribution 4.0 International (CC BY 4.0). Grimoire no está afiliado a Wizards of the Coast.
