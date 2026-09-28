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

`railway.toml`, `Procfile`, and `Dockerfile` live at the **repo root**. Do **not** set a root directory in Railway — the config already handles the `backend/` prefix.

1. Railway dashboard → **New Project** → **Deploy from GitHub** → select this repo.
2. **+ New** → **Database** → **MySQL** (Railway provisions it automatically).
3. Click your app service → **Variables** and add:

   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | 32+ char random string |
   | `CORS_ORIGIN` | `https://<your-app>.up.railway.app` |
   | `PORT` | `5000` |
   | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | reference the MySQL service |

   Generate a secret with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

4. Deploy. The health check hits `/health` and returns `{"status":"ok"}`.
5. Open **Shell** on the service and initialize the database. Use `migrate` + `seed`, **not** `db:setup` — managed MySQL denies `DROP DATABASE`:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
6. Verify: `https://<your-app>.up.railway.app/health`

**Frontend** (Vercel/Netlify): root directory `frontend`, build command `npm run build`, output `dist`,
and set `VITE_API_URL=https://<your-backend>.up.railway.app`.

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Build failed`, no output | Root directory set to `backend` | Clear it (set to `/`) and redeploy |
| `Server not responding` | Missing `JWT_SECRET` | `server.js` refuses to boot without a 32+ char secret |
| `Seed failed: command denied` | Ran `db:setup` | Use `db:migrate` + `db:seed` instead |
| 403 / CORS errors in browser | `CORS_ORIGIN` mismatch | Set it to the exact frontend origin |

---

## Acceptance criteria mapping

- **Multi-vendor with storefronts:** `GET /api/vendors` + `GET /api/vendors/:id` → public storefront page at `/vendors/:id`; vendor approval workflow (`/admin/vendors`).
- **Escrow flow (sandbox):** transactional checkout writes `escrow_transactions` as `held`; customer confirms delivery → `released`; admin can release/refund; order audit trail.
- **Review / rating system:** `GET /api/reviews/product/:id`, `POST /api/reviews` (gated on delivered purchase); aggregate rating computed server-side.
- **Vendor sales analytics:** `/api/analytics/vendor` + time-series + top products.
- **Super-admin revenue dashboard:** `/api/analytics/summary` (GMV, orders, escrow, vendors, top products, categories, vendor performance).
- **Mobile responsive:** CSS media queries across customer shop and workspace shells.