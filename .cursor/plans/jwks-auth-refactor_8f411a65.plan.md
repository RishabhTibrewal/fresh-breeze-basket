---
name: jwks-auth-refactor
overview: Replace Supabase Auth network validation with local JWKS JWT verification, scope rate limiting to auth routes, and add tenant cache in the backend middleware.
todos:
  - id: add-jwks-util
    content: Add jose + JWKS verifier utility in supabaseJwt.ts
    status: completed
  - id: update-auth-middleware
    content: Refactor auth middleware to use JWKS + new rate limit
    status: completed
  - id: tenant-cache
    content: Add tenant cache and update detection order
    status: completed
  - id: verify-build
    content: Quick sanity check of types and runtime expectations
    status: completed
---

# JWKS Auth Refactor Plan

## Scope

- Replace Supabase Auth `getUser()` calls with local JWT verification using JWKS.
- Apply rate limiting only to selected auth endpoints (router-relative paths).
- Add in-memory tenant cache with TTL in [`backend/src/middleware/tenant.ts`](backend/src/middleware/tenant.ts).

## Changes

- Add reusable verifier in [`backend/src/utils/supabaseJwt.ts`](backend/src/utils/supabaseJwt.ts) using `jose` and Supabase JWKS (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`), validating `issuer` and `aud` and returning decoded payload with `sub` /`email` .
- Handle JWKS verification errors explicitly:
    - invalid/expired token → return 401
    - JWKS fetch/network failure → return 503 (“Auth verification unavailable”) with a clear log
- Update [`backend/src/middleware/auth.ts`](backend/src/middleware/auth.ts):
- Replace `verifyUserToken` / `supabase.auth.getUser` with the JWKS verifier.
- Require `req.companyId` (already set by tenant middleware), fetch membership via `getUserMembership`, derive role via `getUserRole`, and set `req.user`.
- Remove legacy profile `company_id` sync on every request.
- Adjust rate limiting to only apply to router-relative auth endpoints (per your selection), return HTTP 429 on limit.
- Update `isAuthenticated` to use JWKS verification (no Supabase calls).
- Keep `adminOnly`, `isAdmin`, `isSalesExecutive` logic on membership roles.
- Update [`backend/src/middleware/tenant.ts`](backend/src/middleware/tenant.ts):
- Add in-memory cache `{ subdomain -> { companyId, companySlug, expiresAt } }` with 10-minute TTL.
- Use detection order: `X-Tenant-Subdomain`, then `Host`.
- Keep Origin/Referer for logging only, not selection.
- Update dependencies in [`backend/package.json`](backend/package.json) to include `jose`.