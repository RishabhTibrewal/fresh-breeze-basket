---
name: unified-business-partner-ledger
overview: Implement a unified Business Partner model using contact_parties, backend APIs, and frontend UI for trading partners with a combined ledger.
todos:
  - id: phase1-db-migration
    content: Add contact_parties table, party_id links on customers/suppliers, backfill data, and create party_ledger view via new migration.
    status: completed
  - id: phase2-backend-api
    content: Implement partyController, routes, and integrate customer/supplier creation with contact_parties.
    status: completed
  - id: phase3-frontend-ui
    content: Add parties API client, badges and linking actions, trading partner details, and party ledger page with routing.
    status: completed
  - id: phase4-testing
    content: Prepare curl/backend test commands and frontend manual QA checklist for trading partner flows.
    status: completed
isProject: false
---

---

name: unified-business-partner-ledger

overview: Implement a unified Business Partner model using contact_parties, backend APIs, and frontend UI for trading partners with a combined ledger.

todos:

- id: phase1-db-migration
content: Design and migrate the database layer for contact_parties, link it to customers and suppliers, backfill existing data safely, and create the unified party_ledger view with correct RLS and multi-tenant behavior.
status: pending
- id: phase2-backend-api
content: Implement partyController and routes for managing parties and their ledgers, and integrate customer/supplier creation flows so they automatically create or reuse contact_parties.
status: pending
- id: phase3-frontend-ui
content: Add frontend API client for parties, expose trading-partner badges and linking actions in customer/supplier UIs, surface trading-partner details, and build a combined party ledger page and route.
status: pending
- id: phase4-testing
content: Define backend curl/test flows and frontend manual QA scenarios to validate trading-partner creation, linking, and unified ledger behavior across roles and tenants.
status: pending

isProject: false

---

### Phase 1: Database & Data Model (Supabase / Postgres)

- **Design `contact_parties` schema**  
  - Create `public.contact_parties` with:
    - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` (or `uuid_generate_v4()` to match the rest of the project).
    - `company_id uuid NOT NULL REFERENCES public.companies(id)`.
    - `name text NOT NULL`, `email text`, `phone text`, `is_customer boolean NOT NULL DEFAULT false`, `is_supplier boolean NOT NULL DEFAULT false`, `notes text`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.
  - Add indexes:
    - `idx_contact_parties_company` on `(company_id)`.
    - `idx_contact_parties_company_name` on `(company_id, name)`.
    - Optionally `idx_contact_parties_company_email` and `idx_contact_parties_company_phone` for lookups.
  - Enable RLS and add policies consistent with other tenant-scoped tables (company-based, role-aware).
- **Link `customers` and `suppliers`**  
  - Add nullable `party_id uuid REFERENCES public.contact_parties(id)` to `public.customers` and `public.suppliers`.
  - Add indexes like `idx_customers_company_party` on `(company_id, party_id)` and `idx_suppliers_company_party` on `(company_id, party_id)`.
- **Backfill existing data safely**  
  - Insert `contact_parties` from `customers`:
    - One row per (company_id, name, email, phone) combination; skip rows missing `company_id`.
  - Update `customers.party_id` by joining back on `(company_id, name, email, phone)` with `IS NOT DISTINCT FROM` so NULLs match safely.
  - Insert `contact_parties` from `suppliers` similarly, but avoid creating duplicates where a matching party already exists for the same (company_id, name, email, phone).
  - Update `suppliers.party_id` accordingly.
  - After both sides:
    - Set `is_customer = true` where any customer references the party.
    - Set `is_supplier = true` where any supplier references the party.
  - Accept that this is a “first pass” and that later manual/automated deduplication can merge multiple parties per company if needed.
- **Create `party_ledger` view**  
  - Implement a first version that covers:
    - **Receivables (sales)**:
      - `contact_parties` → `customers` (by `party_id`) → `orders` (by `orders.user_id = customers.user_id` and `orders.company_id = contact_parties.company_id`).
      - Emit `ledger_side = 'receivable'`, `doc_type = 'sale'`, plus `doc_id`, `amount = total_amount`, `doc_date = created_at`, `status`.
    - **Payables (purchases)**:
      - `contact_parties` → `suppliers` → `procurement.purchase_orders` → `procurement.purchase_invoices` (all scoped by `company_id`).
      - Emit `ledger_side = 'payable'`, `doc_type = 'purchase'`, with similar fields.
  - Union these queries with `UNION ALL` into `public.party_ledger`.
  - Keep it simple and rely on underlying tables’ RLS; later we can extend the view to include customer payments, supplier payments, and signed net amounts.

### Phase 2: Backend API & Domain Integration

- **Domain types**  
  - Define or reuse TS types:
    - `ContactParty`: fields from the new table.
    - `PartyLedgerEntry`: `party_id`, `company_id`, `name`, `ledger_side`, `doc_type`, `doc_id`, `amount`, `doc_date`, `status`.
- **Party controller `backend/src/controllers/partyController.ts`)**  
  - `GET /parties`:
    - Return paginated list of parties for current `company_id`.
    - Filters: `is_customer`, `is_supplier`, `q` (search name/email/phone via `ilike`).
  - `GET /parties/:id`:
    - Fetch a single party by `id` + current `company_id`; 404 if not found.
  - `POST /parties`:
    - Body: `name`, optional `email`, `phone`, `is_customer`, `is_supplier`, `notes`.
    - Use `req.companyId` as `company_id`.
  - `PATCH /parties/:id/link-customer`:
    - Body: `{ customer_id: string }`.
    - Check party & customer belong to same company.
    - Set `customers.party_id`, mark `contact_parties.is_customer = true`.
    - Optionally sync empty name/email/phone from customer.
  - `PATCH /parties/:id/link-supplier`:
    - Same pattern, using `{ supplier_id: string }` and `suppliers.party_id`, `is_supplier = true`.
  - `GET /parties/:id/ledger`:
    - Query `party_ledger` filtered by `party_id` and `company_id`.
    - Optionally compute aggregates `total_receivable`, `total_payable`, `net_position` to return alongside entries.
- **Routes & registration**  
  - `backend/src/routes/parties.ts`:
    - Wire the above controller methods to:
      - `GET /`
      - `GET /:id`
      - `POST /`
      - `PATCH /:id/link-customer`
      - `PATCH /:id/link-supplier`
      - `GET /:id/ledger`
    - Use same auth + tenant middleware stack as other authenticated APIs.
  - In `backend/src/index.ts`:
    - Mount under `/api/parties`.
- **Integrate into customer and supplier creation flows**  
  - In `backend/src/controllers/customerController.ts` (all code paths that create a customer, including `create_customer_with_user` flow):
    - After successful insert into `customers`:
      - Either:
        - Create a fresh `contact_parties` row `is_customer = true`), or
        - Try to reuse an existing party matched on (company_id, name/email/phone) to reduce duplicates.
      - Update `customers.party_id` with that id.
  - In the suppliers controller `backend/src/controllers/suppliers.ts`):
    - Do the same with `is_supplier = true` and `suppliers.party_id`.
  - Ensure all inserts/updates include `company_id` and respect existing RLS patterns.

### Phase 3: Frontend API, UX, and Navigation

- **Parties API client `frontend/src/api/parties.ts`)**  
  - Define `ContactParty` and `PartyLedgerEntry` interfaces aligned with backend.
  - Implement:
    - `getParties(params?)`
    - `getPartyById(id)`
    - `createParty(payload)`
    - `linkPartyToCustomer(partyId, customerId)`
    - `linkPartyToSupplier(partyId, supplierId)`
    - `getPartyLedger(partyId)`
- **Sales customers list `frontend/src/pages/sales/Customers.tsx`)**  
  - Extend customer fetch to include `party_id` (and party flags if backend exposes them directly).
  - Show a **“Linked to Supplier”** or **“Trading Partner”** badge whenever there is a `party_id` with `is_supplier = true`.
  - Add a **“Link to Supplier”** row action:
    - Opens a modal or slide-over.
    - Allows choosing an existing supplier (search by name) or initiating supplier creation.
    - Calls `linkPartyToSupplier` with the party for that customer.
- **Suppliers admin list `frontend/src/pages/admin/Suppliers.tsx`)**  
  - Show **“Linked to Customer”** or “Trading Partner” when `party_id` and `is_customer = true`.
  - Add a **“Link to Customer”** action mirroring the customer side.
  - Optionally show a quick link to “View Trading Ledger” if `party_id` exists.
- **Admin customer details trading-partner section `frontend/src/pages/admin/AdminCustomerDetails.tsx`)**  
  - If `customer.party_id` is present:
    - Fetch the party details.
    - Show:
      - Role badges (Customer, Supplier).
      - Contact info (name, email, phone).
      - A “View Trading Ledger” button linking to `/admin/party/:partyId/ledger`.
    - Optionally, fetch ledger summary and show:
      - `totalReceivable`, `totalPayable`, `netPosition` in a compact card.
- **Party ledger page `frontend/src/pages/admin/PartyLedger.tsx`)**  
  - Route: `/admin/party/:id/ledger`.
  - On mount:
    - Fetch party details and ledger entries.
  - UI:
    - Header: party name, badges, contact info.
    - Filters: by `ledger_side` (receivable/payable) and `doc_type` (sale/purchase).
    - Table: date, doc type, doc id (links to order/invoice pages if routing exists), status, amount, side.
    - Totals section: show total receivable, total payable, and net position with clear messaging (e.g., “Net: customer owes us X” vs “We owe them X”).
  - Navigation:
    - Provide easy back-links to linked customer/supplier records where possible.
- **Routing `frontend/src/App.tsx` and configs)**  
  - Register the `/admin/party/:id/ledger` route.
  - If needed, add an entry in your admin sidebar/module config so the page can be navigated from elsewhere (or rely solely on contextual links from customer/supplier screens).

### Phase 4: Testing, Verification, and Rollout

- **Database & migration validation**  
  - On staging:
    - Apply the migration and confirm table and view structure.
    - Check that `party_id` is populated for existing customers and suppliers.
    - Run sample queries against `party_ledger` for known parties with both sales and purchases.
- **Backend API verification (curl/Postman)**  
  - Test:
    - `GET /api/parties` with filters `is_customer`, `is_supplier`, `q`).
    - `POST /api/parties` to create a standalone trading partner.
    - Existing customer and supplier creation flows to ensure `contact_parties` and `party_id` are automatically populated.
    - `PATCH /api/parties/:id/link-customer` and `/link-supplier` flows.
    - `GET /api/parties/:id/ledger` returns expected entries and aggregates.
- **Frontend manual QA**  
  - Customers page:
    - Verify trading partner badges and “Link to Supplier” flow update backend correctly.
  - Suppliers page:
    - Verify trading partner badges and “Link to Customer” flow.
  - Admin customer details:
    - Confirm Trading Partner section and any ledger summary.
  - Party ledger page:
    - Check filters, totals, navigation to underlying documents, and that figures match the database.
- **Edge cases and multi-tenant safety**  
  - Validate behavior for:
    - Parties that are only customers, only suppliers, and both.
    - Multiple parties within the same company with similar names (ensure no cross-linking).
    - Different roles (sales, admin, etc.) to confirm RLS and permission enforcement.
    - Multiple tenants to ensure no cross-company leakage through `/api/parties` or `party_ledger`.

