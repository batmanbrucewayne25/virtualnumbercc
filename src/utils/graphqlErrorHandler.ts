/**
 * Utility function to extract error messages from GraphQL error responses
 * Handles both direct error objects and GraphQL response format with errors array
 * 
 * @param error - Error object from catch block or GraphQL response
 * @returns Formatted error message string
 */
export const extractGraphQLError = (error: any): string => {
  // If error has a message property directly
  if (error?.message) {
    return error.message;
  }

  // If error has errors array (GraphQL response format)
  if (error?.errors && Array.isArray(error.errors) && error.errors.length > 0) {
    return error.errors[0].message || "An error occurred";
  }

  // If error.response has errors (nested response)
  if (error?.response?.errors && Array.isArray(error.response.errors) && error.response.errors.length > 0) {
    return error.response.errors[0].message || "An error occurred";
  }

  // If error.response has a message
  if (error?.response?.message) {
    return error.response.message;
  }

  // Default fallback
  return "An error occurred. Please try again.";
};

/**
 * Extract user-friendly message from constraint violation errors
 * 
 * @param error - Error object
 * @returns User-friendly error message
 */
export const getConstraintViolationMessage = (error: any): string => {
  const errorMessage = extractGraphQLError(error);
  
  // Check for constraint violation
  if (errorMessage.includes("constraint") || errorMessage.includes("duplicate") || errorMessage.includes("unique")) {
    // Extract which field is duplicated
    if (errorMessage.includes("pan_number") || errorMessage.includes("pan")) {
      return "PAN number already exists. Please use a different PAN number.";
    }
    if (errorMessage.includes("aadhaar_number") || errorMessage.includes("aadhaar")) {
      return "Aadhaar number already exists. Please use a different Aadhaar number.";
    }
    if (errorMessage.includes("email")) {
      return "Email already exists. Please use a different email.";
    }
    if (errorMessage.includes("phone")) {
      return "Phone number already exists. Please use a different phone number.";
    }
    
    // Generic constraint violation message
    return "This information is already registered. Please use different details.";
  }
  
  return errorMessage;
};

