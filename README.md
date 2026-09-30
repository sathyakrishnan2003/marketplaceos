# MarketplaceOS

A multi-vendor marketplace with escrow-protected payments, vendor storefronts, reviews, analytics, and a super-admin console.

**Stack:** React 19 + Vite · Node.js + Express · MySQL · JWT auth

---

## Status

| Criterion | Status |
|---|---|
| Multi-vendor with storefronts | Done |
| Escrow flow (sandbox) | Done |
| Review / rating system | Done |
| Vendor sales analytics | Done |
| Super-admin revenue dashboard | Done |
| Mobile responsive | Done |
| Tests (84 passing) | Done |

---

## Local setup

### Prerequisites
- Node.js 20+ (`node --version`)
- MySQL 8.0 (XAMPP or standalone install)
- npm

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # edit DB creds + JWT_SECRET
npm run db:setup       # local only: drops + rebuilds DB, applies schema, seeds demo data
npm run dev            # http://localhost:5000
```

> `db:setup` issues `DROP DATABASE`, so it only works against a local MySQL you own.
> For managed/production databases use `db:migrate` then `db:seed` (see Deployment below).

Demo accounts (seeded by `db:setup`):
- `admin@marketplaceos.test` / `admin123`
- `kora@marketplaceos.test` / `vendor123`
- `customer@marketplaceos.test` / `customer123`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173 (proxies /api to backend)
```

### 3. Run tests

```bash
cd backend && npm test   # 85 tests across auth, validation, rate-limit, order state, schema
```

There is also an end-to-end smoke test that drives the real HTTP API — auth and
RBAC, public storefronts, the transactional checkout, the escrow hold and
release, and review eligibility before and after delivery. It needs a running
server and a migrated database:

```bash
cd backend && npm start     # terminal 1
cd backend && npm run smoke # terminal 2 -> 25/25 checks passed
```

Point it at a deployment with `SMOKE_BASE_URL=https://your-host npm run smoke`.

---

## Project structure

```
backend/
  server.js                 # Express app entry
  config/db.js              # MySQL pool
  middleware/               # auth (JWT), validation, rate-limit, upload, error handler
  controllers/              # auth, products, cart, orders, reviews, analytics, vendors, users, categories
  routes/                   # /api/* route definitions
  scripts/                  # setup.js (seed), migrate.js
  schema.sql                # canonical schema
  migrations/               # additive migrations
  test/                     # node --test suite
frontend/
  src/
    pages/                  # Login, Register, Products, ProductDetails, Cart, Orders,
                            # Dashboard, Vendors, VendorProducts, AddProduct,
                            # Users, Escrow, Categories, CustomerDashboard
    services/api.js         # typed fetch wrapper with auto-refresh
    utils/auth.js           # session persistence
    App.jsx                 # react-router routes + role-aware shells
  vite.config.js           # /api proxy to localhost:5000
```

---

## Deployment (free, no card)

The API also serves the built SPA, so the whole application is **one service on one
host** — one URL for both UI and API, no CORS origin to configure, no separate
frontend deploy. You only need somewhere to run Node and a MySQL database.

| Piece | Service | Plan |
|---|---|---|
| API + frontend (one service) | [Koyeb](https://koyeb.com) | One free web service, 512 MB, no card |
| MySQL database | [Aiven](https://console.aiven.io/signup?service=mysql) | Free MySQL, 1 GB, no credit card |

GitHub Pages is also published automatically
(https://sathyakrishnan2003.github.io/marketplaceos) as a static mirror of the UI.
Because it has no backend of its own, point it at the deployed API by adding a
repository variable named `VITE_API_URL` (value must end in `/api`) under
**Settings → Secrets and variables → Actions**, then re-running the workflow. The
Koyeb URL needs no such setting because it serves the UI and the API together.

### 1. Database — Aiven

Sign in with GitHub, create a **MySQL** service on the free plan, then copy the
connection values from its **Connection** page: host, port, user, password, and
database name. Free Aiven allows one service of each type per account, so delete
any other MySQL/PostgreSQL service first if provisioning is refused.

### 2. Deploy — Koyeb

Click the button below, or go to https://app.koyeb.com and use **Create Web
Service → GitHub → Public GitHub repository**:

[![Deploy to Koyeb](https://www.koyeb.com/static/images/deploy/button.svg)](https://app.koyeb.com/deploy?type=git&builder=buildpack&repository=github.com/sathyakrishnan2003/marketplaceos&branch=main&name=marketplaceos)

Set these on the service configuration screen:

| Field | Value |
|---|---|
| Build command | `npm run install:all && npm run build` |
| Start command | `npm start` |
| Port | `8000` (Koyeb's default) |

Then add the environment variables:

| Key | Value |
|---|---|
| `JWT_SECRET` | 32+ char random string — `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `DB_HOST` | host from Aiven |
| `DB_PORT` | port from Aiven |
| `DB_USER` | user from Aiven |
| `DB_PASSWORD` | password from Aiven |
| `DB_NAME` | database from Aiven |
| `DB_SSL` | `true` |

`CORS_ORIGIN` can be left alone — the SPA is served from the same origin as the
API. Koyeb assigns `PORT` itself; do not set it.

### 3. The database initializes itself

There is nothing else to run. The service applies the schema on boot and seeds
demo data only when the database is empty, so cold starts never re-seed. Set
`AUTO_MIGRATE=false` to manage the schema yourself with `npm run db:migrate` and
`npm run db:seed`.

### Known limitation on the free plan

Uploaded product images are written to the container's local disk, which is
discarded when the instance restarts. Seeded demo products keep their images.
Durable uploads need object storage (S3/R2), a separate configuration step.

### Other hosts

`railway.toml`, `Procfile`, and `Dockerfile` live at the **repo root** and all build
the frontend and start the API together, so any Node or Docker host works.
`render.yaml` holds an equivalent Render blueprint.

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Free API takes ~1 min to respond | Render spin-down after 15 min idle | Expected; request a page to wake it |
| `Server not responding` | Missing `JWT_SECRET` | `server.js` refuses to boot without a 32+ char secret |
| `Seed failed: command denied` | Ran `db:setup` | Use `db:migrate` + `db:seed` instead |
| `ER_SSL` / handshake errors | Missing TLS to Aiven | Set `DB_SSL=true` |
| 403 / CORS errors in browser | `CORS_ORIGIN` mismatch | Set it to the exact frontend origin, then redeploy |
| Product images vanish later | Ephemeral container disk | Expected on the free plan — see above |

---

## Acceptance criteria mapping

- **Multi-vendor with storefronts:** `GET /api/vendors` + `GET /api/vendors/:id` → public storefront page at `/vendors/:id`; vendor approval workflow (`/admin/vendors`).
- **Escrow flow (sandbox):** transactional checkout writes `escrow_transactions` as `held`; customer confirms delivery → `released`; admin can release/refund; order audit trail.
- **Review / rating system:** `GET /api/reviews/product/:id`, `POST /api/reviews` (gated on delivered purchase); aggregate rating computed server-side.
- **Vendor sales analytics:** `/api/analytics/vendor` + time-series + top products.
- **Super-admin revenue dashboard:** `/api/analytics/summary` (GMV, orders, escrow, vendors, top products, categories, vendor performance).
- **Mobile responsive:** CSS media queries across customer shop and workspace shells.