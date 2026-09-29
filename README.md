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
host** — there is no separate frontend deploy and no CORS origin to configure. You
only need somewhere to run Node and a MySQL database.

| Piece | Service | Plan |
|---|---|---|
| API + frontend (single service) | [Render](https://dashboard.render.com) | Free web service, 512 MB |
| MySQL database | [Aiven](https://console.aiven.io/signup?service=mysql) | Free MySQL, 1 GB, no credit card |

### 1. Database — Aiven

Sign in with GitHub, create a **MySQL** service on the free plan, then copy the
connection values from its **Connection** page: host, port, user, password, and
database name. Free Aiven allows one service of each type per account, so delete
any other MySQL/PostgreSQL service you created before if provisioning is refused.

### 2. Deploy the app — Render

Go to [dashboard.render.com/yaml/new](https://dashboard.render.com/yaml/new) and
paste `https://github.com/sathyakrishnan2003/marketplaceos`. Render reads the
`render.yaml` in this repo, builds the frontend, and serves it from the same origin
as the API. Fill in the values marked "sync: false" (`DB_HOST`, `DB_PORT`,
`DB_USER`, `DB_PASSWORD`, `DB_NAME`) with the Aiven values. `JWT_SECRET` is
generated for you. Leave `CORS_ORIGIN` alone — the SPA is same-origin.

`PORT` is assigned by Render; do not override it.

On the free plan the service **spins down after 15 minutes of inactivity** and the
first request after that takes about a minute to wake it. That is expected and
does not mean the deploy is broken.

### 3. Initialize the database

Render's free services have no shell, so run the migration and seed **from your own
machine** against the Aiven host. Put the Aiven values in `backend/.env` (including
`DB_SSL=true`), then:

```bash
cd backend
npm run db:migrate
npm run db:seed
```

`db:setup` drops the database and only works against a local MySQL.

The app is now live at `https://<service>.onrender.com` — API and UI on one URL.

### Known limitation on the free plan

Uploaded product images are written to the container's local disk, which Render
discards whenever the instance restarts or spins down. Seeded demo products keep
their images. Durable uploads need object storage (S3/R2), which is a separate
configuration step.

### Other hosts

`railway.toml`, `Procfile`, and `Dockerfile` live at the **repo root** and all build
the frontend and start the API together, so any Node host works. For Railway, add
its MySQL plugin, set `JWT_SECRET`, then run `npm run db:migrate && npm run
db:seed` in the service shell.

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