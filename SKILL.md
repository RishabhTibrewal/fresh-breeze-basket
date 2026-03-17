# Fresh Breeze Basket — Skills Reference

> **Purpose:** This document defines every skill area required to develop, maintain, and extend the Fresh Breeze Basket multi-tenant ERP/POS SaaS platform. Each skill includes its scope, key responsibilities, and the files/areas it governs.

---

## 1. 🏗️ Full-Stack Architecture & Multi-Tenancy

**What it covers:** Understanding the overall system design — how the frontend, backend, database, and infrastructure fit together — and how multi-tenancy is enforced end-to-end.

**Key Functions:**
- Design and maintain subdomain-based tenant isolation (`X-Tenant-Subdomain` header flow)
- Ensure every database query filters by `company_id` (RLS + backend enforcement)
- Manage `resolveTenant` middleware ordering and caching (10 min TTL)
- Understand the `Frontend (Vercel) → nginx → Express → Supabase` request pipeline
- Maintain Cloudflare Worker proxy support for regional fallback

**Key Files:**
- `backend/src/middleware/tenant.ts`
- `frontend/src/lib/apiClient.ts`
- `backend/src/index.ts`
- `ARCH_STATE.md`

---

## 2. ⚛️ React & TypeScript Frontend Development

**What it covers:** Building and maintaining the React 18 + TypeScript + Vite single-page application, including component architecture, routing, and state management.

**Key Functions:**
- Build React components using Radix UI primitives and Tailwind CSS
- Define and update routes in `App.tsx` using React Router v6
- Manage global state with React Context (`AuthContext`, etc.) and server-state with TanStack React Query
- Create and update page-level components in `frontend/src/pages/`
- Create reusable UI components in `frontend/src/components/`
- Handle module-level access gating using `modules.config.tsx` as the single source of truth
- Implement custom hooks (`useAuth`, `usePermissions`, `useCanAccess`, etc.)

**Key Files:**
- `frontend/src/App.tsx`
- `frontend/src/config/modules.config.tsx`
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/hooks/`
- `frontend/src/pages/`
- `frontend/src/components/`

---

## 3. 🔌 API Integration & Service Layer (Frontend)

**What it covers:** Writing and maintaining the frontend API client and per-module API service files that abstract all HTTP calls to the backend.

**Key Functions:**
- Configure Axios instance with automatic `X-Tenant-Subdomain` header injection and JWT token refresh
- Write typed API service functions per module (`products.ts`, `orders.ts`, `parties.ts`, etc.)
- Handle token expiration, exponential backoff for rate-limited refresh, and localStorage token caching
- Integrate TanStack React Query for caching, refetching, and invalidation strategies

**Key Files:**
- `frontend/src/lib/apiClient.ts`
- `frontend/src/api/` (26+ files)
- `frontend/src/config.ts`

---

## 4. 🚀 Node.js / Express Backend Development

**What it covers:** Building and maintaining the Express + TypeScript REST API, including controllers, routes, middleware, and business logic services.

**Key Functions:**
- Write route definitions and mount them with correct middleware ordering in `index.ts`
- Write controller functions that read `req.companyId` (set by tenant middleware) for all DB queries
- Implement business logic in the `services/` layer (e.g., `OrderService`, `InventoryService`, `PricingService`)
- Use custom error classes (`ApiError`, `ValidationError`) with the global error middleware
- Handle async errors using `express-async-errors`
- Implement input validation (explicit checks for `product_id`, `quantity`, `unit_price`, `variant_id`)
- Write retry logic for race conditions (e.g., PO number generation with max 5 retries)

**Key Files:**
- `backend/src/index.ts`
- `backend/src/controllers/`
- `backend/src/routes/`
- `backend/src/services/`
- `backend/src/middleware/`
- `backend/src/utils/ApiError.ts`

---

## 5. 🗄️ Database Design & Supabase (PostgreSQL)

**What it covers:** Designing database schemas, writing SQL migrations, managing Row Level Security (RLS) policies, and working with Supabase-specific features.

**Key Functions:**
- Write SQL migration files (stored in `backend/src/db/migrations/`)
- Design normalized tables with proper foreign keys, indexes, and unique constraints
- Implement and maintain RLS policies for multi-tenant data isolation
- Use Supabase Admin client (`supabaseAdmin`) for tenant resolution (bypasses RLS on `companies` table)
- Use `.schema('procurement')` for procurement schema tables vs. default `public` schema
- Write Supabase RPCs (PostgreSQL functions) for atomic operations (e.g., `process_repack_order`)
- Use `.maybeSingle()` instead of `.single()` when a result may not exist

**Key Files:**
- `backend/src/db/migrations/` (109+ SQL files)
- `backend/src/config/supabase.ts`
- `backend/src/db/supabase.ts`

---

## 6. 🔐 Authentication & Authorization (JWT + RBAC)

**What it covers:** Managing authentication via Supabase Auth, JWT verification in the backend, and role-based access control (RBAC) for both frontend and backend.

**Key Functions:**
- Verify Supabase JWTs in Express middleware using JWKS (with Cloudflare Worker proxy support)
- Use `SUPABASE_ISSUER` for `iss` claim validation when a proxy URL is in use
- Implement and enforce role checks using `requireRole` middleware on routes
- Manage frontend permission hooks (`useCanAccess`, `useHasModuleAccess`, `usePermissions`)
- Enforce company-level module enablement checks in the frontend

**Key Files:**
- `backend/src/middleware/auth.ts`
- `backend/src/utils/supabaseJwt.ts`
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/hooks/usePermissions.ts`

---

## 7. 📦 Inventory Management Logic

**What it covers:** Implementing and maintaining the business rules around stock tracking, reservations, movements, repack orders, and warehouse inventory.

**Key Functions:**
- Apply the strict inventory update rule: `stock_count` is ONLY updated when creating a `stock_movements` entry
- During order creation (status=`pending`): ONLY update `reserved_stock`, NOT `stock_count`
- During order status changes: create `stock_movements` first, then update `stock_count`
- Implement `InventoryService.reserveStock()` with `allowNegative` flag for sales pre-orders
- Handle REPACK_OUT / REPACK_IN movement types for bulk-to-retail conversion
- Write and manage `packaging_recipes` and `repack_orders` logic

**Key Files:**
- `backend/src/services/core/InventoryService.ts`
- `backend/src/controllers/inventoryController.ts`
- `backend/src/db/migrations/` (repack/movement migrations)

---

## 8. 🛒 Order & Sales Management

**What it covers:** Implementing the full order lifecycle — creation, status workflow, invoicing, payment recording, and sales executive assignment.

**Key Functions:**
- Manage order status workflow: `pending → confirmed → shipped → delivered`
- Record payments with `transactionId`, `chequeNo`, `paymentDate` fields
- Auto-assign `sales_executive_id` when current user has the sales role
- Handle the `preserveOrderPaymentStatus` flag to prevent status overwrites during creation
- Implement return order processing and invoice generation

**Key Files:**
- `backend/src/services/core/OrderService.ts`
- `backend/src/controllers/orderController.ts`
- `backend/src/controllers/paymentController.ts`
- `frontend/src/pages/sales/`

---

## 9. 🏪 Procurement Module

**What it covers:** Purchase orders, goods receipts, purchase invoices, and supplier payments — including variant-level tracking.

**Key Functions:**
- Always validate that `variant_id` belongs to the specified `product_id` before creating PO items
- Use variant-level pricing from `product_prices` (not product-level pricing)
- Fetch variant HSN codes and units from `product_variants`, not `products`
- Implement retry logic for PO number generation (race conditions)
- Use `.schema('procurement')` for all procurement table queries

**Key Files:**
- `backend/src/controllers/purchaseOrders.ts`
- `backend/src/controllers/goodsReceiptsController.ts`
- `backend/src/routes/purchaseOrders.ts`
- `frontend/src/pages/procurement/`

---

## 10. 🧩 Product Catalog & Variants

**What it covers:** Managing the product model including variants, pricing, images, categories, brands, bundles, modifier groups, and collections.

**Key Functions:**
- Create and update products with multiple variants (size, color, packing_type, type)
- Manage variant-level pricing in the `product_prices` table
- Handle bundle products: `is_bundle` flag + `bundle_components` linking parent to component variants
- Manage modifier groups and modifiers via `modifier_groups`, `modifiers`, `variant_modifier_groups` tables
- Manage collections via `collections` and `variant_collections` tables
- Upload product images to Cloudflare R2 with company-scoped paths

**Key Files:**
- `backend/src/controllers/productController.ts`
- `backend/src/services/ProductService.ts`
- `frontend/src/pages/inventory/ProductForm.tsx`
- `frontend/src/pages/inventory/VariantForm.tsx`

---

## 11. 🧾 Payment Processing & Party Ledger

**What it covers:** Recording and tracking payments (sales and procurement), managing the unified business partner (party) model, and the party ledger.

**Key Functions:**
- Use the unified `contact_parties` table linking `customers` and `suppliers` via `party_id`
- Maintain party ledger entries: `sale`, `payment_in`, `purchase`, `payment_out`
- Calculate `totalReceivable`, `totalPayable`, `netPosition` from ledger aggregates
- Enable role conversion: customer → supplier and supplier → customer (idempotent)
- Enforce uniqueness: at most one customer and one supplier per party per company

**Key Files:**
- `backend/src/controllers/partyController.ts`
- `backend/src/routes/parties.ts`
- `frontend/src/api/parties.ts`
- `frontend/src/pages/admin/PartyLedger.tsx`

---

## 12. 🗂️ File Storage (Cloudflare R2)

**What it covers:** Handling all file uploads and retrievals using Cloudflare R2 (S3-compatible), NOT Supabase Storage.

**Key Functions:**
- Use the `r2Client` utility for all file operations (never use Supabase Storage)
- Store files with company-scoped paths: `{companyId}/{timestamp}_{filename}`
- Construct public URLs: `https://{bucketName}.{accountId}.r2.cloudflarestorage.com/{fileName}`
- Read R2 config from environment variables (never hardcode bucket name or account ID)

**Key Files:**
- `backend/src/utils/r2Client.ts`
- `backend/.env` (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)

---

## 13. 🚢 DevOps & Deployment

**What it covers:** Building, deploying, and managing both the frontend (Vercel) and backend (DigitalOcean + PM2 + nginx).

**Key Functions:**
- Build the TypeScript backend: `cd backend && npm run build`
- Start/reload the backend with PM2: `pm2 restart fresh-breeze-api`
- Configure nginx as a reverse proxy preserving the `X-Tenant-Subdomain` header
- Deploy the frontend to Vercel (static SPA with `vercel.json` rewrite rules)
- Manage environment variables for both frontend (`VITE_*`) and backend
- Monitor logs: `pm2 logs fresh-breeze-api`

**Key Files:**
- `backend/tsconfig.json`
- `frontend/vercel.json`
- `docs/nginx-backend-config-updated.conf`
- `backend/package.json`

---

## 14. 🔒 Security Best Practices

**What it covers:** Ensuring the platform is secure — from API-level validation to database-level RLS and CORS configuration.

**Key Functions:**
- Enforce `company_id` filter on every database query (never query without it)
- Validate all user input explicitly (type, range, existence checks)
- Configure CORS to allow only `*.gofreshco.com` domains and include `X-Tenant-Subdomain` in allowed headers
- Enforce RLS policies in Supabase for all tenant-owned tables
- Use `supabaseAdmin` only for internal/privileged operations (tenant resolution)
- Never expose internal error details to the frontend

**Key Files:**
- `backend/src/index.ts` (CORS config)
- `backend/src/middleware/auth.ts`
- `backend/src/utils/supabaseJwt.ts`
- All SQL migration files with RLS policies

---

## 15. 🧪 Testing

**What it covers:** Writing and running automated tests for backend logic.

**Key Functions:**
- Write unit and integration tests using Jest (configured in `backend/jest.config.js`)
- Test controller logic, service functions, and middleware
- Mock Supabase client responses for isolated tests
- Test edge cases: race conditions, invalid inputs, missing tenants, token expiry

**Key Files:**
- `backend/jest.config.js`
- `backend/src/__tests__/`

---

## 16. 🧭 Module & Permission Configuration (Frontend)

**What it covers:** Configuring which modules exist, how they are named, what routes they contain, what icons they use, and how access is gated.

**Key Functions:**
- Add or modify modules in `modules.config.tsx` (the SINGLE SOURCE OF TRUTH)
- Define module routes, sidebar items, and permission keys
- Use `useHasModuleAccess()` and `useCanAccess()` for gating UI visibility
- Never hardcode module data in individual components

**Key Files:**
- `frontend/src/config/modules.config.tsx`
- `frontend/src/config/sidebarRoutes.ts`
- `frontend/src/hooks/usePermissions.ts`

---

## Quick Reference: Skill ↔ Module Mapping

| Module                | Primary Skills                        |
|-----------------------|---------------------------------------|
| Inventory             | 7, 10, 5                              |
| Sales & Orders        | 8, 11, 6                              |
| Procurement           | 9, 5, 7                               |
| POS                   | 2, 4, 8                               |
| Product Catalog       | 10, 5, 12                             |
| Business Partners     | 11, 5, 6                              |
| Admin / RBAC          | 6, 16, 2                              |
| E-commerce            | 2, 3, 8                               |
| Reports & Analytics   | 2, 4, 5                               |
| Infrastructure        | 1, 13, 14                             |
