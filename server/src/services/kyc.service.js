import axios from 'axios';

/**
 * KYC Verification Service
 * Handles Aadhaar, PAN, and GST verification via QuickEKYC API
 */
export class KYCService {
  static QUICKEKYC_BASE_URL = 'https://api.quickekyc.com/api/v1';
  
  /**
   * Get API key from environment
   */
  static getApiKey() {
    const apiKey = process.env.QUICKEKYC_API_KEY;
    if (!apiKey) {
      throw new Error('QUICKEKYC_API_KEY is not configured');
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
        throw new Error('Aadhaar number (id_number) is required');
      }

      const response = await axios.post(
        `${this.QUICKEKYC_BASE_URL}/aadhaar-v2/generate-otp`,
        {
          key: this.getApiKey(),
          id_number: idNumber
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Aadhaar Generate OTP Error:', error.response?.data || error.message);
      throw {
        status: error.response?.status || 500,
        message: error.response?.data?.message || 'Failed to generate OTP',
        error: error.response?.data || error.message
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
        throw new Error('request_id and otp are required');
      }

      const response = await axios.post(
        `${this.QUICKEKYC_BASE_URL}/aadhaar-v2/submit-otp`,
        {
          key: this.getApiKey(),
          request_id: requestId,
          otp: otp
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Aadhaar Submit OTP Error:', error.response?.data || error.message);
      throw {
        status: error.response?.status || 500,
        message: error.response?.data?.message || 'Failed to verify OTP',
        error: error.response?.data || error.message
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
        throw new Error('PAN number (id_number) is required');
      }

      const requestData = {
        key: this.getApiKey(),
        id_number: idNumber
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
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('PAN Verification Error:', error.response?.data || error.message);
      throw {
        status: error.response?.status || 500,
        message: error.response?.data?.message || 'Failed to verify PAN',
        error: error.response?.data || error.message
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
        throw new Error('GST number (id_number) is required');
      }

      const requestData = {
        key: this.getApiKey(),
        id_number: idNumber,
        filing_status_get: filingStatusGet
      };

      const response = await axios.post(
        `${this.QUICKEKYC_BASE_URL}/corporate/gstin`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('GST Verification Error:', error.response?.data || error.message);
      throw {
        status: error.response?.status || 500,
        message: error.response?.data?.message || 'Failed to verify GST',
        error: error.response?.data || error.message
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
        throw new Error('GST number (id_number) is required');
      }

      const requestData = {
        key: this.getApiKey(),
        id_number: idNumber,
        filing_status_get: filingStatusGet
      };

      const response = await axios.post(
        `${this.QUICKEKYC_BASE_URL}/corporate/gstin_sp`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Special GST Verification Error:', error.response?.data || error.message);
      throw {
        status: error.response?.status || 500,
        message: error.response?.data?.message || 'Failed to verify special GST',
        error: error.response?.data || error.message
      };
    }
  }
}
