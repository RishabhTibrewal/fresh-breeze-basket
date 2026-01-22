---
name: enforce-membership-company
overview: Enforce company-scoped membership checks for login/register and role resolution so users can only access a company when (company_id, user_id) exists in company_memberships.
todos:
  - id: auth-login-register
    content: Enforce membership checks in auth flows.
    status: completed
  - id: middleware-membership
    content: Require company-scoped membership in middleware.
    status: completed
  - id: frontend-sync
    content: Align frontend login/sync error handling.
    status: completed
---

# Enforce Company Membership Checks

## Scope

- Ensure every auth/role check uses `(company_id, user_id)` in `company_memberships` with no tenant fallback.
- Allow registration for existing auth users **only** when password verification succeeds, then create membership.

## Plan

- Update backend auth flows to require a tenant and membership:
- [`backend/src/controllers/auth.ts`](backend/src/controllers/auth.ts):
  - `login`: require `req.companyId`; query `company_memberships` with both keys; deny if missing; remove fallback to first membership.
  - `register`: if email exists, verify password, then upsert membership with `(user_id, company_id)`; deny if password invalid.
  - `getCurrentUser`/`sync-session` (if present): require `req.companyId` and validate membership with both keys; no fallback.
- Update auth middleware to enforce membership by company:
- [`backend/src/middleware/auth.ts`](backend/src/middleware/auth.ts):
  - `protect`: require `req.companyId`; call membership lookup with both keys; remove fallback to first membership; set role from membership.
- Ensure role checks always use membership for the active company:
- Use `company_memberships` lookup or existing membership helper with explicit `companyId` (no fallback).
- Frontend alignment:
- [`frontend/src/contexts/AuthContext.tsx`](frontend/src/contexts/AuthContext.tsx): ensure any login flow that succeeds in Supabase but fails backend membership signs out immediately (already implemented) and shows a clear error.

## Validation

- Register existing email into new company with correct password → membership created and login allowed.
- Register existing email with wrong password → registration rejected.
- Login without tenant/company_id → rejected.
- Login with tenant but no membership → rejected and frontend session cleared.

## Notes

- Keep `profiles.company_id` sync for RLS compatibility, but do not use it for authorization.