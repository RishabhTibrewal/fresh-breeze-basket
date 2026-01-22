---
name: multi_company_memberships
overview: Introduce a company membership model so one auth user can belong to multiple companies, and update auth/tenant checks to use memberships as the source of truth.
todos:
  - id: todo-1769083215194-w1uci7xfk
    content: ""
    status: completed
---

# Multi-company Memberships Plan

## Decisions

- Memberships are primary; `profiles.company_id` becomes optional/derived.
- Active company selection: use tenant subdomain when present; otherwise fall back to first membership.

## Schema & migrations

- Add `public.company_memberships` table with:
- `id UUID PK`, `user_id UUID` (FK `auth.users`), `company_id UUID` (FK `public.companies`), `role user_role`, `is_active BOOLEAN`, timestamps.
- Unique constraint on `(user_id, company_id)`.
- Make `profiles.company_id` nullable (or keep but stop relying on it for auth).
- Backfill: insert memberships for existing profiles using `profiles.company_id`.
- Add indexes to accelerate membership lookup by `user_id` and `company_id`.
- Update RLS policies (if present) to reference memberships for access checks.

Files:

- Migration SQL in [`backend/src/db/migrations`](backend/src/db/migrations).
- Schema snapshot in [`backend/src/db/schema.sql`](backend/src/db/schema.sql).

## Backend auth & tenant resolution

- `register` flow:
- If auth user already exists, do **not** try to create a new auth user.
- Ensure membership exists for `req.companyId`; create it if missing.
- Keep profiles per-user (no company overwrite).
- `login` flow:
- Require `req.companyId` when header/subdomain is present.
- Validate membership for `req.companyId` and block if not a member.
- If no tenant is provided, choose the first active membership and set `req.companyId` (for fallback mode).
- `protect` middleware:
- Replace profile company checks with membership checks.
- If `req.companyId` is set, ensure membership exists for that company; attach `company_id` to `req.user`.

Files:

- [`backend/src/controllers/auth.ts`](backend/src/controllers/auth.ts)
- [`backend/src/middleware/auth.ts`](backend/src/middleware/auth.ts)
- [`backend/src/middleware/tenant.ts`](backend/src/middleware/tenant.ts)

## Data access updates

- Any code that reads `profiles.company_id` for access control should instead consult `company_memberships`.
- Keep `profiles.company_id` only for legacy display (optional) or deprecate later.

Files to review for updates:

- [`backend/src/controllers/auth.ts`](backend/src/controllers/auth.ts) (login/register/getCurrentUser)
- [`backend/src/controllers/customerController.ts`](backend/src/controllers/customerController.ts) (profile checks)
- [`backend/src/middleware/auth.ts`](backend/src/middleware/auth.ts)

## Test plan

- Register a user on `tenantA` and verify membership for `tenantA`.
- Register same email on `tenantB` and verify membership for `tenantB` without creating a new auth user.
- Login on `tenantA` and `tenantB` and verify company isolation and data access.
- Login without tenant (root domain) and confirm fallback to first membership.