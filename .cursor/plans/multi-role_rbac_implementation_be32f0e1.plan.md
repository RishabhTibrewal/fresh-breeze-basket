---
name: Multi-Role RBAC Implementation
overview: Implement many-to-many RBAC system with accounts role, supporting multiple roles per user per company, admin override, and updated middleware/APIs.
todos:
  - id: create-roles-table
    content: Create roles master table migration with seed data (admin, sales, accounts, user)
    status: completed
  - id: create-user-roles-table
    content: Create user_roles mapping table with unique constraint on (user_id, company_id, role_id)
    status: completed
    dependencies:
      - create-roles-table
  - id: migrate-existing-roles
    content: Migrate existing company_memberships.role data to user_roles table
    status: completed
    dependencies:
      - create-user-roles-table
  - id: update-db-functions
    content: Update database helper functions (has_role, has_any_role) with admin override logic
    status: completed
    dependencies:
      - create-user-roles-table
  - id: create-role-utils
    content: Create backend/src/utils/roles.ts with getUserRoles, hasRole, hasAnyRole helper functions
    status: completed
    dependencies:
      - update-db-functions
  - id: update-auth-middleware
    content: Update auth.ts middleware to use multi-role system and create requireRole() middleware
    status: completed
    dependencies:
      - create-role-utils
  - id: update-user-endpoints
    content: Update user creation/update endpoints to accept roles array and insert into user_roles
    status: completed
    dependencies:
      - create-role-utils
  - id: update-admin-endpoints
    content: Update admin role management endpoints to handle roles array
    status: completed
    dependencies:
      - update-user-endpoints
  - id: update-db-triggers
    content: Update handle_new_user() trigger to support roles array from user metadata
    status: completed
    dependencies:
      - create-user-roles-table
  - id: update-rls-policies
    content: Update RLS policies to use new multi-role helper functions
    status: completed
    dependencies:
      - update-db-functions
---

# Multi-Role RBAC Implementation Plan

## Overview

Transform the current single-role system to a many-to-many RBAC system where users can have multiple roles (sales, accounts, admin) per company, with admin having automatic access to all permissions.

## Database Schema Changes

### 1. Create Roles Master Table

Create `backend/src/db/migrations/[timestamp]_create_roles_table.sql`:

- `roles` table with columns: `id` (UUID), `name` (TEXT, unique), `description` (TEXT), `created_at`, `updated_at`
- Seed initial roles: 'admin', 'sales', 'accounts', 'user'
- Add indexes for performance

### 2. Create User Roles Mapping Table

Create `backend/src/db/migrations/[timestamp]_create_user_roles_table.sql`:

- `user_roles` table with columns: `id` (UUID), `user_id` (UUID), `company_id` (UUID), `role_id` (UUID), `created_at`, `updated_at`
- Unique constraint on `(user_id, company_id, role_id)`
- Foreign keys to `auth.users`, `companies`, and `roles`
- Indexes on `user_id`, `company_id`, and `role_id`

### 3. Migrate Existing Data

Create `backend/src/db/migrations/[timestamp]_migrate_existing_roles.sql`:

- Migrate existing `company_memberships.role` values to `user_roles` table
- Map enum values ('admin', 'sales', 'user') to role IDs from `roles` table
- Preserve company_id and user_id relationships

### 4. Update Helper Functions

Update database functions in migration:

- Replace `is_admin()`, `is_sales()`, `is_admin_or_sales()` with new multi-role versions
- Create `has_role(user_id, role_name, company_id)` function
- Create `has_any_role(user_id, role_names[], company_id)` function
- Admin override: if user has 'admin' role, return true for all role checks

## Backend Implementation

### 5. Update Type Definitions

Update `backend/src/types/database.ts`:

- Add `Role` interface
- Add `UserRole` interface
- Update `Database` interface with new tables

### 6. Create Role Helper Functions

Create `backend/src/utils/roles.ts`:

- `getUserRoles(userId, companyId): Promise<Role[]>`
- `hasRole(userId, companyId, roleName): Promise<boolean>`
- `hasAnyRole(userId, companyId, roleNames[]): Promise<boolean>`
- `hasAllRoles(userId, companyId, roleNames[]): Promise<boolean>`
- Admin override logic: if user has 'admin' role, return true

### 7. Update Authentication Middleware

Update `backend/src/middleware/auth.ts`:

- Replace `getUserRole()` with `getUserRoles()` returning array
- Update `req.user.role` to `req.user.roles: string[]`
- Update role cache to store array of roles
- Create `requireRole(roles: string[])` middleware:
- Check if user has admin role → allow
- Otherwise check if user has any of the required roles
- Update `adminOnly` to use new role checking
- Update `isSalesExecutive` to use new role checking
- Create `requireAccounts` middleware

### 8. Update User Creation/Update Endpoints

Update `backend/src/controllers/auth.ts`:

- Modify `register()` to accept `roles: string[]` instead of single `role`
- Insert multiple rows into `user_roles` based on roles array
- Validate roles exist in `roles` table

Update `backend/src/controllers/admin.ts`:

- Modify `updateUserRole()` to `updateUserRoles()`:
- Accept `roles: string[]` in request body
- Replace all user roles for the company (delete existing, insert new)
- Prevent removing admin role from self
- Update validation to check against `roles` table

Update `backend/src/controllers/customerController.ts`:

- Update user creation to accept roles array

### 9. Update Database Triggers

Update `backend/src/db/migrations/[timestamp]_update_user_triggers.sql`:

- Modify `handle_new_user()` trigger to support roles array from metadata
- Create user_roles entries based on roles array

### 10. Create Role Management API Endpoints

Add to `backend/src/controllers/admin.ts`:

- `getAllRoles()`: List all available roles
- `getUserRoles(userId, companyId)`: Get roles for a specific user in a company

Add routes to `backend/src/routes/admin.ts`:

- `GET /api/admin/roles` - Get all roles
- `GET /api/admin/users/:userId/roles` - Get user roles
- `PUT /api/admin/users/:userId/roles` - Update user roles (replace existing endpoint)

## RLS Policies

### 11. Update RLS Policies for Multi-Role Support

Create `backend/src/db/migrations/[timestamp]_update_rls_for_multi_role.sql`:

- Update existing RLS policies to use `has_role()` or `has_any_role()` functions
- Ensure company_id isolation is maintained
- Add policies for accounts role where needed
- Admin users should bypass RLS checks (handled in functions)

## Frontend (Future - Not in Scope)

Note: Frontend implementation is mentioned but not part of this plan. Will need:

- API endpoint to fetch current user's roles
- Role-based navigation visibility
- Role-based component rendering

## Migration Strategy

1. Create new tables (`roles`, `user_roles`)
2. Migrate existing data from `company_memberships.role` to `user_roles`
3. Update backend code to use new structure
4. Keep `company_memberships.role` column temporarily for backward compatibility
5. Update all middleware and controllers
6. Test thoroughly before removing old `role` column

## Key Files to Modify

- `backend/src/db/migrations/` - New migration files
- `backend/src/middleware/auth.ts` - Role checking logic
- `backend/src/utils/roles.ts` - New helper functions
- `backend/src/controllers/auth.ts` - User creation
- `backend/src/controllers/admin.ts` - Role management
- `backend/src/types/database.ts` - Type definitions
- `backend/src/routes/admin.ts` - API routes

## Testing Considerations

- Test admin override (admin should have access to everything)
- Test multiple roles per user (sales + accounts)