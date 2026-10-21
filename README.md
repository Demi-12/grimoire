# Grimoire

Toolkit autohospedado para preparar partidas de Dungeons & Dragons 5e (2024). Incluye un creador inicial de personajes y un generador de encuentros basado en el presupuesto de XP de las reglas de 2024.

## Desarrollo local

Requisitos: Node.js 22+ y pnpm 11. Copia `.env.example` a `.env` solo si vas a configurar servicios locales. Los archivos `.env*` están ignorados por Git y excluidos del contexto Docker salvo `.env.example`.

```sh
corepack enable
pnpm install
pnpm dev
```

Si Windows indica que `npm` no se reconoce, instala o repara Node.js 22 desde el instalador oficial; npm viene incluido. Comprueba `node -v` y `npm -v` en una terminal nueva. Este proyecto usa pnpm, que puedes habilitar con `corepack enable` si Corepack está disponible. En el entorno de Codex no hay npm en PATH, pero sí pnpm, así que no fue necesario bloquear la implementación.

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

## Deploy con runner self-hosted

El workflow `Deploy` se lanza solo cuando el CI de `main` termina bien, o a mano desde Actions → Deploy → Run workflow (eligiendo rama). Corre en el propio servidor con un runner self-hosted:

1. En GitHub: Settings → Actions → Runners → New self-hosted runner → Linux x64, y sigue los comandos en el servidor (`./config.sh --url https://github.com/Demi-12/grimoire --token ...`).
2. Instálalo como servicio para que siga activo tras reiniciar: `sudo ./svc.sh install && sudo ./svc.sh start`.
3. Da acceso a Docker al usuario del runner: `sudo usermod -aG docker <usuario>` y reinicia el servicio (`sudo ./svc.sh stop && sudo ./svc.sh start`).
4. Comprueba que en Settings → Actions → Runners aparece en verde como *Idle*.

El job pide las etiquetas `self-hosted` y `linux`, que el runner Linux tiene por defecto. El checkout de producción está en `~/grimoire` (se clona solo si no existe; se puede cambiar con la variable de repo `GRIMOIRE_DIR`) y debe contener el `.env`. Si el `.env` tiene `CLOUDFLARE_TUNNEL_TOKEN`, también se levanta el túnel; si no, solo `app` y `db`. Antes de reconstruir la app levanta `db` y aplica las migraciones de Liquibase; el `.env` necesita además las variables de Better Auth, SMTP y Liquibase de `.env.example`.

## Usuarios y acceso

Grimoire es privado: hay que iniciar sesión para usarlo, pero cualquiera puede registrarse y la cuenta se activa al instante (sin aprobación de un admin). Se puede entrar con correo y contraseña, passkey o **Google**.

- **Admin del sitio:** pon tu correo en `GRIMOIRE_ADMIN_EMAILS` (en el `.env` del servidor; admite varios separados por comas). Esa cuenta es admin al registrarse o en su próximo acceso, también si ya existía. El admin puede bloquear (cierra sus sesiones y le impide entrar), cerrar sesiones o borrar cuentas, y asignar otros admins. No puede modificarse a sí mismo y siempre queda al menos un admin.
- **DM y jugador son por campaña:** quien crea una campaña es su DM; quien se une (por enlace de invitación o porque el DM lo añade) es jugador, y el DM puede ascender a co-DM. Todas las herramientas (personajes, generador de encuentros, bestiario) están disponibles para todas las cuentas; el diario de encuentros de una campaña solo lo ven sus DMs.
- **Google:** crea un cliente OAuth (aplicación web) en Google Cloud con `${BETTER_AUTH_URL}/api/auth/callback/google` como URI de redirección y rellena `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. Sin ellos el botón no aparece. Si ya existe una cuenta con el mismo correo, Google inicia sesión en ella.
- **Campañas compartidas:** el DM crea la campaña y añade cuentas como jugadores o co-DMs. Cada jugador pone sus personajes en la campaña; todos los miembros ven el grupo y el generador de encuentros puede cargar el grupo de una campaña de un clic. Solo el dueño edita su personaje; el DM puede sacarlo de la campaña. Al borrar una campaña los personajes vuelven a sus dueños.
- **Datos anteriores:** si el navegador tenía personajes o campañas de la versión local, el resumen ofrece importarlos a la cuenta una vez.

Personajes (incluidas las elecciones del creador paso a paso) y campañas viven en PostgreSQL (migración `database/changelog/db.changelog-app.yaml`). El catálogo de criaturas propio sigue guardándose en el navegador de cada cuenta.

## Primera versión

- El creador de personajes guía paso a paso con las reglas de 2024 (SRD 5.2): clase, trasfondo (aumentos de característica, dote de origen, habilidades), especie, características (matriz estándar, compra por 27 puntos o 4d6), competencias, equipo inicial y detalles. La ficha calcula PG, CA, iniciativa, salvaciones, habilidades con pericia, percepción pasiva, CD de conjuros y oro, y se imprime con esos valores. Los personajes antiguos siguen editándose con la edición rápida.
- El creador incluye los 16 trasfondos del Manual del Jugador 2024, sus 10 dotes de origen y las 10 especies; solo hay una subclase por clase (la del SRD), para otras usa las notas o la edición rápida.
- El generador usa presupuestos por personaje de dificultad baja, moderada y alta; suma el presupuesto según el nivel de cada aventurero y propone combinaciones que no exceden el total.
- El generador puede usar todos los monstruos del SRD desde la API pública de D&D 5e (dnd5eapi.co), filtrar por tipo de criatura y limitar cada encuentro a 1-3 tipos de criatura. El servidor descarga el catálogo la primera vez (unos segundos) y lo guarda en memoria un día; necesita salida a Internet.
- El catálogo inicial usa perfiles genéricos. Puedes añadir criaturas propias con sus XP; el catálogo queda en el almacenamiento local del navegador.
- Las cuentas incluyen registro e inicio de sesión, recuperación de contraseña por correo, 2FA TOTP con códigos de respaldo y passkeys. No se verifica el correo al registrarse. La recuperación usa SMTP de cualquier proveedor (p. ej. Brevo) y es opcional: sin SMTP no se puede recuperar la contraseña por correo. El TOTP protege el acceso con contraseña; el acceso con passkey es passwordless y no pide un segundo código por defecto.
- El bestiario consulta la API pública del SRD de D&D 5e (dnd5eapi.co) desde rutas del servidor, usando el SRD 2024 y, si no tiene monstruos, el SRD 2014, muestra fichas de monstruos y permite añadirlos al generador. Las etiquetas tácticas se infieren de sus estadísticas y no sustituyen el juicio del DM.
- Las propuestas son orientativas. Revisa capacidades especiales, composición y contexto antes de usar un encuentro.

## Atribución de reglas

La tabla de presupuestos de encuentros se basa en System Reference Document 5.2.1 (SRD 5.2.1) de Wizards of the Coast LLC, disponible en https://www.dndbeyond.com/srd y licenciada bajo Creative Commons Attribution 4.0 International (CC BY 4.0). Grimoire no está afiliado a Wizards of the Coast.
