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
- El deploy requiere `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` y `DEPLOY_KNOWN_HOSTS` como secretos del Environment `production`; `DEPLOY_PORT` es una variable opcional no secreta. La clave SSH debe ser exclusiva, de privilegio mínimo y restringida a la tarea de despliegue.

## Servidor y acceso público

El servidor debe tener Git, Docker Compose v2 y un checkout de este repositorio en `~/grimoire`. Crea allí un `.env` fuera de Git con `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL` y `CLOUDFLARE_TUNNEL_TOKEN`. Genera contraseñas aleatorias y mantén `DATABASE_URL` correctamente codificada; no reutilices credenciales. El servicio `tunnel` mantiene una conexión saliente con Cloudflare y comparte una red Docker con `app`; en el panel de Cloudflare, configura el hostname público para que llegue a `http://app:3000`. No abras puertos entrantes en el router ni publiques PostgreSQL.

El token del túnel es un secreto: guárdalo solo en el `.env` del servidor, que está excluido de Git. Usa un túnel dedicado para este servicio y limita su hostname al toolkit.

El workflow actualiza el checkout a un commit concreto tras CI. No habilites el Environment de producción ni añadas sus secretos hasta que el servidor y su clave de host estén verificados.

## Primera versión

- El creador guarda nombre, clase, especie, trasfondo, nivel, puntuaciones y notas. Calcula modificadores de característica y bonificador por competencia.
- El generador usa presupuestos por personaje de dificultad baja, moderada y alta; suma el presupuesto según el nivel de cada aventurero y propone combinaciones que no exceden el total.
- El catálogo inicial usa perfiles genéricos. Puedes añadir criaturas propias con sus XP. Los datos quedan en el almacenamiento local del navegador; todavía no se guardan en PostgreSQL ni se sincronizan entre dispositivos.
- Las propuestas son orientativas. Revisa capacidades especiales, composición y contexto antes de usar un encuentro.

## Atribución de reglas

La tabla de presupuestos de encuentros se basa en System Reference Document 5.2.1 (SRD 5.2.1) de Wizards of the Coast LLC, disponible en https://www.dndbeyond.com/srd y licenciada bajo Creative Commons Attribution 4.0 International (CC BY 4.0). Grimoire no está afiliado a Wizards of the Coast.
