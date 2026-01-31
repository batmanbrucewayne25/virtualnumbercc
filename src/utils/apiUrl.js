/**
 * Get API base URL dynamically based on environment and current domain
 * When UI is served from server's dist folder, API is at same origin + /api
 */
export const getApiBaseUrl = () => {
  // 1. Check environment variable first (highest priority)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // 2. If running in browser, detect from current origin (server base URL)
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    const hostname = window.location.hostname;
    const port = window.location.port;

    // Development: use localhost:3001 (Vite dev server on different port)
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // If port is 5173 or 5174 (Vite dev), use separate API server
      if (port === '5173' || port === '5174' || !port) {
        return 'http://localhost:3001/api';
      }
      // If port is 3001 or same as server, use same origin
      return `${origin}/api`;
    }

    // Production/Custom domain: use same origin with /api
    // UI is served from server's dist folder, API is at /api
    return `${origin}/api`;
  }

  // 3. Fallback for server-side rendering
  return 'http://localhost:3001/api';
};

