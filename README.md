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
npm run db:setup      # creates DB, applies schema, seeds demo data
npm run dev           # http://localhost:5000
```

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
cd backend && npm test   # 84 tests across auth, validation, rate-limit, order state, schema
```

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

## Deployment (Railway)

Deploy the backend with one click from the Railway dashboard:

1. Create a new Railway project → "Deploy from GitHub" → select this repo.
2. Add a MySQL plugin (Railway MySQL) → set `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` from the plugin.
3. Environment variables: `JWT_SECRET` (>=32 chars), `CORS_ORIGIN`, `PORT`.
4. Run `npm run db:setup` once in the deployed environment (or attach a one-off shell and run it).
5. Deploy the frontend with Vercel, Netlify, or Railway static hosting.

`railway.toml` and `backend/Dockerfile` are included for reference.

---

## Acceptance criteria mapping

- **Multi-vendor with storefronts:** `GET /api/vendors` + `GET /api/vendors/:id` → public storefront page at `/vendors/:id`; vendor approval workflow (`/admin/vendors`).
- **Escrow flow (sandbox):** transactional checkout writes `escrow_transactions` as `held`; customer confirms delivery → `released`; admin can release/refund; order audit trail.
- **Review / rating system:** `GET /api/reviews/product/:id`, `POST /api/reviews` (gated on delivered purchase); aggregate rating computed server-side.
- **Vendor sales analytics:** `/api/analytics/vendor` + time-series + top products.
- **Super-admin revenue dashboard:** `/api/analytics/summary` (GMV, orders, escrow, vendors, top products, categories, vendor performance).
- **Mobile responsive:** CSS media queries across customer shop and workspace shells.