# MarketplaceOS Technical Design Document

**Checkpoint:** 1 - Week 1  
**Status:** Proposed - approval required before further implementation  
**Client:** Seed-funded open multi-vendor marketplace, Bengaluru  
**Scope:** Customer shopping, vendor operations, escrow payments, reviews, analytics, and super-admin management.

## 1. System Architecture

MarketplaceOS uses a React single-page application (SPA) backed by a Node.js and Express REST API. The frontend provides role-aware experiences for customers, vendors, and administrators. It manages catalog discovery, search, category filtering, cart interactions, checkout, order tracking, vendor product management, analytics, and delivery confirmation.

The backend is the application boundary for authentication, authorization, product management, carts, orders, escrow state, reviews, and analytics. MySQL is the system of record. Uploaded product images are stored under the backend uploads directory and served as static assets; production deployment should replace this with object storage such as Amazon S3 or Azure Blob Storage. The frontend communicates with the backend through JSON REST endpoints and sends a bearer token for protected requests.

**Primary flow:** Customer authenticates -> browses active products -> adds products to a cart -> creates an order -> payment is recorded as held in escrow -> vendor fulfills the order -> customer confirms delivery -> escrow is released -> customer can review the purchased product.

**Roles:**
- **Customer:** browse products, manage cart, create orders, confirm delivery, and submit reviews for purchased products.
- **Vendor:** create and manage their own product listings, view vendor revenue/order/escrow analytics, and fulfill orders. Vendors cannot use customer checkout controls.
- **Super-admin:** monitor marketplace GMV, orders, escrow balances, active vendors, catalog activity, and platform operations.

## 2. Database Schema

The MySQL schema is relational and uses foreign keys to preserve ownership and transaction integrity.

- `users`: identity, email, bcrypt password hash, role (`customer`, `vendor`, `admin`), account status, and timestamps.
- `vendors`: one-to-one vendor profile linked to `users`, including business name, description, and approval status.
- `categories`: unique product categories with soft-delete support.
- `products`: vendor-owned listings linked to a category; includes name, description, price, stock, image, active/inactive status, timestamps, and soft delete.
- `cart_items`: customer cart rows linked to `users` and `products`, with a unique `(user_id, product_id)` constraint so repeated additions increment quantity rather than create duplicate rows.
- `orders`: customer order header containing total amount, lifecycle status, and creation timestamp.
- `order_items`: immutable purchase snapshot linking an order to product/vendor, quantity, and unit price. This preserves historical pricing and vendor attribution.
- `escrow_transactions`: one-to-one order payment record with amount, `held`, `released`, or `refunded` state and release timestamp.
- `reviews`: customer product reviews linked to the customer, purchased product, and order. A unique `(user_id, order_id, product_id)` constraint prevents duplicate reviews for the same purchase.

Order creation runs in a database transaction. It locks cart products, checks stock, calculates the total from database prices, creates the order and order items, creates the held escrow record, decrements inventory, clears the cart, and commits atomically. Failures roll back the full operation.

## 3. API Design

The API is versioned by the `/api` prefix and returns JSON. Protected routes require `Authorization: Bearer <JWT>`.

**Authentication**
- `POST /api/auth/register`: create a customer or vendor account according to permitted registration rules.
- `POST /api/auth/login`: validate credentials and return a JWT plus user profile.

**Catalog and categories**
- `GET /api/products`: list active marketplace products.
- `GET /api/products/mine`: list the authenticated vendor's products.
- `POST /api/products`: create a vendor listing; multipart upload supported for images.
- `GET /api/categories`: list available categories.

**Cart and orders**
- `GET /api/cart`: retrieve the authenticated customer's cart.
- `POST /api/cart`: add or increment a product quantity after stock validation.
- `DELETE /api/cart/:productId`: remove a cart item.
- `GET /api/orders`: retrieve the authenticated customer's orders and escrow state.
- `POST /api/orders`: atomically create an order and place its payment in escrow.
- `POST /api/orders/:id/confirm-delivery`: confirm delivery and release held escrow for the order owner.

**Reviews and analytics**
- `GET /api/reviews/product/:productId`: list product reviews.
- `POST /api/reviews`: create a review only for an eligible purchased product.
- `GET /api/analytics/summary`: admin marketplace metrics.
- `GET /api/analytics/vendor`: vendor-scoped revenue, products, orders, and escrow metrics.

## 4. Technology Stack Justification

- **React 19 + Vite:** fast SPA development, component-based role-aware UI, and efficient production builds.
- **Node.js + Express:** lightweight REST service with a large ecosystem and straightforward middleware for auth, uploads, and validation.
- **MySQL:** appropriate for transactional marketplace data, foreign keys, unique constraints, and row locking during checkout.
- **JWT:** stateless API authentication suitable for a separate frontend and backend deployment. Tokens should have short expiry and refresh-token support should be added for production.
- **bcryptjs:** adaptive password hashing without storing recoverable passwords.
- **Multer:** controlled multipart image upload handling for product listings.

This stack is appropriate for a 25-person seed-stage company because it is familiar, cost-effective, deployable on standard cloud services, and can scale by separating the frontend, API, database, and object storage as usage grows.

## 5. Security and Operational Considerations

Passwords must only be stored as bcrypt hashes. JWT secrets must be supplied through environment variables, rotated periodically, and never committed to source control. Authentication middleware must reject missing, expired, malformed, or invalid tokens. Authorization must be enforced at the controller level so a vendor can access only their own products and analytics, and a customer can confirm only their own order delivery.

All database access uses parameterized queries. Checkout derives prices and stock from the database rather than trusting client values. Input validation is required for email, password, price, stock, quantities, ratings, review length, and uploaded file type/size. Production CORS should allow only the deployed frontend origin. HTTPS, secure HTTP-only cookies or short-lived access tokens, rate limiting on authentication, structured audit logs, and generic error responses should be enabled before launch.

Escrow release must be idempotent and restricted to a held transaction. Order and payment state transitions should be audited. Uploads should be scanned, renamed server-side, stored outside the application process, and served with safe content types. Database backups, migration scripts, monitoring, and alerting are required for production operations.

## 6. Approval Gate and Next Steps

This document defines the proposed architecture and contracts. Approval is required before expanding implementation beyond the current prototype. After approval, the next work should be: add automated API tests, complete admin/vendor order management, connect a real payment provider or sandbox, move uploads to object storage, add production-grade validation/rate limiting, and run a security review against the approved API contract.
