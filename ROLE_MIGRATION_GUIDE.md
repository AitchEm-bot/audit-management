# Role System Migration Guide

## Overview
This guide documents the migration from a 3-tier role system to a 4-tier role system.

### Old Roles (3-tier)
- `user` - Regular user
- `manager` - Manager
- `admin` - Administrator

### New Roles (4-tier)
- `emp` - Employee (replaces `user`)
- `manager` - Manager (unchanged)
- `exec` - Executive (new role)
- `admin` - Administrator (unchanged)

## Migration Steps

### 1. Database Migration (REQUIRED FIRST)

Run the migration script in Supabase SQL Editor:

```bash
# Location: scripts/migrate-roles-to-4-tier.sql
```

This script will:
- Update all `user` roles to `emp`
- Drop old CHECK constraint
- Add new CHECK constraint with 4 roles
- Update default role from `'user'` to `'emp'`
- Verify migration success

**IMPORTANT:** Run this migration script BEFORE deploying the application code!

### 2. Code Changes (Already Completed)

All application code has been updated to support the new 4-tier role system:

#### Files Modified:
1. **COMPLETE_DB_SETUP.sql** (Line 29)
   - Updated CHECK constraint to include 4 roles
   - Changed default from `'user'` to `'emp'`

2. **hooks/use-auth.tsx** (Line 14)
   - Updated Profile interface type definition

3. **components/user-management.tsx**
   - Updated Profile interface (Line 16)
   - Added 4-role badge variants (Lines 75-88)
   - Updated role dropdown with Employee/Executive options (Lines 124-127)

4. **components/navigation.tsx** (Lines 68-80)
   - Updated role badge styling with distinct colors:
     - Admin: Red
     - Executive: Purple (new)
     - Manager: Blue
     - Employee: Gray
   - Added display labels (Executive/Employee instead of exec/emp)

5. **components/profile-form.tsx**
   - Already uses generic `string` type (no changes needed)

6. **components/protected-route.tsx**
   - Already uses flexible string array (no changes needed)

7. **middleware.ts**
   - No changes needed (role checking is flexible)

### 3. Role Assignment

After migration, assign Executive role to specific users:

```sql
-- In Supabase SQL Editor
UPDATE public.profiles
SET role = 'exec'
WHERE email = 'executive@company.com';
```

### 4. Testing Checklist

- [ ] Run database migration script
- [ ] Verify all existing users migrated from `user` to `emp`
- [ ] Test login with each role type
- [ ] Verify role badges display correctly in navigation
- [ ] Test role dropdown in admin panel shows all 4 options
- [ ] Verify role-based access control still works
- [ ] Test admin panel access (admin only)
- [ ] Assign at least one user to `exec` role for testing

### 5. Role Hierarchy & Permissions

Current implementation:
- **Admin**: Full access to all features including admin panel
- **Executive**: Same permissions as Employee (can be customized)
- **Manager**: Same permissions as Employee (can be customized)
- **Employee**: Standard user access

**Note:** All roles currently have similar permissions except Admin. To implement role-specific views and permissions, you'll need to add additional logic in:
- Middleware (middleware.ts) for route protection
- Components for conditional rendering
- API routes for data filtering

## Next Steps for Role-Based Views

To implement different views for each role:

1. **Create role-specific dashboard pages:**
   ```
   app/dashboard/emp/page.tsx
   app/dashboard/manager/page.tsx
   app/dashboard/exec/page.tsx
   app/dashboard/admin/page.tsx
   ```

2. **Update middleware.ts** to route users to role-specific dashboards

3. **Add role-based data filtering** in lib/supabase/queries.ts

4. **Create role-specific components** for each view

## Rollback Plan

If you need to rollback:

```sql
-- Rollback to 3-tier system
BEGIN;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'admin', 'manager'));
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user';

UPDATE public.profiles SET role = 'user' WHERE role = 'emp';
UPDATE public.profiles SET role = 'user' WHERE role = 'exec';

COMMIT;
```

## Support

If you encounter issues:
1. Check Supabase logs for database errors
2. Check browser console for TypeScript/React errors
3. Verify migration script completed successfully
4. Ensure no users have invalid role values
