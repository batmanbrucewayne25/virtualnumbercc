import { usePermissions } from '@/contexts/PermissionContext';
import { hasPermission, getPermissionCodeByModule } from '@/utils/permissions';

/**
 * PermissionGuard component - Conditionally renders children based on permissions
 * @param {string} module - Module name (e.g., 'Admin', 'Reseller', 'Dashboard', 'Roles')
 * @param {string} action - Action required ('view', 'create', 'update', 'delete')
 * @param {string} permissionCode - Optional: Direct permission code override (e.g., 'DASHBOARD', 'ASSIGN_ROLE')
 * @param {ReactNode} children - Content to render if permission is granted
 * @param {ReactNode} fallback - Optional: Content to render if permission is denied
 * @param {boolean} showFallback - Whether to show fallback or hide completely (default: false)
 */
const PermissionGuard = ({
  module,
  action = 'view',
  permissionCode,
  children,
  fallback = null,
  showFallback = false,
}) => {
  const { permissions, loading } = usePermissions();

  if (loading) {
    // Optionally show loading state
    return null;
  }

  // Get permission code
  const permCode = permissionCode || (module ? getPermissionCodeByModule(module, action) : null);

  if (!permCode) {
    console.warn('PermissionGuard: module or permissionCode is required');
    return showFallback ? fallback : null;
  }

  const hasAccess = hasPermission(permCode, action, permissions);

  if (!hasAccess) {
    return showFallback ? fallback : null;
  }

  return children;
};

export default PermissionGuard;

