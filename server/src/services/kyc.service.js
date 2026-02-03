import axios from "axios";

/**
 * KYC Verification Service
 * Handles Aadhaar, PAN, and GST verification via QuickEKYC API
 */
export class KYCService {
  static QUICKEKYC_BASE_URL =
    process.env.QUICKEKYC_BASE_URL || "https://api.quickekyc.com/api/v1";

  /**
   * Get API key from environment
   */
  static getApiKey() {
    const apiKey = process.env.QUICKEKYC_API_KEY;
    if (!apiKey) {
      console.error(
        "[KYC] QUICKEKYC_API_KEY is not configured in environment variables"
      );
      throw new Error("QUICKEKYC_API_KEY is not configured");
    }
    return apiKey;
  }

  /**
   * Generate Aadhaar OTP
   * @param {string} idNumber - Aadhaar number (12 digits)
   * @returns {Promise<object>}
   */
  static async generateAadhaarOTP(idNumber) {
    try {
      if (!idNumber) {
        throw new Error("Aadhaar number (id_number) is required");
      }

      // Validate Aadhaar number format (12 digits)
      if (!/^\d{12}$/.test(idNumber)) {
        throw new Error("Aadhaar number must be exactly 12 digits");
      }

      console.log(
        "[KYC] Generating Aadhaar OTP for:",
        idNumber.replace(/(\d{4})\d{4}(\d{4})/, "$1****$2")
      );

      const response = await axios.post(
        `${this.QUICKEKYC_BASE_URL}/aadhaar-v2/generate-otp`,
        {
          key: this.getApiKey(),
          id_number: idNumber,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 30000, // 30 seconds timeout
        }
      );

      console.log("[KYC] Aadhaar OTP Response:", {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
      });

      // Handle different response structures
      const responseData = response.data;

      // Check for error status in response body (API returns 200 OK but with error in body)
      const statusCode = responseData?.status_code;
      const status = responseData?.status || responseData?.data?.status;
      const requestId =
        responseData?.request_id || responseData?.data?.request_id;

      // Check if API returned an error (even with 200 HTTP status)
      if (
        statusCode === 500 ||
        status === "error" ||
        (statusCode && statusCode >= 400) ||
        (responseData?.message &&
          (responseData.message.toLowerCase().includes("error") ||
            responseData.message.toLowerCase().includes("went wrong") ||
            responseData.message.toLowerCase().includes("failed")))
      ) {
        const errorMessage =
          responseData?.message ||
          responseData?.data?.message ||
          "OTP generation failed. Please check your Aadhaar number and try again.";

        console.error("[KYC] QuickEKYC API Error Response:", {
          status_code: statusCode,
          status: status,
          message: errorMessage,
          request_id: requestId,
          full_response: responseData,
        });

        throw {
          status: statusCode || 500,
          message: errorMessage,
          error: responseData,
          request_id: requestId, // Include request_id even in error for debugging
        };
      }

      // Check if the response indicates success
      if (
        status === "generate_otp_success" ||
        status === "success" ||
        requestId
      ) {
        return {
          success: true,
          data: responseData,
          request_id: requestId,
          status: status,
        };
      } else {
        // Response received but status indicates failure
        const errorMessage =
          responseData?.message ||
          responseData?.data?.message ||
          "OTP generation failed";
        throw {
          status: 400,
          message: errorMessage,
          error: responseData,
        };
      }
    } catch (error) {
      console.error("[KYC] Aadhaar Generate OTP Error:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
      });

      // Extract error message from various possible structures
      let errorMessage = "Failed to generate OTP";
      if (error.response?.data) {
        const errorData = error.response.data;
        errorMessage =
          errorData.message || errorData.error || errorData.msg || errorMessage;
      } else if (error.message) {
        errorMessage = error.message;
      }

      throw {
        status: error.response?.status || error.status || 500,
        message: errorMessage,
        error: error.response?.data || error.error || error.message,
      };
    }
  }

  /**
   * Submit Aadhaar OTP
   * @param {string} requestId - Request ID from generate OTP
   * @param {string} otp - OTP received
   * @returns {Promise<object>}
   */
  static async submitAadhaarOTP(requestId, otp) {
    try {
      if (!requestId || !otp) {
        throw new Error("request_id and otp are required");
      }

      // Validate OTP format (6 digits)
      if (!/^\d{6}$/.test(otp)) {
        throw new Error("OTP must be exactly 6 digits");
      }

      console.log("[KYC] Submitting Aadhaar OTP:", {
        request_id: requestId,
        otp_length: otp.length,
      });

      const response = await axios.post(
        `${this.QUICKEKYC_BASE_URL}/aadhaar-v2/submit-otp`,
        {
          key: this.getApiKey(),
          request_id: requestId,
          otp: otp,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 30000, // 30 seconds timeout
        }
      );

      console.log("[KYC] Aadhaar OTP Submit Response:", {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
      });

      // Handle different response structures
      const responseData = response.data;
      const status = responseData?.status || responseData?.data?.status;

      // Check if verification was successful
      if (
        status === "success_aadhaar" ||
        status === "success" ||
        responseData?.aadhaar_number
      ) {
        return {
          success: true,
          data: responseData,
          status: status,
        };
      } else {
        // Response received but status indicates failure
        const errorMessage =
          responseData?.message ||
          responseData?.data?.message ||
          "OTP verification failed";
        throw {
          status: 400,
          message: errorMessage,
          error: responseData,
        };
      }
    } catch (error) {
      console.error("[KYC] Aadhaar Submit OTP Error:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
      });

      // Extract error message from various possible structures
      let errorMessage = "Failed to verify OTP";
      if (error.response?.data) {
        const errorData = error.response.data;
        errorMessage =
          errorData.message || errorData.error || errorData.msg || errorMessage;
      } else if (error.message) {
        errorMessage = error.message;
      }

      throw {
        status: error.response?.status || error.status || 500,
        message: errorMessage,
        error: error.response?.data || error.error || error.message,
      };
    }
  }

  /**
   * Verify PAN
   * @param {string} idNumber - PAN number
   * @param {string} dob - Date of birth (optional, format: YYYY-MM-DD)
   * @returns {Promise<object>}
   */
  static async verifyPAN(idNumber, dob = null) {
    try {
      if (!idNumber) {
        throw new Error("PAN number (id_number) is required");
      }

      const requestData = {
        key: this.getApiKey(),
        id_number: idNumber,
      };

      // Add date of birth if provided
      if (dob) {
        requestData.dob = dob;
      }

      const response = await axios.post(
        `${this.QUICKEKYC_BASE_URL}/pan/pan_with_dob`,
        requestData,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error(
        "PAN Verification Error:",
        error.response?.data || error.message
      );
      throw {
        status: error.response?.status || 500,
        message: error.response?.data?.message || "Failed to verify PAN",
        error: error.response?.data || error.message,
      };
    }
  }

  /**
   * Verify GST (Normal)
   * @param {string} idNumber - GST number
   * @param {boolean} filingStatusGet - Get filing status (default: true)
   * @returns {Promise<object>}
   */
  static async verifyGST(idNumber, filingStatusGet = true) {
    try {
      if (!idNumber) {
        throw new Error("GST number (id_number) is required");
      }

      const requestData = {
        key: this.getApiKey(),
        id_number: idNumber,
        filing_status_get: filingStatusGet,
      };

      const response = await axios.post(
        `${this.QUICKEKYC_BASE_URL}/corporate/gstin`,
        requestData,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error(
        "GST Verification Error:",
        error.response?.data || error.message
      );
      throw {
        status: error.response?.status || 500,
        message: error.response?.data?.message || "Failed to verify GST",
        error: error.response?.data || error.message,
      };
    }
  }

  /**
   * Verify GST (Special)
   * @param {string} idNumber - GST number
   * @param {boolean} filingStatusGet - Get filing status (default: true)
   * @returns {Promise<object>}
   */
  static async verifyGSTSpecial(idNumber, filingStatusGet = true) {
    try {
      if (!idNumber) {
        throw new Error("GST number (id_number) is required");
      }

      const requestData = {
        key: this.getApiKey(),
        id_number: idNumber,
        filing_status_get: filingStatusGet,
      };

      const response = await axios.post(
        `${this.QUICKEKYC_BASE_URL}/corporate/gstin_sp`,
        requestData,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error(
        "Special GST Verification Error:",
        error.response?.data || error.message
      );
      throw {
        status: error.response?.status || 500,
        message:
          error.response?.data?.message || "Failed to verify special GST",
        error: error.response?.data || error.message,
      };
    }
  }
}
