# Permission System Usage Guide

## Overview

The permission system fetches user role permissions on login and stores them in localStorage. Permissions are then used throughout the app to hide/show menu items and action buttons.

## Permission Structure

Based on the seed script, permissions follow this structure:

```
Module → Permission Name → Permission Code
- Dashboard → Dashboard → DASHBOARD
- Admin → Admin → ADMIN  
- Reseller → Reseller → RESELLER
- Wallet → Wallet → WALLET
- Roles → Roles and Access → ROLES_AND_ACCESS
- Roles → Assign Role → ASSIGN_ROLE
- Settings → Admin Settings → ADMIN_SETTINGS
```

Each permission has actions: `can_view`, `can_create`, `can_update`, `can_delete`

## Usage Examples

### 1. Hide/Show Menu Items in MasterLayout

```jsx
import PermissionGuard from '@/components/PermissionGuard';

// Hide Dashboard menu item
<PermissionGuard module="Dashboard" action="view">
  <li>
    <NavLink to="/">Dashboard</NavLink>
  </li>
</PermissionGuard>

// Hide Admin menu
<PermissionGuard module="Admin" action="view">
  <li>
    <NavLink to="/admin-list">Admin</NavLink>
  </li>
</PermissionGuard>

// Hide Roles menu
<PermissionGuard permissionCode="ROLES_AND_ACCESS" action="view">
  <li>
    <NavLink to="/role-access">Roles & Access</NavLink>
  </li>
</PermissionGuard>

// Hide Assign Role menu
<PermissionGuard permissionCode="ASSIGN_ROLE" action="view">
  <li>
    <NavLink to="/assign-role">Assign Role</NavLink>
  </li>
</PermissionGuard>
```

### 2. Hide Action Buttons in Components

```jsx
import PermissionGuard from '@/components/PermissionGuard';

// Hide "Add Admin" button
<PermissionGuard module="Admin" action="create">
  <Link to="/add-admin">
    <button className="btn btn-primary">Add New Admin</button>
  </Link>
</PermissionGuard>

// Hide "Edit" button
<PermissionGuard module="Admin" action="update">
  <Link to={`/edit-admin/${id}`}>
    <button className="btn btn-secondary">Edit</button>
  </Link>
</PermissionGuard>

// Hide "Delete" button
<PermissionGuard module="Admin" action="delete">
  <button onClick={handleDelete} className="btn btn-danger">Delete</button>
</PermissionGuard>
```

### 3. Using Direct Permission Codes

```jsx
// For permissions with specific codes like "ASSIGN_ROLE", "ROLES_AND_ACCESS"
<PermissionGuard permissionCode="ASSIGN_ROLE" action="view">
  <button>Assign Role</button>
</PermissionGuard>
```

### 4. Programmatic Permission Checks

```jsx
import { usePermissions } from '@/contexts/PermissionContext';
import { hasPermission } from '@/utils/permissions';

const MyComponent = () => {
  const { permissions } = usePermissions();
  
  const canCreateAdmin = hasPermission('ADMIN', 'create', permissions);
  const canViewDashboard = hasPermission('DASHBOARD', 'view', permissions);
  
  return (
    <>
      {canCreateAdmin && <button>Create Admin</button>}
      {canViewDashboard && <div>Dashboard Content</div>}
    </>
  );
};
```

## Permission Codes Reference

Based on the seed script:

| Module | Permission Name | Permission Code | Actions |
|--------|----------------|-----------------|---------|
| Dashboard | Dashboard | `DASHBOARD` | view, create, update, delete |
| Admin | Admin | `ADMIN` | view, create, update, delete |
| Reseller | Reseller | `RESELLER` | view, create, update, delete |
| Wallet | Wallet | `WALLET` | view, create, update, delete |
| Roles | Roles and Access | `ROLES_AND_ACCESS` | view, create, update, delete |
| Roles | Assign Role | `ASSIGN_ROLE` | view, create, update, delete |
| Settings | Admin Settings | `ADMIN_SETTINGS` | view, create, update, delete |

## Implementation Details

1. **Login Flow**: On login, `getUserWithPermissions()` fetches user role and permissions
2. **Storage**: Permissions are stored in localStorage as `userPermissions`
3. **Context**: `PermissionProvider` loads permissions from localStorage and provides them via context
4. **Components**: Use `PermissionGuard` wrapper or `usePermissions()` hook

## Notes

- If user has no role (`mst_roles` is null), permissions will be empty `{}`
- All permission checks return `false` if permissions are empty or not loaded
- Permission data is loaded on login and stored until logout

