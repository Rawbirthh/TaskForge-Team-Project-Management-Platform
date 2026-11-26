# TaskForge

TaskForge is a multi-tenant team project management platform. This repository currently contains the **verified foundation** for the roadmap in `project-overview.md`: a typed Express API, MySQL/MariaDB persistence with Prisma migrations, and a React + Vite application shell with shared accessible UI primitives. Authentication, workspaces, projects, tasks, and realtime features are intentionally not implemented yet.

**New here?** Follow the step-by-step [Getting Started guide](docs/GETTING_STARTED.md) for cloning, database setup, environment files, migrations, running the apps, and troubleshooting.

## Verified stack

| Layer | Choice | Installed version |
| --- | --- | --- |
| Runtime | Node.js | 24.13.0 (`>=24` required) |
| Package manager | pnpm via Corepack | 12.23.0 (do not use npm) |
| Language | TypeScript (strict, `exactOptionalPropertyTypes`) | 6.0.3 |
| API | Express | 5.3.0 |
| API validation | Zod (config and request boundaries) | 4.6.7 |
| API logging | Pino + pino-http with redaction | 10.4.0 / 11.0.0 |
| Security | Helmet, CORS allowlist, express-rate-limit | 8.3.0 / 2.8.6 / 8.7.5 |
| Database | MariaDB (XAMPP) on `127.0.0.1:3309` | 10.4.32 |
| ORM | Prisma 7 + `@prisma/adapter-mariadb` | 7.10.1 |
| Frontend | React + Vite | 19.3.1 / 8.3.8 |
| Routing / server state | React Router / TanStack Query | 8.5.3 / 5.108.4 |
| Styling | Tailwind CSS 4 with custom tokens | 4.3.5 |
| Accessible primitives | Radix UI Dialog and Dropdown Menu | 1.3.1 / 2.2.1 |
| Unit / API tests | Vitest + Supertest + Testing Library | 5.1.2 / 7.3.2 / 16.3.3 |
| E2E tests | Playwright (browser binaries not installed yet) | 1.65.1 |

## Repository layout

```text
apps/api/
  prisma/                     # schema, initial migration, idempotent seed
  prisma.config.ts            # development migration config
  prisma.test.config.ts       # isolated TEST_DATABASE_URL migration config
  src/
    config/env.ts             # Zod-validated startup configuration
    lib/                      # Prisma singleton, logger, request IDs
    middleware/               # Zod validation, 404, centralized errors
    routes/                   # /api/v1 health and readiness routes
    generated/prisma/         # generated client (gitignored)
  tests/                      # Vitest + Supertest, incl. real MariaDB integration
apps/web/
  src/app/                    # router, providers, route table
  src/components/             # layout and accessible UI primitives
  src/features/foundation/    # API status card, setup dialog
  src/pages/                  # landing, dashboard, not-found, route error
  src/lib/                    # typed API client, query client, cn helper
  tests/                      # component, API client, and route tests
  e2e/                        # Playwright smoke tests
docs/architecture/baseline.md # factual audit and verification report
```

## First-time setup

### 1. Install dependencies

```powershell
corepack enable
pnpm install
```

`pnpm install` also runs `prisma generate` through the API `postinstall` script. Approved build scripts are declared in `pnpm-workspace.yaml`.

### 2. Prepare the local database

This machine has a XAMPP MariaDB 10.4 instance listening on port **3309**. TaskForge uses three dedicated databases so migrations and tests never touch each other:

- `taskforge` — development
- `taskforge_test` — isolated Vitest integration tests
- `taskforge_shadow` — Prisma shadow database for `prisma migrate dev`

With an admin account in phpMyAdmin (or the MariaDB CLI), run:

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

> Note: this machine's XAMPP `mysql.db` privilege table was corrupt and was repaired during setup. If you re-create users, check it first with `CHECK TABLE mysql.db;` in phpMyAdmin.

### 3. Configure environment files

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/api/.env.test.example apps/api/.env.test
```

Replace `change-me` in both files with the password chosen above. These files are gitignored; never commit them or paste secrets into chat.

### 4. Apply migrations and seed

```powershell
pnpm db:deploy        # apply the tracked migration to taskforge
pnpm db:seed          # idempotent schema.version=1 seed
pnpm db:status        # confirm development schema is up to date

pnpm db:migrate:test  # apply the same migration to taskforge_test
pnpm db:status:test   # confirm test schema is up to date
```

`pnpm db:migrate` (`prisma migrate dev`) is for creating *new* migrations and uses `SHADOW_DATABASE_URL`. Never edit an already-applied migration.

### 5. Run the apps

```powershell
pnpm dev              # API on http://localhost:4000, web on http://localhost:5173
```

The web dev server proxies `/api` to the API. Open `http://localhost:5173` for the landing page and `http://localhost:5173/app` for the application shell.

## Common scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run API and web concurrently |
| `pnpm build` | Type-check and build both apps |
| `pnpm typecheck` | Strict TypeScript checks for both apps |
| `pnpm lint` | ESLint across the workspace |
| `pnpm format` / `pnpm format:check` | Prettier write / check |
| `pnpm test` | Vitest suites (API + web, including real MariaDB test when configured) |
| `pnpm test:e2e` | Playwright smoke tests (requires browser binaries) |
| `pnpm db:generate` | Regenerate the Prisma client |
| `pnpm db:migrate` / `db:deploy` / `db:status` | Create / apply / inspect development migrations |
| `pnpm db:migrate:test` / `db:status:test` | Apply / inspect migrations on the isolated test database |
| `pnpm db:seed` | Re-run the idempotent seed |
| `pnpm db:studio` | Prisma Studio for the development database |

## API endpoints (current foundation)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1` | API metadata and links |
| `GET` | `/api/v1/health` | Liveness with version, uptime, and timestamp |
| `GET` | `/api/v1/health/ready` | Readiness; verifies a real database query |

Success responses use `{ "data": ... }`. Errors use `{ "error": { code, message, requestId, details? } }` and never leak stack traces, SQL, or secrets. Every response includes `X-Request-Id`.

## Architecture rules in practice

- Backend is authoritative: Zod validates `params`, `query`, `body`, and startup environment; parsed values are mapped explicitly into Prisma calls.
- A single Prisma Client is reused across dev reloads and disconnected on shutdown.
- Collection endpoints will be paginated when domain features add them; no unbounded `findMany()` is exposed.
- CORS is an explicit origin allowlist; Helmet and a global rate limit are enabled. Cookie-based refresh endpoints will need CSRF protection when Feature 5 is added.
- The API and committed MariaDB data are the source of truth. Socket.IO, background jobs, and S3 are feature-driven additions, not foundation dependencies.
- Frontend server state lives in TanStack Query; React state is for local UI only. Access tokens are kept in memory, refresh tokens stay in HttpOnly cookies.

## Verification status (2026-11-26)

Verified in this environment:

- `pnpm install`, `prisma generate`, `prisma validate` (both configs)
- `pnpm db:deploy`, `pnpm db:seed`, `pnpm db:status` on `taskforge`
- `pnpm db:migrate:test`, `pnpm db:status:test` on `taskforge_test`
- `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`
- `pnpm test`: API 17/17 passing (including real MariaDB integration), web 10/10 passing
- Built API health and readiness endpoints queried successfully against MariaDB
- Built web app served successfully via Vite preview (HTTP 200, title `TaskForge`)

Not yet verified:

- `pnpm test:e2e` — Playwright browser binaries are not installed. Install them with `pnpm --filter @taskforge/web exec playwright install chromium` if you want the browser checks run.
- Manual responsive/device review in a browser — not performed by the agent.

The OpenCode workflow configuration (`opencode.json`, `.opencode/`, `AGENTS.md`, `project-overview.md`, `memory.md`) is unchanged. Feature work should follow `/architect` → approval → `/develop` in dependency order, starting with Feature 5 (authentication).
