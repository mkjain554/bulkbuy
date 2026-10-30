# BulkBuy

BulkBuy is a TypeScript group-buying marketplace monorepo with a React web
client, a native iOS/Android app, an Express API, and PostgreSQL persistence.
Buyers can join group offers for free; the application does not collect or
simulate payments.

## What works

- Buyer and seller registration, login, logout, current-user lookup, Argon2id
  password hashing, role checks, rate-limited auth, HttpOnly sessions, and
  double-submit CSRF validation.
- Seller-owned product create, edit, archive, category listing, and paginated
  public product discovery.
- Seller pool creation and publishing, INR decimal prices, schedules, minimum
  targets, optional capacity, cancellation/confirmation actions, and live
  participant counts.
- Configurable TEXT, DROPDOWN, and DATE form fields, validation, preview,
  add/remove/reorder, and editing before the first buyer joins. Definitions
  lock once participation starts.
- Buyer pool joining and response review, duplicate prevention, transactional
  response persistence, row-lock-based capacity/target handling, and in-app
  notifications.
- Seller participant/response views, seller dashboard statistics, a basic
  administrator user list/suspension UI, and audit records for account status
  changes.
- Web marketplace and a native Expo mobile app using the same API.

## Requirements

- Node.js 22 or newer and npm 10 or newer
- Docker Compose for the documented PostgreSQL container
- Expo Go or an iOS/Android simulator for mobile development

## Local setup

```sh
npm install
cp .env.example .env
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Web: <http://localhost:5173>  
API health: <http://localhost:4000/api/health>  
OpenAPI JSON: <http://localhost:4000/api/openapi.json>

The local seed creates demo accounts:

| Role   | Email                      |
| ------ | -------------------------- |
| Admin  | `admin@bulkbuy.local`      |
| Seller | `seller.one@bulkbuy.local` |
| Seller | `seller.two@bulkbuy.local` |
| Buyer  | `buyer.one@bulkbuy.local`  |

The seed password defaults to `BulkBuy-Local-2026`; set
`SEED_DEMO_PASSWORD` to override it. These credentials are for local
development only. Do not reuse them outside a local database.

## Workspace commands

| Command                             | Purpose                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`                       | Run web and API concurrently                                                    |
| `npm run dev:web`                   | Run the web app                                                                 |
| `npm run dev:api`                   | Run the API                                                                     |
| `npm run dev:mobile`                | Start Expo for iOS/Android                                                      |
| `npm run build`                     | Build web, API, and iOS/Android JS bundles                                      |
| `npm run typecheck`                 | Type-check all workspaces                                                       |
| `npm run lint`                      | Lint the repository                                                             |
| `npm test`                          | Run unit tests (database integration tests skip by default)                     |
| `npm run test:integration`          | Run API integration tests; set `TEST_DATABASE_URL` to an isolated test database |
| `npm run db:generate`               | Generate Prisma Client                                                          |
| `npm run db:migrate`                | Apply development migrations                                                    |
| `npm run db:deploy`                 | Apply committed migrations in deployment                                        |
| `npm run db:seed`                   | Seed local demo data                                                            |
| `npm run db:up` / `npm run db:down` | Start/stop the Compose database                                                 |
| `npm run format:check`              | Check Prettier formatting                                                       |

The integration test command uses real PostgreSQL and creates test records.
Point `TEST_DATABASE_URL` only at an isolated test database, never production.
For example:

```sh
TEST_DATABASE_URL='postgresql://bulkbuy:bulkbuy_dev@localhost:5432/bulkbuy_test?schema=public' \
  DATABASE_URL='postgresql://bulkbuy:bulkbuy_dev@localhost:5432/bulkbuy_test?schema=public' \
  npx prisma migrate deploy
TEST_DATABASE_URL='postgresql://bulkbuy:bulkbuy_dev@localhost:5432/bulkbuy_test?schema=public' \
  npm run test:integration
```

## Mobile development

Start with `npm run dev:mobile`. For a physical device, set
`EXPO_PUBLIC_API_URL` to an API address reachable from the phone, such as your
computer's LAN IP (not `localhost`). Vite and the API bind to all interfaces
for local-network testing; configure firewall and CORS origins appropriately.
Client-prefixed variables such as `VITE_*` and `EXPO_PUBLIC_*` are public and
must never contain secrets.

## Configuration and security

Copy `.env.example` to `.env` in the repository root. The API reads that file
from the repository root even when started through an npm workspace command,
and validates required settings at startup.
The development secrets and database passwords are examples, not production
values. Production requires HTTPS, a strong unique `SESSION_SECRET`, a
restricted `WEB_ORIGIN`, and an appropriate cookie domain. Cross-site
production cookies are `Secure`/`SameSite=None` and are protected by CSRF
tokens.

## Known scope limits

- Product images currently use validated image URLs; upload storage adapters
  and object-storage integration are not implemented.
- Password reset/email delivery, seller reports/moderation, and a production
  background scheduler are not implemented. Pool expiry is reconciled when a
  pool is read or joined.
- Admin tools currently cover user listing and account suspension/reactivation;
  broader product/pool moderation and category management remain to be built.
- The mobile client supports browsing, account access, joining, and buyer
  participation review. Seller product and form management is available in the
  web workspace.
- Deployment provider-specific manifests, Playwright automation, and full
  production hardening remain future work.

## Structure

```text
apps/
  api/       Express API, auth, business rules, and integration tests
  mobile/    Expo React Native app for iOS and Android
  web/       React + Vite marketplace and seller/admin workspace
packages/
  shared/    Zod validation shared across clients and API
prisma/
  schema.prisma, migrations, and local seed
```
