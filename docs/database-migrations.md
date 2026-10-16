# Database migrations with Liquibase

Grimoire stores reviewed Liquibase changesets under `database/changelog/`, with `database/changelog/db.changelog-master.yaml` as the entry point. Keep schema changes in those files; do not edit a changeset after it has been applied to a shared database. Add a new changeset with a unique `id` and `author` instead.

## Pull request checks

The `Liquibase validation` workflow runs when a pull request changes a changelog or its migration configuration. It uses Liquibase `4.33.0` and a disposable PostgreSQL 17 service with CI-only credentials. It runs `validate`, `update-sql`, then `update` against that disposable database to catch changeset execution errors. It does not access a production or persistent database and does not need GitHub secrets.

Review the generated SQL and the changeset's effect on existing data as part of the PR. Add explicit Liquibase rollback definitions where a safe rollback is possible. A rollback is not guaranteed for every PostgreSQL operation; prefer a new forward corrective changeset for deployed changes unless a reviewed rollback plan says otherwise.

## Protected production deployment

The existing `Deploy` workflow runs after a successful `CI` workflow for `main`. On the server it checks out the exact successful SHA, starts PostgreSQL with `docker compose up -d db`, applies Liquibase using `docker compose -f compose.yaml -f compose.liquibase.yaml run --rm liquibase update`, and only then updates the app containers with `docker compose up -d --build --remove-orphans`. The migration container is removed after the command exits. Production DB access stays private; PostgreSQL is not exposed to the GitHub runner or the Internet.

Configure the GitHub repository's `production` Environment with required reviewers and restrict its deployment branch to `main`. Add these **Environment secrets** (never commit their values):

| Secret | Purpose |
| --- | --- |
| `DEPLOY_HOST` | SSH hostname for the self-hosted server |
| `DEPLOY_USER` | Restricted SSH deployment account |
| `DEPLOY_SSH_KEY` | Private SSH key for that account |
| `DEPLOY_KNOWN_HOSTS` | Verified SSH host key entry |

The existing optional non-secret Environment variable `DEPLOY_PORT` defaults to `22`. Database credentials are not stored in GitHub: the migration container reads `LIQUIBASE_DB_USERNAME` and `LIQUIBASE_DB_PASSWORD` from the self-hosted server's local `.env` through Compose interpolation. Create a dedicated PostgreSQL migration role with only the schema privileges needed for migrations. Keep `.env` private; Compose also reads `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`, and the tunnel token there. The GitHub workflow only has SSH access and never sends database credentials.

## Backups, rollback, and review

Before enabling a production migration, arrange a recent, verified PostgreSQL backup on storage outside the Git checkout and outside the database container. Test restoring it to a separate database/server. For example, on the server, create a dump using its local Compose configuration and write it to a protected backup location; never commit or upload a dump as a workflow artifact. Protect and encrypt off-host copies according to the server's backup policy. Do not proceed with a destructive migration unless the backup is recent and the restore procedure has been checked.

Reviewers should check the SQL Liquibase generates, table/column lock impact, data backfills, index creation, nullability/default transitions, and the stated recovery plan. Liquibase does not automatically restore a database when a deployment fails. Use a changeset-specific `rollback` only after reviewing its exact SQL and confirming that intervening writes will not be lost. Otherwise, restore the verified backup or deploy a forward-fix changeset. For a production incident, pause further deployments first and record the affected commit and `DATABASECHANGELOG` entry before recovery.

## Self-host operation

The server needs Docker Compose v2 and outbound access to pull the pinned Liquibase image on the first migration. The `liquibase` service is defined in `compose.liquibase.yaml` and joins the existing internal `backend` network; it has no published ports and mounts changelog files read-only. The deploy account needs permission to run the repository's Compose project and pull the Liquibase image. Keep the PostgreSQL volume and local `.env` intact during app updates. A manual migration should use the exact checked-out release revision and the same local migration credentials; do not run `update` from a workstation against production.

Never enable shell tracing (`set -x`) around secret handling, and do not put credentials in command arguments, changelog files, `.env.example`, logs, or GitHub artifacts. If any credential is exposed, revoke and rotate it immediately.
