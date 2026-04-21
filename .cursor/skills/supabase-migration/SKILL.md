# Skill: Supabase Migration

## When to use
- Adding/changing database schema, constraints, indexes, RLS, views, or RPC functions.
- Backfilling data after schema changes.

## Trigger phrases
- "write migration"
- "add table/column/index"
- "update RLS policy"
- "backfill schema data"

## Non-negotiable guardrails
- Read `ARCH_STATE.md` before migration design.
- Every tenant-scoped table must include `company_id`.
- Add or update RLS policies for tenant isolation.
- Prefer UUID PKs and `created_at`/`updated_at` timestamps.

## Implementation checklist
1. File creation
   - Add a migration in `backend/src/db/migrations/` using existing timestamp naming style.
2. Schema design
   - Include `company_id` for tenant-owned entities.
   - Use `TEXT` where practical instead of arbitrary `VARCHAR` lengths.
3. Tenant security
   - Add/adjust RLS policies scoped to company context.
   - Validate role-based access in policies where required.
4. Data backfill (if needed)
   - Add idempotent update statements for existing rows.
   - Guard against null/invalid legacy data.
5. Performance
   - Add indexes for common query filters (`company_id`, foreign keys, date fields).
6. API/type sync
   - Regenerate/update `frontend/src/integrations/supabase/types.ts` when schema changes.
7. App usage sync
   - Update backend/frontend code paths that read/write changed fields.
8. Verification
   - Validate migration applies cleanly on a fresh and existing database.
   - Verify RLS blocks cross-company access.

## Reference files
- `backend/src/db/migrations/`
- `backend/src/config/supabase.ts`
- `backend/src/db/schema.sql`
- `frontend/src/integrations/supabase/types.ts`

## Done criteria
- Migration is reversible-safe and coherent with existing naming.
- Tenant and RLS rules are enforced.
- Generated types and app code are aligned with schema.
- No unresolved lint/type issues in touched files.
