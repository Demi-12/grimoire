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

El servidor debe tener Git, Docker Compose v2 y un checkout de este repositorio en `~/grimoire`. Crea allí un `.env` fuera de Git con las variables de `.env.example`: PostgreSQL, `BETTER_AUTH_SECRET` (genera uno con `openssl rand -base64 32`) y `BETTER_AUTH_URL` con la URL pública exacta del toolkit (la de Cloudflare; las passkeys y las cookies dependen de ella), y opcionalmente SMTP y `CLOUDFLARE_TUNNEL_TOKEN`. Liquibase usa por defecto el mismo usuario de PostgreSQL. Genera contraseñas aleatorias y mantén `DATABASE_URL` correctamente codificada; no reutilices credenciales. El servicio `tunnel` mantiene una conexión saliente con Cloudflare y comparte una red Docker con `app`; en el panel de Cloudflare, configura el hostname público para que llegue a `http://app:3000`. No abras puertos entrantes en el router ni publiques PostgreSQL.

El token del túnel es un secreto: guárdalo solo en el `.env` del servidor, que está excluido de Git. Usa un túnel dedicado para este servicio y limita su hostname al toolkit.

## Deploy con runner self-hosted

El workflow `Deploy` se lanza solo cuando el CI de `main` termina bien, o a mano desde Actions → Deploy → Run workflow (eligiendo rama). Corre en el propio servidor con un runner self-hosted:

1. En GitHub: Settings → Actions → Runners → New self-hosted runner → Linux x64, y sigue los comandos en el servidor (`./config.sh --url https://github.com/Demi-12/grimoire --token ...`).
2. Instálalo como servicio para que siga activo tras reiniciar: `sudo ./svc.sh install && sudo ./svc.sh start`.
3. Da acceso a Docker al usuario del runner: `sudo usermod -aG docker <usuario>` y reinicia el servicio (`sudo ./svc.sh stop && sudo ./svc.sh start`).
4. Comprueba que en Settings → Actions → Runners aparece en verde como *Idle*.

El job pide las etiquetas `self-hosted` y `linux`, que el runner Linux tiene por defecto. El checkout de producción está en `~/grimoire` (se clona solo si no existe; se puede cambiar con la variable de repo `GRIMOIRE_DIR`) y debe contener el `.env`. Si el `.env` tiene `CLOUDFLARE_TUNNEL_TOKEN`, también se levanta el túnel; si no, solo `app` y `db`. Antes de reconstruir la app levanta `db` y aplica las migraciones de Liquibase; el `.env` necesita además las variables de Better Auth, SMTP y Liquibase de `.env.example`.

## Primera versión

- El creador de personajes guía paso a paso con las reglas de 2024 (SRD 5.2): clase, trasfondo (aumentos de característica, dote de origen, habilidades), especie, características (matriz estándar, compra por 27 puntos o 4d6), competencias, equipo inicial y detalles. La ficha calcula PG, CA, iniciativa, salvaciones, habilidades con pericia, percepción pasiva, CD de conjuros y oro, y se imprime con esos valores. Los personajes antiguos siguen editándose con la edición rápida.
- El SRD solo incluye cuatro trasfondos (Acólito, Criminal, Sabio, Soldado) y una subclase por clase; para opciones del manual completo, usa las notas o la edición rápida.
- El generador usa presupuestos por personaje de dificultad baja, moderada y alta; suma el presupuesto según el nivel de cada aventurero y propone combinaciones que no exceden el total.
- El generador puede usar todos los monstruos del SRD desde la API pública de D&D 5e (dnd5eapi.co), filtrar por tipo de criatura y limitar cada encuentro a 1-3 tipos de criatura. El servidor descarga el catálogo la primera vez (unos segundos) y lo guarda en memoria un día; necesita salida a Internet.
- El catálogo inicial usa perfiles genéricos. Puedes añadir criaturas propias con sus XP. Los datos quedan en el almacenamiento local del navegador; todavía no se guardan en PostgreSQL ni se sincronizan entre dispositivos.
- Las cuentas incluyen registro e inicio de sesión, verificación y recuperación por correo, 2FA TOTP con códigos de respaldo y passkeys. SMTP es opcional: si lo configuras se exige verificar el correo y se puede recuperar la contraseña; sin SMTP las cuentas funcionan pero sin verificación ni recuperación por correo. El TOTP protege el acceso con contraseña; el acceso con passkey es passwordless y no pide un segundo código por defecto.
- El gestor permite agrupar personajes en campañas. Las campañas, los personajes y el catálogo se guardan localmente en el navegador bajo el perfil activo; cada cuenta usa su propio espacio local, pero los datos aún no se sincronizan entre dispositivos. Los personajes del perfil local previo al inicio de sesión no se copian automáticamente a una cuenta.
- El bestiario consulta la API pública del SRD de D&D 5e (dnd5eapi.co) desde rutas del servidor, usando el SRD 2024 y, si no tiene monstruos, el SRD 2014, muestra fichas de monstruos y permite añadirlos al generador. Las etiquetas tácticas se infieren de sus estadísticas y no sustituyen el juicio del DM.
- Las propuestas son orientativas. Revisa capacidades especiales, composición y contexto antes de usar un encuentro.

## Atribución de reglas

La tabla de presupuestos de encuentros se basa en System Reference Document 5.2.1 (SRD 5.2.1) de Wizards of the Coast LLC, disponible en https://www.dndbeyond.com/srd y licenciada bajo Creative Commons Attribution 4.0 International (CC BY 4.0). Grimoire no está afiliado a Wizards of the Coast.
