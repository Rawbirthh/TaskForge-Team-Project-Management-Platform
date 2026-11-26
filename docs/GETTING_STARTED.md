# Getting Started with TaskForge

This guide explains how to set up TaskForge **after cloning the repository** and how to run it day to day. Commands are written for PowerShell on Windows; they also work in other shells with minor syntax changes.

> The repository contains no `.env` files. You must create them after cloning — see [Step 3](#3-configure-environment-files).

---

## Quick start

```powershell
# 1. Clone and enter the repository
git clone <repository-url> Taskforge
cd Taskforge

# 2. Install tooling and dependencies
corepack enable
pnpm install

# 3. Create the databases/user, then the env files (see steps 2 and 3)
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/api/.env.test.example apps/api/.env.test
# Edit both files and replace change-me with your password

# 4. Apply migrations and seed
pnpm db:deploy
pnpm db:seed
pnpm db:migrate:test

# 5. Run the app
pnpm dev
```

Open:

- Web app: <http://localhost:5173>
- Dashboard: <http://localhost:5173/app>
- API health: <http://localhost:4000/api/v1/health>
- API readiness: <http://localhost:4000/api/v1/health/ready>

---

## 1. Prerequisites

| Requirement | Version | Check command |
| --- | --- | --- |
| Node.js | `>= 24` (24.13.0 used here) | `node --version` |
| pnpm | `>= 12` (12.23.0 used here) | `pnpm --version` |
| Corepack | enabled | `corepack enable` |
| MySQL or MariaDB | MariaDB 10.4+ or MySQL 8+ recommended | Server running and reachable |

Node 24 ships with Corepack, but you may need to enable it once:

```powershell
corepack enable
corepack prepare pnpm@12.23.0 --activate
```

Do **not** use npm to install this workspace. The repository pins `packageManager: "pnpm@12.23.0"` and uses pnpm workspace features.

### Database on this machine

The development environment for this project uses the XAMPP MariaDB 10.4 instance on port **3309**. Other local MySQL instances (5.6, 5.7, and 8.0 on ports 3306–3308) exist but are not used by TaskForge.

If you clone this project on a different machine, any MySQL/MariaDB server you control is fine. Just set the host, port, user, password, and database names in the env files to match your setup.

---

## 2. Create the databases and user

TaskForge uses three separate databases so development, tests, and migration creation never touch each other:

| Database | Purpose |
| --- | --- |
| `taskforge` | Development data |
| `taskforge_test` | Isolated Vitest integration tests |
| `taskforge_shadow` | Prisma shadow database for `prisma migrate dev` |

Sign in to phpMyAdmin (or your MySQL client) with an **admin** account and run:

```sql
CREATE DATABASE IF NOT EXISTS taskforge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS taskforge_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS taskforge_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'taskforge'@'localhost' IDENTIFIED BY '<choose-a-strong-password>';
CREATE USER IF NOT EXISTS 'taskforge'@'127.0.0.1' IDENTIFIED BY '<choose-a-strong-password>';

GRANT ALL PRIVILEGES ON taskforge.* TO 'taskforge'@'localhost';
GRANT ALL PRIVILEGES ON taskforge_test.* TO 'taskforge'@'localhost';
GRANT ALL PRIVILEGES ON taskforge_shadow.* TO 'taskforge'@'localhost';
GRANT ALL PRIVILEGES ON taskforge.* TO 'taskforge'@'127.0.0.1';
GRANT ALL PRIVILEGES ON taskforge_test.* TO 'taskforge'@'127.0.0.1';
GRANT ALL PRIVILEGES ON taskforge_shadow.* TO 'taskforge'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Use the same strong password in both `CREATE USER` statements. The application never uses the root account.

> If `FLUSH PRIVILEGES` reports an Aria checksum error on the local XAMPP instance, check `CHECK TABLE mysql.db;` and, if needed, `REPAIR TABLE mysql.db;`. Grants may already be active; verify by connecting with the `taskforge` user.

---

## 3. Configure environment files

From the repository root:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/api/.env.test.example apps/api/.env.test
```

Edit both files and replace `change-me` with the password from Step 2.

`apps/api/.env` controls the development API:

| Variable | Meaning |
| --- | --- |
| `NODE_ENV` | `development` for local work |
| `PORT` | HTTP port for the API (default `4000`) |
| `DATABASE_URL` | Development database connection string |
| `SHADOW_DATABASE_URL` | Shadow database used by `prisma migrate dev` |
| `CORS_ORIGINS` | Comma-separated allowed browser origins; no wildcard |
| `LOG_LEVEL` | Pino log level |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | Global rate-limit settings |
| `APP_VERSION` | Version reported by the health endpoint |

`apps/api/.env.test` contains only `TEST_DATABASE_URL`, pointing at `taskforge_test`. If it is missing, the MySQL integration test is skipped instead of touching the development database.

Optional frontend configuration:

```powershell
Copy-Item apps/web/.env.example apps/web/.env
```

`VITE_API_BASE_URL` defaults to `/api/v1`, which the Vite dev server proxies to `http://localhost:4000`. Change it only if the API is served from another origin.

> `.env` and `.env.test` are gitignored. Never commit them or paste their values into chat, issues, or docs.

---

## 4. Install dependencies

```powershell
pnpm install
```

This installs both workspace apps and runs `prisma generate`, which writes the generated Prisma client to `apps/api/src/generated/prisma`. Generation does not require a live database connection.

---

## 5. Apply migrations and seed

Run these from the repository root:

```powershell
pnpm db:deploy        # apply the tracked migration to taskforge
pnpm db:seed          # idempotent schema.version=1 seed
pnpm db:status        # confirm the development schema is up to date

pnpm db:migrate:test  # apply the same migration to taskforge_test
pnpm db:status:test   # confirm the test schema is up to date
```

Use `pnpm db:migrate` when you create a **new** migration from schema changes. It uses `SHADOW_DATABASE_URL`. Never edit a migration that has already been applied.

### Which database does each migration command touch?

When you create a new migration with:

```powershell
pnpm --filter @taskforge/api exec prisma migrate dev --name your_change_name
```

| Database | Affected? | Details |
| --- | --- | --- |
| `taskforge` (dev) | ✅ Yes | The migration is applied here permanently. |
| `taskforge_shadow` | ✅ Yes | Prisma uses it as a scratch database to calculate and verify the SQL. It is reset/used during the command; do not store real data there. |
| `taskforge_test` | ❌ No | `migrate dev` never touches the test database. |

That is why you run `pnpm db:migrate:test` separately — it applies the same migrations to `taskforge_test` using `migrate deploy` and does not need the shadow database.

If you use `--create-only`, the first command only generates the SQL and does **not** apply it to dev; then run `pnpm db:deploy` followed by `pnpm db:migrate:test`.

---

## 6. Run the application

### Development

```powershell
pnpm dev
```

This starts both apps in parallel:

- API: `http://localhost:4000` (watch mode)
- Web: `http://localhost:5173` (Vite dev server with `/api` proxy)

To run only one side:

```powershell
pnpm dev:api
pnpm dev:web
```

### Verify it works

```powershell
Invoke-RestMethod http://localhost:4000/api/v1/health
Invoke-RestMethod http://localhost:4000/api/v1/health/ready
```

`health` returns `status: ok`. `ready` returns `status: ready` and `checks.database: ok` only if Prisma can query the migrated database.

### Production-style build

```powershell
pnpm build
pnpm --filter @taskforge/api start
pnpm --filter @taskforge/web preview
```

For production, set `NODE_ENV=production` and an explicit `CORS_ORIGINS` value in the API environment. The config validator rejects the default localhost origin in production, and it never allows `*`.

---

## 7. Common commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | API + web in watch mode |
| `pnpm dev:api` / `pnpm dev:web` | One app only |
| `pnpm build` | Type-check and build both apps |
| `pnpm typecheck` | Strict TypeScript checks |
| `pnpm lint` / `pnpm lint:fix` | ESLint check / fix |
| `pnpm format` / `pnpm format:check` | Prettier write / check |
| `pnpm test` | Vitest suites for API and web |
| `pnpm test:e2e` | Playwright browser tests |
| `pnpm db:generate` | Regenerate Prisma client after schema edits |
| `pnpm db:migrate` | Create/apply a new development migration |
| `pnpm db:deploy` | Apply tracked migrations without prompts |
| `pnpm db:status` | Show development migration status |
| `pnpm db:migrate:test` / `db:status:test` | Apply/inspect test database migrations |
| `pnpm db:seed` | Re-run the idempotent seed |
| `pnpm db:studio` | Prisma Studio for the development database |

---

## 8. Tests

```powershell
pnpm test
```

- API: unit tests for config, validation, error handling, CORS, request IDs, plus an integration test that runs only when `TEST_DATABASE_URL` is configured.
- Web: API client, component interaction, and route rendering tests.

End-to-end tests need a browser binary:

```powershell
pnpm --filter @taskforge/web exec playwright install chromium
pnpm test:e2e
```

The Playwright config starts the Vite dev server automatically at `http://127.0.0.1:5173`.

---

## 9. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `Invalid environment configuration` on API start | `apps/api/.env` missing, or `DATABASE_URL`/`CORS_ORIGINS` malformed. Copy the example and fill it in. |
| Readiness returns `503 NOT_READY` | Database unreachable or migration not applied. Check `DATABASE_URL`, start the DB, then run `pnpm db:deploy`. |
| `CORS_ORIGIN_DENIED` in the browser | Add the browser origin to `CORS_ORIGINS` and restart the API. |
| Prisma says shadow database missing | Set `SHADOW_DATABASE_URL` and create `taskforge_shadow` with the same user. |
| Integration test is skipped | `apps/api/.env.test` missing or `TEST_DATABASE_URL` unset. |
| `pnpm` command not found | Run `corepack enable` and restart the terminal. |
| Port already in use | Change `PORT` in `apps/api/.env`. If you move the API off `4000`, also update the `/api` proxy target in `apps/web/vite.config.ts`. |
| `mysql.db` checksum / grant errors on XAMPP | Run `CHECK TABLE mysql.db;` and `REPAIR TABLE mysql.db;` with an admin account, then re-check grants. |

---

## 10. Repository conventions

- One Express API (`apps/api`) and one React app (`apps/web`) in a pnpm workspace.
- API routes live under `/api/v1`; success responses use `{ data }`, errors use `{ error }`.
- All backend inputs and startup configuration are validated with Zod; raw request objects are never passed to Prisma.
- The API and committed database state are the source of truth. Socket.IO, background jobs, and S3 are added only when their features are approved.
- Feature work follows `/architect <feature>` → explicit approval → `/develop <feature>` in dependency order, starting with Feature 5 (authentication).

See [README.md](../README.md) for the stack overview and [docs/architecture/baseline.md](architecture/baseline.md) for the verified environment audit.
