/**
 * Aadhar Number Validation Utility
 * Validates Aadhar numbers format (basic validation only)
 */

/**
 * Validates Aadhar number format
 * Requirements:
 * - Exactly 12 digits
 * - Only numbers (0-9)
 * - No alphabets
 * - No special characters
 * - No spaces
 * - Can start with 0 (allowed)
 * @param {string} aadharNumber - The Aadhar number to validate
 * @returns {object} - { valid: boolean, message: string }
 */
export function validateAadharFormat(aadharNumber) {
  if (!aadharNumber || typeof aadharNumber !== 'string') {
    return { valid: false, message: 'Aadhar number is required' };
  }
  
  // Remove spaces and dashes for validation
  const cleaned = aadharNumber.replace(/[\s-]/g, '');
  
  // Check if it contains only digits (no alphabets or special characters)
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, message: 'Aadhar number must contain only digits (0-9). No alphabets or special characters allowed.' };
  }
  
  // Check if it's exactly 12 digits
  if (cleaned.length !== 12) {
    return { valid: false, message: 'Aadhar number must be exactly 12 digits' };
  }
  
  // Note: Can start with 0 (no restriction)
  
  return { valid: true, message: 'Valid Aadhar number format' };
}

