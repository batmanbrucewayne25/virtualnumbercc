/**
 * Virtual Numbers API Client
 *
 * Wraps HTTP calls to the external Virtual Numbers API.
 * Reads VIRTUALNUMBER_API_URL and VIRTUALNUMBER_KEY from process.env.
 *
 * When VIRTUALNUMBER_API_MOCK is "true", all methods return mock data locally
 * without calling the external API. This is used for local development/testing.
 */

const isMockMode = () => process.env.VIRTUALNUMBER_API_MOCK === "true";

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

// ── Mock helpers (used when VIRTUALNUMBER_API_MOCK=true) ─────────────────────

let mockCounter = 0;

function mockAvailableNumbers() {
  // Use timestamp + random to ensure unique numbers across server restarts
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  const base = parseInt(String(ts).slice(-7)) * 10 + rand;
  mockCounter++;
  return {
    status: 200,
    message: "Available numbers fetched successfully",
    data: [
      { id: `mock-id-${ts}-1`, number: `+91${6000000000 + base}`, region: "India", rate: 500.0 },
      { id: `mock-id-${ts}-2`, number: `+91${6000000000 + base + 1}`, region: "India", rate: 500.0 },
      { id: `mock-id-${ts}-3`, number: `+91${6000000000 + base + 2}`, region: "India", rate: 500.0 },
    ],
  };
}

function mockActivateNumber(number) {
  const today = new Date();
  const expiry = new Date(today);
  expiry.setDate(expiry.getDate() + 360);
  return {
    status: 200,
    message: `Number activated successfully. Amount deducted: 500`,
    data: {
      number,
      status: "ACTIVE",
      activation_date: today.toISOString().split("T")[0],
      expiry_date: expiry.toISOString().split("T")[0],
      amount_deducted: 500.0,
      wallet_balance: 4500.0,
    },
  };
}

function mockCallForwarding(number, forwardType, forwardValue) {
  return {
    status: 200,
    message: "Call forwarding configured successfully",
    data: { number, forward_type: forwardType, forward_value: forwardValue },
  };
}

function mockNumberDetails(number) {
  const today = new Date();
  const expiry = new Date(today);
  expiry.setDate(expiry.getDate() + 360);
  return {
    status: 200,
    message: "Number details fetched successfully",
    data: {
      number,
      status: "ACTIVE",
      forward_to: "SIP/airtel/9000000001",
      activation_date: today.toISOString().split("T")[0],
      expiry_date: expiry.toISOString().split("T")[0],
    },
  };
}

function mockSuspendNumber(number) {
  return {
    status: 200,
    message: "Number suspended successfully",
    data: { number, status: "SUSPENDED", suspended_on: new Date().toISOString() },
  };
}

function mockReactivateNumber(number) {
  const today = new Date();
  const expiry = new Date(today);
  expiry.setDate(expiry.getDate() + 360);
  return {
    status: 200,
    message: "Number reactivated successfully. Amount deducted: 500",
    data: {
      number,
      status: "ACTIVE",
      reactivated_on: today.toISOString(),
      expiry_date: expiry.toISOString().split("T")[0],
      amount_deducted: 500.0,
      wallet_balance: 4000.0,
    },
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export const VnApiClient = {
  /**
   * GET /virtualnumbers/available
   * @returns {{ status, message, data: Array<{id, number, region, rate}> }}
   */
  async getAvailableNumbers() {
    if (isMockMode()) {
      console.log("[vnApiClient] MOCK: getAvailableNumbers");
      return mockAvailableNumbers();
    }
    return vnFetch("GET", "/virtualnumbers/available");
  },

  /**
   * POST /virtualnumbers/activate
   * @param {string} number - Virtual number to activate
   * @returns {{ status, message, data: {number, status, activation_date, expiry_date, amount_deducted, wallet_balance} }}
   */
  async activateNumber(number) {
    if (isMockMode()) {
      console.log(`[vnApiClient] MOCK: activateNumber(${number})`);
      return mockActivateNumber(number);
    }
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
    if (isMockMode()) {
      console.log(`[vnApiClient] MOCK: configureCallForwarding(${number})`);
      return mockCallForwarding(number, forwardType, forwardValue);
    }
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
    if (isMockMode()) {
      console.log(`[vnApiClient] MOCK: updateCallForwarding(${number})`);
      return mockCallForwarding(number, forwardType, forwardValue);
    }
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
    if (isMockMode()) {
      console.log(`[vnApiClient] MOCK: getNumberDetails(${number})`);
      return mockNumberDetails(number);
    }
    return vnFetch("GET", `/virtualnumbers/details/${encodeURIComponent(number)}`);
  },

  /**
   * POST /virtualnumbers/suspend
   * @param {string} number - Number to suspend
   * @returns {{ status, message, data: {number, status, suspended_on} }}
   */
  async suspendNumber(number) {
    if (isMockMode()) {
      console.log(`[vnApiClient] MOCK: suspendNumber(${number})`);
      return mockSuspendNumber(number);
    }
    return vnFetch("POST", "/virtualnumbers/suspend", { number });
  },

  /**
   * POST /virtualnumbers/reactivate
   * @param {string} number - Number to reactivate
   * @returns {{ status, message, data: {number, status, reactivated_on, expiry_date, amount_deducted, wallet_balance} }}
   */
  async reactivateNumber(number) {
    if (isMockMode()) {
      console.log(`[vnApiClient] MOCK: reactivateNumber(${number})`);
      return mockReactivateNumber(number);
    }
    return vnFetch("POST", "/virtualnumbers/reactivate", { number });
  },
};
