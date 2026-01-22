---
name: multi-tenant-rls
overview: Implement single-database multi-tenancy using a company_id column and RLS, with tenant resolution via subdomain.
todos:
  - id: schema-company
    content: Add companies table and company_id columns
    status: completed
  - id: rls-policies
    content: Create RLS policies keyed by company_id claim
    status: completed
  - id: auth-claims
    content: Set company_id claim via subdomain in auth flow
    status: completed
  - id: frontend-tenant
    content: Bind API base URL to subdomain
    status: completed
  - id: migration
    content: Backfill company_id for existing data
    status: completed
---

# Multi-Tenant (Shared DB + RLS)

## Approach

- Use a `companies` table and add `company_id` foreign keys to all tenant-scoped tables (products, customers, orders, inventory, etc.).
- Enforce access with Postgres Row Level Security (RLS) policies tied to a `company_id` claim in JWT.
- Resolve company from subdomain on login/signup and include it in auth claims.

## Backend changes

- **Schema:** add `companies` table and `company_id` columns with indexes and foreign keys on all tenant-owned tables.
- **RLS policies:** add `company_id = auth.jwt()->>'company_id'` policies on all tenant-owned tables.
- **Auth flow:** on login, map subdomain → company_id, then inject `company_id` into the user’s JWT claims.
- **Middleware:** add tenant resolver to verify subdomain → company_id and ensure the authenticated user matches that company.

Key files:

- [backend/src/db/schema.sql](backend/src/db/schema.sql)
- [backend/src/db/migrations/*](backend/src/db/migrations)
- [backend/src/middleware/auth.ts](backend/src/middleware/auth.ts)
- [backend/src/index.ts](backend/src/index.ts)

## Frontend changes

- **API base URL:** derive API domain from `window.location.host` so subdomain routes requests to the correct tenant.
- **Login flow:** ensure login/signup sends tenant context (subdomain) so backend can set the correct company_id claim.

Key files:

- [frontend/src/lib/apiClient.ts](frontend/src/lib/apiClient.ts)
- [frontend/src/contexts/AuthContext.tsx](frontend/src/contexts/AuthContext.tsx)

## Data migration

- Create a default company and assign existing rows to it.
- Backfill `company_id` for all existing rows.

## Testing

- Verify two subdomains cannot see each other’s data.
- Confirm RLS blocks cross-tenant access for all key tables.

## Rollout

- Add company creation flow in admin tools.
- Add subdomain DNS + SSL for each new company.