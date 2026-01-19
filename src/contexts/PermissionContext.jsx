import { createContext, useContext, useState, useEffect } from 'react';
import { getUserData, getUserPermissions } from '@/utils/auth';

const PermissionContext = createContext(null);

export const PermissionProvider = ({ children }) => {
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  // Load permissions from localStorage
  const loadPermissions = (setLoadingState = false) => {
    try {
      const storedPermissions = getUserPermissions();
      if (storedPermissions && typeof storedPermissions === 'object') {
        setPermissions(storedPermissions);
      } else {
        setPermissions({});
      }
    } catch (error) {
      console.error('Error loading permissions from storage:', error);
      setPermissions({});
    } finally {
      if (setLoadingState) {
        setLoading(false);
      }
    }
  };

  // Load permissions from localStorage on mount
  useEffect(() => {
    loadPermissions(true); // Set loading to false after initial load
  }, []);

  // Listen for storage events (when permissions are updated in another tab/window)
  // and custom events (when permissions are updated in same tab)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'userPermissions') {
        loadPermissions(false); // Don't change loading state on refresh
      }
    };

    // Listen for custom event for same-tab updates (e.g., after login)
    const handlePermissionUpdate = () => {
      loadPermissions(false); // Don't change loading state on refresh
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('permissionsUpdated', handlePermissionUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('permissionsUpdated', handlePermissionUpdate);
    };
  }, []);

  const value = {
    permissions,
    loading,
    refreshPermissions: () => {
      // Reload permissions from storage
      const storedPermissions = getUserPermissions();
      if (storedPermissions && typeof storedPermissions === 'object') {
        setPermissions(storedPermissions);
      } else {
        setPermissions({});
      }
    },
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionProvider');
  }
  return context;
};

