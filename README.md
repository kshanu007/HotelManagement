# Annapurna · Hotel & Mess Management

A TypeScript MERN workspace for independent Indian hotels and monthly mess providers. Two roles: platform administrator and hotel owner. See [PROGRESS.md](PROGRESS.md) for verified behavior and remaining acceptance gaps.

## Local setup

Use Node 24 LTS and npm 11. The original machine had Node 20.16; validation may use ignored project-local tooling under `.local`.

```powershell
npm install
Copy-Item .env.example .env
# Edit .env: generate a random JWT_SECRET and choose strong bootstrap passwords.
docker compose up -d --wait
npm run seed
npm run dev
```

Web: http://localhost:5173 · API: http://localhost:5000 · health: `/health` · database readiness: `/ready`.

`npm run seed` creates an administrator from `BOOTSTRAP_EMAIL`, `BOOTSTRAP_PASSWORD`, `BOOTSTRAP_NAME`. Passwords must contain at least 12 characters, uppercase, lowercase, and a digit. It never resets existing credentials. To create an optional demo hotel, supply `DEMO_OWNER_EMAIL` and `DEMO_OWNER_PASSWORD` before running seed. No public administrator signup or fixed production password exists. Demo creation assigns a 30-day platform plan; add customers and meal plans through the owner UI.

If Docker is unavailable, point `MONGODB_URI` to a MongoDB replica set, including Atlas. Transactions require a replica set; standalone MongoDB is unsupported. Compose binds the unauthenticated development database to localhost only. Never expose it publicly.

## Commands

```text
npm run dev                 frontend + backend
npm run typecheck           both applications
npm run lint                shared ESLint configuration
npm test                    unit and React component tests
npm run test:integration     isolated MongoDB replica-set tests
npx playwright install chromium
npm run test:e2e             isolated API/database + real browser
npm run build               bundled API and Vite web build
npm run seed                administrator + optional demo owner
```

Integration and browser tests download a MongoDB binary on their first run. Browser tests reserve ports 5000/5173 and refuse to reuse existing servers. Test accounts are temporary and defined only in the isolated test server.

## Layout

```text
apps/api/src/      config, core/database, core/tenancy, middleware,
                   modules/auth, modules/operations, modules/reports,
                   shared/helpers, scripts, tests
apps/web/src/      app/layouts, app/providers, components/ui,
                   components/forms, components/data-display,
                   features, config, services, stores, styles, utils
packages/         shared-constants, shared-types, shared-validation
infrastructure/   docker
docs/             architecture, database, api, features, testing, deployment
scripts/          isolated browser-test server
tests/e2e/        browser acceptance checks
```

Each resource has shared validation and UI metadata; services centralize tenancy, atomic finance, and reporting. Models use strict schemas. Pages call typed services through TanStack Query and a single Axios client. Zustand holds only session presentation and preferences. See [architecture](docs/architecture/README.md), [API](docs/api/README.md), [financial rules](docs/features/finance.md), and [deployment](docs/deployment/README.md).

Hotel owners use one [Mess management workspace](docs/features/mess-workspace.md) for customers, attendance/leave, billing and meal plans. Customer profiles provide plan renewal, collection and leave actions with customer details prefilled.

Password reset currently uses administrator delivery: `npm run reset-link -w @annapurna/api -- owner@example.test` prints a one-use 30-minute link. Treat that link as a credential and deliver privately; SMTP delivery is not configured.

No production deployment is performed automatically.

Local validation passed: 13 unit/component tests, 25 MongoDB integration tests, 3 browser workflows, lint, type checking, and both production builds. See [PROGRESS.md](PROGRESS.md) for coverage and remaining operational acceptance work. Reset delivery is administrator-assisted, purchase quantities use whole units, and Docker/cloud execution remains unverified on this host.
