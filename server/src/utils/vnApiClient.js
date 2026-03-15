/**
 * Virtual Numbers API Client
 *
 * Wraps HTTP calls to the external Virtual Numbers API.
 * Reads VIRTUALNUMBER_API_URL and VIRTUALNUMBER_KEY from process.env.
 *
 * When VIRTUALNUMBER_API_MOCK is "true", the local /virtualnumbers endpoints
 * return mock data, so this client will receive mock responses transparently.
 */

const getBaseUrl = () => {
  const url = process.env.VIRTUALNUMBER_API_URL;
  if (!url) {
    throw new Error("VIRTUALNUMBER_API_URL is not set in environment variables");
  }
  return url.replace(/\/+$/, "");
};

const getApiKey = () => {
  const key = process.env.VIRTUALNUMBER_KEY;
  if (!key) {
    throw new Error("VIRTUALNUMBER_KEY is not set in environment variables");
  }
  return key;
};

async function vnFetch(method, path, body = null) {
  const url = `${getBaseUrl()}${path}`;
  const options = {
    method,
    headers: {
      "Authorization": `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  console.log(`[vnApiClient] ${method} ${url}`);

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok || (data.status && data.status >= 400)) {
    const errMsg = data.message || `VN API error (${response.status})`;
    console.error(`[vnApiClient] Error: ${errMsg}`, data);
    const error = new Error(errMsg);
    error.apiStatus = data.status || response.status;
    error.apiData = data;
    throw error;
  }

  return data;
}

export const VnApiClient = {
  /**
   * GET /virtualnumbers/available
   * @returns {{ status, message, data: Array<{id, number, region, rate}> }}
   */
  async getAvailableNumbers() {
    return vnFetch("GET", "/virtualnumbers/available");
  },

  /**
   * POST /virtualnumbers/activate
   * @param {string} number - Virtual number to activate
   * @returns {{ status, message, data: {number, status, activation_date, expiry_date, amount_deducted, wallet_balance} }}
   */
  async activateNumber(number) {
    return vnFetch("POST", "/virtualnumbers/activate", { number });
  },

  /**
   * POST /virtualnumbers/call-forward
   * @param {string} number - Activated virtual number
   * @param {string} forwardType - mobile, extension, or uri
   * @param {string} forwardValue - Destination number/URI
   * @returns {{ status, message, data: {number, forward_type, forward_value} }}
   */
  async configureCallForwarding(number, forwardType, forwardValue) {
    return vnFetch("POST", "/virtualnumbers/call-forward", {
      number,
      forward_type: forwardType,
      forward_value: forwardValue,
    });
  },

  /**
   * PUT /virtualnumbers/call-forward
   * @param {string} number - Activated virtual number
   * @param {string} forwardType - mobile, extension, or uri
   * @param {string} forwardValue - Destination number/URI
   * @returns {{ status, message, data: {number, forward_type, forward_value} }}
   */
  async updateCallForwarding(number, forwardType, forwardValue) {
    return vnFetch("PUT", "/virtualnumbers/call-forward", {
      number,
      forward_type: forwardType,
      forward_value: forwardValue,
    });
  },

  /**
   * GET /virtualnumbers/details/:number
   * @param {string} number - Virtual number (will be URL-encoded)
   * @returns {{ status, message, data: {number, status, forward_to, activation_date, expiry_date} }}
   */
  async getNumberDetails(number) {
    return vnFetch("GET", `/virtualnumbers/details/${encodeURIComponent(number)}`);
  },

  /**
   * POST /virtualnumbers/suspend
   * @param {string} number - Number to suspend
   * @returns {{ status, message, data: {number, status, suspended_on} }}
   */
  async suspendNumber(number) {
    return vnFetch("POST", "/virtualnumbers/suspend", { number });
  },

  /**
   * POST /virtualnumbers/reactivate
   * @param {string} number - Number to reactivate
   * @returns {{ status, message, data: {number, status, reactivated_on, expiry_date, amount_deducted, wallet_balance} }}
   */
  async reactivateNumber(number) {
    return vnFetch("POST", "/virtualnumbers/reactivate", { number });
  },
};
