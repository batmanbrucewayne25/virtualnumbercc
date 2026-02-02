/**
 * Get API base URL dynamically based on environment and current domain
 * When UI is served from server's dist folder, API is at same origin + /api
 */
export const getApiBaseUrl = () => {
  // Helper function to normalize URL (ensure /api is present exactly once at the end)
  const normalizeApiUrl = (url) => {
    if (!url) return null;
    
    // Remove trailing slashes
    let normalized = url.trim().replace(/\/+$/, '');
    
    // Remove all trailing /api segments (handles /api/api/api cases)
    normalized = normalized.replace(/(\/api)+$/, '');
    
    // Add exactly one /api at the end
    return normalized + '/api';
  };

  // 2. If running in browser, detect from current origin (server base URL)
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    const hostname = window.location.hostname;
    const port = window.location.port;

    // 1. Check environment variable for production/custom domains
    // Only use env variable if not on localhost
    if (import.meta.env.VITE_API_BASE_URL) {
      const envUrl = import.meta.env.VITE_API_BASE_URL.trim();
      // Normalize the environment variable URL
      const normalizedUrl = normalizeApiUrl(envUrl) || `${origin}/api`;
      console.log('[API URL] Using VITE_API_BASE_URL:', { original: envUrl, normalized: normalizedUrl });
      return normalizedUrl;
    }

    // Production/Custom domain: use same origin with /api
    // UI is served from server's dist folder, API is at /api
    return `${origin}/api`;
  }

  // 3. Fallback for server-side rendering
  return 'http://localhost:3001/api';
};

