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
- El deploy se ejecuta en un runner self-hosted dentro del servidor de casa, así que no necesita secretos en GitHub ni abrir puertos: los secretos viven solo en el `.env` del servidor. Antes de levantar la nueva versión aplica las migraciones de Liquibase (ver `docs/database-migrations.md`).

## Servidor y acceso público

El servidor debe tener Git, Docker Compose v2 y un checkout de este repositorio en `~/grimoire`. Crea allí un `.env` fuera de Git con las variables de `.env.example`: PostgreSQL, `BETTER_AUTH_SECRET` (genera uno con `openssl rand -base64 32`) y `GRIMOIRE_ADMIN_EMAILS` con tu correo, `BETTER_AUTH_URL` con la URL pública exacta del toolkit (la de Cloudflare; las passkeys y las cookies dependen de ella), y opcionalmente SMTP y `CLOUDFLARE_TUNNEL_TOKEN`. Liquibase usa por defecto el mismo usuario de PostgreSQL. Genera contraseñas aleatorias y mantén `DATABASE_URL` correctamente codificada; no reutilices credenciales. El servicio `tunnel` mantiene una conexión saliente con Cloudflare y comparte una red Docker con `app`; en el panel de Cloudflare, configura el hostname público para que llegue a `http://app:3000`. No abras puertos entrantes en el router ni publiques PostgreSQL.

Los ajustes propios del servidor (por ejemplo publicar la app en la IP de la LAN) van en un `compose.override.yaml` junto al checkout, que está fuera de Git y Docker Compose combina automáticamente con `compose.yaml`; así no bloquean los deploys:

```yaml
services:
  app:
    ports:
      - "192.168.1.210:3000:3000"
```

Si abres el toolkit desde varias URLs (la de la LAN y la pública), pon la principal en `BETTER_AUTH_URL` y las demás en `BETTER_AUTH_TRUSTED_ORIGINS`, separadas por comas. Con `http://` las cookies de sesión no se marcan como seguras para que el inicio de sesión funcione en la LAN; las passkeys necesitan HTTPS.

El token del túnel es un secreto: guárdalo solo en el `.env` del servidor, que está excluido de Git. Usa un túnel dedicado para este servicio y limita su hostname al toolkit.

## Cabeceras de seguridad y límites de uso

- **CSP** (`src/proxy.ts`, `src/lib/security-headers.ts`): se genera por petición con un nonce para los scripts de Next y el hash del script del tema; no se usa `'unsafe-inline'` en scripts. Los estilos sí lo permiten porque la UI usa atributos `style`. Las imágenes de monstruos se permiten desde `www.dnd5eapi.co`. No se activa `upgrade-insecure-requests` porque la app también se abre por `http://` en la LAN.
- **Resto de cabeceras** (`next.config.ts`): `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y `X-Frame-Options` (más `frame-ancestors 'none'` en la CSP).
- **HSTS**: solo se envía si `BETTER_AUTH_URL` empieza por `https://`, y se lee al arrancar el servidor (la imagen se construye sin `.env`). Sin `includeSubDomains` ni `preload`.
- **Rate limiting**: better-auth ya limita inicio de sesión, registro y restablecimiento (`auth.ts`). Las rutas de datos tienen un limitador propio en memoria (`src/lib/rate-limit.ts`), por usuario: 60 escrituras/min, 10 invitaciones/min, 20 altas de miembros/min y 5 importaciones cada 10 min. Los contadores viven en el proceso: con varias réplicas el límite efectivo se multiplica y un reinicio los pone a cero. Hoy `compose.yaml` ejecuta una sola instancia `app`.
- **Tamaño de cuerpo**: las rutas JSON rechazan cuerpos de más de 64 KB (4 MB en `/api/import`).

## Deploy con runner self-hosted

El workflow `Deploy` se lanza solo cuando el CI de `main` termina bien, o a mano desde Actions → Deploy → Run workflow (eligiendo rama). Corre en el propio servidor con un runner self-hosted:

1. En GitHub: Settings → Actions → Runners → New self-hosted runner → Linux x64, y sigue los comandos en el servidor (`./config.sh --url https://github.com/Demi-12/grimoire --token ...`).
2. Instálalo como servicio para que siga activo tras reiniciar: `sudo ./svc.sh install && sudo ./svc.sh start`.
3. Da acceso a Docker al usuario del runner: `sudo usermod -aG docker <usuario>` y reinicia el servicio (`sudo ./svc.sh stop && sudo ./svc.sh start`).
4. Comprueba que en Settings → Actions → Runners aparece en verde como *Idle*.

El job pide las etiquetas `self-hosted` y `linux`, que el runner Linux tiene por defecto. El checkout de producción está en `~/grimoire` (se clona solo si no existe; se puede cambiar con la variable de repo `GRIMOIRE_DIR`) y debe contener el `.env`. Si el `.env` tiene `CLOUDFLARE_TUNNEL_TOKEN`, también se levanta el túnel; si no, solo `app` y `db`. Antes de reconstruir la app levanta `db` y aplica las migraciones de Liquibase; el `.env` necesita además las variables de Better Auth, SMTP y Liquibase de `.env.example`.

## Usuarios y acceso

Grimoire es privado: hay que iniciar sesión para usarlo. Cualquiera puede registrarse, pero la cuenta queda **pendiente** hasta que un admin la apruebe en **Usuarios**. Mientras tanto, esa persona solo ve un aviso de espera. Se puede entrar con correo y contraseña o passkey.

- **Admin del sitio:** pon tu correo en `GRIMOIRE_ADMIN_EMAILS` (en el `.env` del servidor; admite varios separados por comas). Esa cuenta se aprueba y es admin al registrarse o en su próximo acceso, también si ya existía. El admin aprueba las cuentas nuevas y puede bloquear (cierra sus sesiones y le impide entrar), cerrar sesiones o borrar cuentas, y asignar otros admins. No puede modificarse a sí mismo y siempre queda al menos un admin aprobado.
- **DM y jugador son por campaña:** quien crea una campaña es su DM; quien se une por enlace de invitación es jugador, y el DM puede ascender a co-DM. El rol es independiente en cada campaña: la misma cuenta puede ser DM en una y jugador en otra. Todas las herramientas (personajes, generador de encuentros, bestiario) están disponibles para todas las cuentas; el diario de encuentros de una campaña solo lo ven sus DMs.
- **Campañas compartidas:** el DM crea la campaña y suma gente con enlaces de invitación o escribiendo el correo o nombre exacto de la cuenta desde su campaña (no hay lista de cuentas: solo el admin del sitio las ve, en **Usuarios**; si un nombre se repite, hay que usar el correo). Cada jugador pone sus personajes en la campaña; todos los miembros ven el grupo y el generador de encuentros puede cargar el grupo de una campaña de un clic. Solo el dueño edita su personaje; el DM puede sacarlo de la campaña. Al borrar una campaña los personajes vuelven a sus dueños.
- **Datos anteriores:** si el navegador tenía personajes o campañas de la versión local, el resumen ofrece importarlos a la cuenta una vez.

Personajes (incluidas las elecciones del creador paso a paso) y campañas viven en PostgreSQL (migración `database/changelog/db.changelog-app.yaml`). El catálogo de criaturas de cada cuenta y los monstruos homebrew también viven en PostgreSQL.

## Primera versión

- El creador de personajes guía paso a paso con las reglas de 2024 (SRD 5.2): clase, trasfondo (aumentos de característica, dote de origen, habilidades), especie, características (matriz estándar, compra por 27 puntos o 4d6), competencias, equipo inicial y detalles. La ficha calcula PG, CA, iniciativa, salvaciones, habilidades con pericia, percepción pasiva, CD de conjuros y oro, y se imprime con esos valores. Los personajes antiguos siguen editándose con la edición rápida.
- El creador incluye los 16 trasfondos del Manual del Jugador 2024, sus 10 dotes de origen y las 10 especies; se puede elegir cualquiera de las 48 subclases del Manual del Jugador 2024, pero solo la del SRD (una por clase) tiene sus rasgos en la ficha; las demás se muestran por nombre y sus rasgos se consultan en el libro.
- **Ficha completa en la web:** cada tarjeta tiene un botón *Ver ficha* que abre `/characters/<id>` con todo lo del personaje: características, tiradas de salvación, las 18 habilidades con competencia y pericia, CA, PG, iniciativa, velocidad, percepción pasiva, ataques, rasgos de clase y de especie, dotes, competencias, lenguas, equipo, oro, historia y notas. Los personajes hechos con el creador paso a paso muestran todos los cálculos; los de edición rápida solo características y notas. El DM y los jugadores de una campaña pueden abrir la ficha de los demás miembros (en solo lectura) desde la lista de héroes de la campaña. *Exportar hoja · PDF* sigue imprimiendo la hoja de 2 páginas.
- El generador usa presupuestos por personaje de dificultad baja, moderada y alta; suma el presupuesto según el nivel de cada aventurero y propone combinaciones que no exceden el total.
- El generador puede usar todos los monstruos del SRD desde la API pública de D&D 5e (dnd5eapi.co), filtrar por tipo de criatura y limitar cada encuentro a 1-3 tipos de criatura. El servidor descarga el catálogo la primera vez (unos segundos) y lo guarda en memoria un día; necesita salida a Internet.
- El catálogo inicial usa perfiles genéricos. Puedes añadir criaturas propias con sus XP; el catálogo queda en el almacenamiento local del navegador.
- Las cuentas incluyen registro e inicio de sesión, recuperación de contraseña por correo, 2FA TOTP con códigos de respaldo y passkeys. No se verifica el correo al registrarse: las cuentas nuevas quedan pendientes hasta que un admin las aprueba. La recuperación usa SMTP de cualquier proveedor (p. ej. Brevo) y es opcional: sin SMTP no se puede recuperar la contraseña por correo. El TOTP protege el acceso con contraseña; el acceso con passkey es passwordless y no pide un segundo código por defecto.
- El bestiario consulta la API pública del SRD de D&D 5e (dnd5eapi.co) desde rutas del servidor, usando el SRD 2024 y, si no tiene monstruos, el SRD 2014, muestra fichas de monstruos y permite añadirlos al generador. Las etiquetas tácticas se infieren de sus estadísticas y no sustituyen el juicio del DM.
- **Monstruos homebrew:** en el bestiario, la pestaña *Homebrew* permite crear monstruos con una ficha completa (características, defensas, velocidades, sentidos, rasgos, acciones, reacciones y acciones legendarias) con vista previa en vivo. El XP y la competencia se calculan a partir del valor de desafío. Cada monstruo es **privado** por defecto; su autor puede compartirlo con campañas de las que es miembro o publicarlo para **todas las cuentas del servidor**. Los monstruos homebrew se añaden al generador de encuentros igual que los del SRD y su ficha se abre desde allí. Un admin puede retirar y **bloquear** un monstruo publicado (vuelve a privado y su autor no puede volver a publicarlo hasta que se desbloquee), pero nunca ve el trabajo privado de otras cuentas. Aún no hay copiar un monstruo público a tu cuenta, tiradas de salvación ni habilidades con pericia en el editor.
- Las propuestas son orientativas. Revisa capacidades especiales, composición y contexto antes de usar un encuentro.

## Atribución de reglas

La tabla de presupuestos de encuentros se basa en System Reference Document 5.2.1 (SRD 5.2.1) de Wizards of the Coast LLC, disponible en https://www.dndbeyond.com/srd y licenciada bajo Creative Commons Attribution 4.0 International (CC BY 4.0). Grimoire no está afiliado a Wizards of the Coast.
