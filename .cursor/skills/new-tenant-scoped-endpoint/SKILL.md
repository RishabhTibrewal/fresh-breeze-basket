# Skill: New Tenant-Scoped Endpoint

## When to use
- Adding a new backend route/controller that reads or writes tenant data.
- Refactoring an endpoint that currently misses tenant isolation or permission checks.

## Trigger phrases
- "add endpoint"
- "new route/controller"
- "tenant-safe API"
- "company_id filter missing"

## Non-negotiable guardrails
- Read `ARCH_STATE.md` first, especially the Anti-Hallucination Ledger.
- Keep `/api` route prefix and existing frontend->backend separation.
- Never query tenant-owned tables without `.eq('company_id', req.companyId)`.
- Never trust frontend access checks alone; enforce backend auth + role checks.

## Implementation checklist
1. Route wiring
   - Add/update route in `backend/src/routes/*`.
   - Ensure middleware order: `resolveTenant` -> auth/protect -> handler.
2. Controller contract
   - Use `req.companyId` from tenant middleware.
   - Validate input explicitly; throw `ValidationError` for invalid payloads.
3. Data isolation
   - Add `.eq('company_id', req.companyId)` to all tenant queries.
   - Use `.schema('procurement')` for procurement tables when applicable.
4. Permission model
   - Enforce role/permission checks in backend.
   - Ensure frontend gate exists (`useCanAccess` + module enabled checks).
5. Error handling
   - Use `ApiError`/`ValidationError` and let global middleware map responses.
6. Frontend API integration
   - Add typed function in `frontend/src/api/*.ts`.
   - Keep request/response types explicit; avoid `any`.
7. Tests/verification
   - Verify one happy path and one cross-company denial path.
   - Confirm endpoint cannot return data from another `company_id`.

## Reference files
- `backend/src/middleware/tenant.ts`
- `backend/src/middleware/auth.ts`
- `backend/src/index.ts`
- `backend/src/utils/ApiError.ts`
- `frontend/src/lib/apiClient.ts`
- `frontend/src/config/modules.config.tsx`

## Done criteria
- Endpoint uses tenant context from middleware.
- All tenant queries are company-filtered.
- Backend auth/permission checks are present.
- Frontend integration is typed and gated.
- No lint/type errors introduced in touched files.
