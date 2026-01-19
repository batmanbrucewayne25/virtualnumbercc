import { getUserData } from './auth';

/**
 * Check if user has a specific permission
 * @param {string} permissionCode - Permission code (e.g., 'ADMIN_VIEW', 'RESELLER_CREATE')
 * @param {string} action - Action to check ('view', 'create', 'update', 'delete')
 * @param {Object} permissions - Permissions map from context
 * @returns {boolean}
 */
export const hasPermission = (permissionCode, action, permissions = {}) => {
  if (!permissionCode || !action) return false;
  if (!permissions || Object.keys(permissions).length === 0) return false;

  const permission = permissions[permissionCode];
  if (!permission) return false;

  const actionMap = {
    view: 'can_view',
    create: 'can_create',
    update: 'can_update',
    delete: 'can_delete',
  };

  const actionKey = actionMap[action.toLowerCase()];
  return permission[actionKey] || false;
};

/**
 * Check if user can view a module
 * @param {string} module - Module name (e.g., 'Admin', 'Reseller', 'Dashboard')
 * @param {Object} permissions - Permissions map
 * @returns {boolean}
 */
export const canViewModule = (module, permissions = {}) => {
  if (!module || !permissions) return false;

  // Check for view permission for this module
  // Permission codes are like: MODULE_VIEW, MODULE_CREATE, etc.
  const moduleUpper = module.toUpperCase().replace(/\s+/g, '_');
  const viewPermission = `${moduleUpper}_VIEW`;
  
  return hasPermission(viewPermission, 'view', permissions);
};

/**
 * Get permission code from module and action
 * Based on seed script, permission codes are like: DASHBOARD, ADMIN, RESELLER, ROLES_AND_ACCESS, ASSIGN_ROLE
 * For actions, we check the permission object's can_view, can_create, etc.
 * @param {string} permissionName - Permission name as it appears in database (e.g., 'Dashboard', 'Admin', 'Roles and Access')
 * @returns {string} Permission code (uppercase with underscores)
 */
export const getPermissionCode = (permissionName) => {
  if (!permissionName) return null;
  return permissionName
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
};

/**
 * Map modules/actions to permission codes (for common patterns)
 * This maps common module/action combinations to actual permission codes
 */
export const getPermissionCodeByModule = (module, action = 'view') => {
  const moduleMap = {
    'Dashboard': 'DASHBOARD',
    'Admin': 'ADMIN',
    'Reseller': 'RESELLER',
    'Wallet': 'WALLET',
    'Roles': {
      view: 'ROLES_AND_ACCESS',
      create: 'ROLES_AND_ACCESS',
      update: 'ROLES_AND_ACCESS',
      delete: 'ROLES_AND_ACCESS',
    },
    'Assign Role': 'ASSIGN_ROLE',
    'Settings': 'ADMIN_SETTINGS',
  };

  if (moduleMap[module]) {
    if (typeof moduleMap[module] === 'object') {
      return moduleMap[module][action.toLowerCase()] || moduleMap[module].view;
    }
    return moduleMap[module];
  }

  // Fallback: generate from module name
  return getPermissionCode(module);
};

/**
 * Check multiple permissions (OR logic - returns true if any permission is granted)
 * @param {Array} permissionChecks - Array of { permissionCode, action } objects
 * @param {Object} permissions - Permissions map
 * @returns {boolean}
 */
export const hasAnyPermission = (permissionChecks, permissions = {}) => {
  if (!Array.isArray(permissionChecks) || permissionChecks.length === 0) return false;
  
  return permissionChecks.some(({ permissionCode, action }) =>
    hasPermission(permissionCode, action, permissions)
  );
};

/**
 * Check multiple permissions (AND logic - returns true only if all permissions are granted)
 * @param {Array} permissionChecks - Array of { permissionCode, action } objects
 * @param {Object} permissions - Permissions map
 * @returns {boolean}
 */
export const hasAllPermissions = (permissionChecks, permissions = {}) => {
  if (!Array.isArray(permissionChecks) || permissionChecks.length === 0) return false;
  
  return permissionChecks.every(({ permissionCode, action }) =>
    hasPermission(permissionCode, action, permissions)
  );
};

