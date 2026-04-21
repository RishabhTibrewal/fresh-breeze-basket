# Skill: ARCH_STATE Update

## When to use
- After meaningful architecture-level changes are made.
- Especially when changes involve:
  - Database schema/RLS
  - API routes/proxy/network flow
  - Environment variables
  - PM2/deployment process
  - Newly discovered gotchas to prevent regressions

## Trigger phrases
- "update ARCH_STATE"
- "document architecture change"
- "new env var/process change"
- "record gotcha in architecture notes"

## Update format
1. Add a new dated section under "Recent Changes (YYYY-MM-DD)".
2. Include:
   - Objective
   - Backend changes
   - Frontend changes (if any)
   - DB migrations/functions/policies (if any)
   - Operational/deployment notes (if any)
   - Files touched (key references only)
3. Keep entries factual and implementation-specific.

## Quality rules
- Do not delete previous historical entries.
- Do not contradict existing architecture unless the architecture itself changed.
- Reflect real implemented behavior, not proposed behavior.
- Keep language concise and avoid speculative wording.

## Reference files
- `ARCH_STATE.md`
- `backend/src/db/migrations/`
- `backend/src/index.ts`
- `backend/src/middleware/tenant.ts`
- `frontend/src/lib/apiClient.ts`

## Done criteria
- `ARCH_STATE.md` documents the latest architectural reality.
- Future contributors can avoid repeating the same mistakes.
