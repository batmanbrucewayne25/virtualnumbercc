/**
 * Async handler wrapper to catch errors in async route handlers
 * @param {Function} fn - Async function
 * @returns {Function} Express middleware function
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
