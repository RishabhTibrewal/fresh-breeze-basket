---
name: Fix auth signup flow
overview: Switch company/customer user creation to Supabase Auth signup/admin API instead of direct `auth.users` inserts, and repair existing `auth.users` rows that break `/token` password grant.
todos:
  - id: switch-auth-creation
    content: Update company/customer creation to use Auth admin APIs
    status: completed
  - id: stop-direct-auth-inserts
    content: Remove code paths calling auth.users RPCs
    status: completed
  - id: backfill-auth-users
    content: Add migration to fix NULL auth.users tokens
    status: completed
  - id: validate-login
    content: Re-run migrations and verify login works
    status: completed
---

## Plan

- Align auth user creation with Supabase Auth
- Update [`backend/src/controllers/companies.ts`](backend/src/controllers/companies.ts) to replace `supabaseAdmin.rpc('create_company_with_admin', ...)` with `supabaseAdmin.auth.admin.createUser` and service-role inserts into `public.companies` and `public.profiles` (company_id + role) so the trigger handles profile creation and no direct `auth.users` inserts remain.
- Update [`backend/src/controllers/customerController.ts`](backend/src/controllers/customerController.ts) to remove the RPC fallback (`create_customer_with_user`) and always use the admin API path (similar to the existing `createCustomerWithUser`), ensuring profile/company metadata is set via `user_metadata` and/or profile upsert.

- Retire/stop using SQL functions that write to `auth.users`
- Keep the functions in SQL for now but ensure no code paths call [`backend/src/db/migrations/20260119_create_company_with_admin_rpc.sql`](backend/src/db/migrations/20260119_create_company_with_admin_rpc.sql) or [`backend/src/db/migrations/20230610_create_customer_function.sql`](backend/src/db/migrations/20230610_create_customer_function.sql); optionally add a note or guard in backend to prevent future use.

- Repair bad `auth.users` data that causes `/token` 500
- Add a migration (e.g. `backend/src/db/migrations/20260119_fix_auth_users_tokens.sql`) to backfill `auth.users.confirmation_token` (and other token fields if needed) from `NULL` to `''`, and ensure `email_confirmed_at` is set where appropriate. This targets the error: `Scan error ... confirmation_token: converting NULL to string is unsupported`.

- Validate
- Re-run the SQL migrations in Supabase, then test `supabase.auth.signInWithPassword` from the frontend to confirm the `/token` 500 is resolved.