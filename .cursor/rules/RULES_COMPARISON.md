# Rules Files - Old vs New Comparison

## Summary of Changes

Your old rules were for **"Fresh Breeze Basket"** e-commerce app with:
- Express.js backend
- MongoDB/PostgreSQL (traditional setup)
- React + Redux frontend
- JWT authentication (custom implementation)
- Simple role-based access (admin/user)

Your **NEW** rules are for **Multi-Tenant ERP/POS** system with:
- Supabase backend (Postgres + Auth + Storage + Realtime)
- React Router + Vite + TypeScript + Tailwind CSS
- Granular RBAC with module permissions
- Multi-tenant architecture (subdomain-based)
- Three-level navigation (Landing → Dashboard → Modules)

---

## File-by-File Comparison

### 1. backend-rules.mdc

#### OLD (Fresh Breeze Basket)
```
- Express.js with MVC architecture
- MongoDB/PostgreSQL (traditional)
- JWT with custom refresh tokens
- Simple role-based access (admin/regular)
- Stripe payment integration
- Generic e-commerce operations
```

#### NEW (Multi-Tenant ERP)
```
- Supabase (managed Postgres)
- Multi-tenant with company_id isolation
- Granular RBAC (module.action permissions)
- Row Level Security (RLS) policies
- RPC functions for permission checks
- Company-level module enablement
- Standard table patterns with timestamps
- Automated audit trails
```

**Key New Concepts:**
- `company_modules` table for per-tenant features
- Permission format: `sales.read`, `inventory.write`
- RLS policies for data isolation
- Helper RPC functions (`get_user_permissions`, `user_has_permission`)

---

### 2. frontend-rules.mdc

#### OLD (Fresh Breeze Basket)
```
- React (generic setup)
- CSS Modules or styled-components
- Redux for state management
- Formik for forms
- Simple admin vs user roles
- E-commerce focused (cart, checkout, products)
```

#### NEW (Multi-Tenant ERP)
```
- React 18 + TypeScript + Vite
- Tailwind CSS for styling
- React Router v6 for routing
- React Context + Custom Hooks (no Redux)
- React Query for server state
- Module-based architecture
- Three-level navigation system
- Permission-driven UI
- Single source of truth (modules.config.tsx)
```

**Key New Concepts:**
- `modules.config.tsx` - Configuration-driven modules
- Permission hooks (`useUserPermissions`, `useCanAccess`)
- Context-aware sidebar (shows only in modules)
- E-commerce as both landing page AND module
- Double permission check (company + user)

---

### 3. my-rules.mdc (Integration)

#### OLD (Fresh Breeze Basket)
```
- Axios/Fetch for API calls
- JWT token management
- Redux for state sync
- Stripe Elements integration
- Simple user roles
- Cursor-based pagination
```

#### NEW (Multi-Tenant ERP)
```
- Supabase client for all backend calls
- Supabase Auth (built-in)
- RPC function calls
- Real-time subscriptions
- Multi-tenant data isolation
- React Query for caching
- Optimistic updates
- Company context throughout app
```

**Key New Concepts:**
- RPC pattern: `supabase.rpc('get_user_permissions', {...})`
- Real-time: `supabase.channel().on('postgres_changes', ...)`
- Storage: `supabase.storage.from('bucket').upload(...)`
- Company-scoped queries: `.eq('company_id', companyId)`
- Permission validation in both frontend AND backend

---

## What You MUST Change

### ❌ Remove from Old Rules
1. Express.js references → Use Supabase
2. MongoDB/PostgreSQL setup → Use Supabase Postgres
3. JWT custom implementation → Use Supabase Auth
4. Redux → Use React Context + React Query
5. Generic role checks → Use granular permissions
6. E-commerce specific logic → ERP module logic

### ✅ Add from New Rules
1. Multi-tenant patterns (company_id everywhere)
2. RBAC with module.action permissions
3. Row Level Security (RLS) policies
4. modules.config.tsx pattern
5. Three-level navigation
6. Permission hooks
7. React Query for caching
8. Supabase integration patterns

---

## Migration Checklist

### Backend
- [ ] Remove Express.js backend folder
- [ ] Create Supabase project
- [ ] Run migration.sql to create tables
- [ ] Set up RLS policies on all tables
- [ ] Create RPC functions for permissions
- [ ] Seed initial roles and permissions

### Frontend
- [ ] Remove Redux and related files
- [ ] Add React Router v6
- [ ] Add Tailwind CSS configuration
- [ ] Create modules.config.tsx
- [ ] Implement permission hooks
- [ ] Create context-aware Sidebar
- [ ] Build Home Dashboard
- [ ] Set up protected routes
- [ ] Add Supabase client

### Integration
- [ ] Replace Axios with Supabase client
- [ ] Implement auth flow with Supabase Auth
- [ ] Add company context (subdomain detection)
- [ ] Create permission checking system
- [ ] Set up React Query
- [ ] Implement real-time subscriptions (where needed)
- [ ] Update all queries to include company_id

---

## How to Use New Rules in Cursor

### Step 1: Remove Old Rules
1. Open Cursor settings (Cmd/Ctrl + ,)
2. Go to "Rules" section
3. Delete or disable:
   - `backend-rules.mdc`
   - `frontend-rules.mdc`
   - `my-rules.mdc`

### Step 2: Add New Rules
1. Copy the new `.mdc` files to your project's `.cursor/rules/` folder
2. Or add them via Cursor settings → Rules → Add Rule

### Step 3: Test the Rules
1. Open a TypeScript file in `src/`
2. Type a comment: `// create a new module for HR`
3. Cursor should follow the new module pattern from `modules.config.tsx`

---

## Quick Reference: New Patterns

### Module Configuration
```typescript
// src/config/modules.config.tsx
export const MODULES: ModuleConfig[] = [
  {
    key: 'sales',
    label: 'Sales',
    route: '/sales',
    permissions: ['sales.read'],
    // ... rest of config
  }
];
```

### Permission Check
```typescript
// Frontend
const canEdit = useCanAccess('sales.write');

// Backend (RLS)
WHERE company_id IN (
  SELECT ur.company_id FROM user_roles ur
  WHERE ur.user_id = auth.uid()
)
```

### Data Query
```typescript
const { data } = await supabase
  .from('sales_orders')
  .select('*')
  .eq('company_id', companyId)  // ALWAYS include this
  .order('created_at', { ascending: false });
```

### Navigation Structure
```
Login → E-commerce Landing (no sidebar)
         ↓
      Dashboard (module cards, no sidebar)
         ↓
      Module Page (with context-aware sidebar)
```

---

## Benefits of New Rules

### ✅ Better Type Safety
- TypeScript everywhere
- Strongly typed Supabase queries
- Type-safe permission checks

### ✅ Better Security
- RLS policies at database level
- Double permission checks (UI + DB)
- Company isolation built-in

### ✅ Better Scalability
- Configuration-driven modules
- Easy to add new features
- Modular architecture

### ✅ Better Developer Experience
- Single source of truth
- Clear patterns and conventions
- Self-documenting code

### ✅ Better Performance
- React Query caching
- Optimistic updates
- Efficient real-time subscriptions

---

## Need Help?

If Cursor isn't following the new rules:
1. Make sure files are in `.cursor/rules/` folder
2. Reload Cursor window
3. Check "Always Apply" is set correctly
4. Clear Cursor cache and restart

For questions about specific patterns:
- Backend → Check `backend-rules.mdc`
- Frontend → Check `frontend-rules.mdc`
- Integration → Check `integration-rules.mdc`
