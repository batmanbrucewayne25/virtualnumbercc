/**
 * Normalize date string to YYYY-MM-DD format for comparison
 * Handles various date formats: DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY, YYYY/MM/DD, etc.
 * 
 * @param dateStr - Date string in any format
 * @returns Normalized date string in YYYY-MM-DD format, or null if invalid
 */
export const normalizeDate = (dateStr: string): string | null => {
  if (!dateStr) return null;
  
  // Remove any extra whitespace
  const cleaned = dateStr.trim();
  
  // Handle different date formats
  // Format 1: DD-MM-YYYY (e.g., "16-04-1992")
  // Format 2: YYYY-MM-DD (e.g., "1992-04-16")
  // Format 3: DD/MM/YYYY (e.g., "16/04/1992")
  // Format 4: YYYY/MM/DD (e.g., "1992/04/16")
  // Format 5: ISO string or other formats
  
  // Try to parse as DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyyMatch = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = ddmmyyyyMatch[1].padStart(2, '0');
    const month = ddmmyyyyMatch[2].padStart(2, '0');
    const year = ddmmyyyyMatch[3];
    return `${year}-${month}-${day}`; // Convert to YYYY-MM-DD
  }
  
  // Try to parse as YYYY-MM-DD or YYYY/MM/DD
  const yyyymmddMatch = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (yyyymmddMatch) {
    const year = yyyymmddMatch[1];
    const month = yyyymmddMatch[2].padStart(2, '0');
    const day = yyyymmddMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`; // Already in YYYY-MM-DD
  }
  
  // Try standard Date parsing for other formats
  try {
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      // Check if date is valid (not invalid date)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    // If parsing fails, return null
  }
  
  return null;
};

/**
 * Compare two date strings, handling various formats
 * 
 * @param date1 - First date string
 * @param date2 - Second date string
 * @returns true if dates match, false otherwise
 */
export const compareDates = (date1: string, date2: string): boolean => {
  const d1 = normalizeDate(date1);
  const d2 = normalizeDate(date2);
  
  if (!d1 || !d2) {
    // If either date cannot be normalized, do a direct string comparison
    return date1 === date2;
  }
  
  return d1 === d2;
};

