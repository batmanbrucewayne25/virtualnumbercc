/**
 * Aadhar Number Validation Utility
 * Validates Aadhar numbers using Verhoeff algorithm checksum
 */

/**
 * Verhoeff algorithm multiplication table
 */
const MULTIPLICATION_TABLE = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

/**
 * Verhoeff algorithm permutation table
 */
const PERMUTATION_TABLE = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

/**
 * Validates Aadhar number using Verhoeff algorithm
 * @param {string} aadharNumber - The Aadhar number to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function validateAadhar(aadharNumber) {
  // Remove any spaces or dashes
  const cleaned = String(aadharNumber).replace(/[\s-]/g, '');
  
  // Check if it's exactly 12 digits
  if (!/^\d{12}$/.test(cleaned)) {
    return false;
  }
  
  // Aadhar numbers should not start with 0 or 1
  if (cleaned[0] === '0' || cleaned[0] === '1') {
    return false;
  }
  
  // Convert to array of digits
  const digits = cleaned.split('').map(Number);
  
  // Verhoeff algorithm check
  let check = 0;
  for (let i = 0; i < digits.length; i++) {
    check = MULTIPLICATION_TABLE[check][PERMUTATION_TABLE[((i + 1) % 8)][digits[digits.length - 1 - i]]];
  }
  
  // If check is 0, the number is valid
  return check === 0;
}

/**
 * Validates Aadhar number format (basic checks without checksum)
 * Useful for quick validation before detailed checksum validation
 * @param {string} aadharNumber - The Aadhar number to validate
 * @returns {object} - { valid: boolean, message: string }
 */
export function validateAadharFormat(aadharNumber) {
  if (!aadharNumber || typeof aadharNumber !== 'string') {
    return { valid: false, message: 'Aadhar number is required' };
  }
  
  const cleaned = aadharNumber.replace(/[\s-]/g, '');
  
  // Check if it contains only digits
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, message: 'Aadhar number must contain only digits' };
  }
  
  // Check if it's exactly 12 digits
  if (cleaned.length !== 12) {
    return { valid: false, message: 'Aadhar number must be exactly 12 digits' };
  }
  
  // Check if it starts with 0 or 1
  if (cleaned[0] === '0' || cleaned[0] === '1') {
    return { valid: false, message: 'Aadhar number cannot start with 0 or 1' };
  }
  
  // Check Verhoeff checksum
  if (!validateAadhar(cleaned)) {
    return { valid: false, message: 'Invalid Aadhar number. Please check the digits and try again.' };
  }
  
  return { valid: true, message: 'Valid Aadhar number' };
}

