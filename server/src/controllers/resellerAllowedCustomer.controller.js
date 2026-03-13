import { asyncHandler } from '../utils/asyncHandler.js';
import { getHasuraClient } from '../config/hasura.client.js';

const MAX_ROWS = 10000;

function normalizeEmail(email) {
  if (email == null || typeof email !== 'string') return null;
  const s = email.trim().toLowerCase();
  return s === '' ? null : s;
}

function normalizePhone(phone) {
  if (phone == null || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  return digits === '' ? null : digits;
}

/**
 * @desc    Replace allowed customers list for the logged-in reseller
 * @route   POST /api/reseller/allowed-customers
 * @access  Private (Reseller only)
 */
export const upsertAllowedCustomers = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'reseller') {
    return res.status(403).json({
      success: false,
      message: 'Only resellers can update allowed customers list.',
    });
  }

  const resellerId = req.user.userId;
  let { emails = [], phones = [] } = req.body || {};

  if (!Array.isArray(emails)) emails = [];
  if (!Array.isArray(phones)) phones = [];

  const emailSet = new Set();
  const phoneSet = new Set();
  emails.forEach((e) => {
    const n = normalizeEmail(e);
    if (n) emailSet.add(n);
  });
  phones.forEach((p) => {
    const n = normalizePhone(p);
    if (n) phoneSet.add(n);
  });

  const total = emailSet.size + phoneSet.size;
  if (total === 0) {
    return res.status(400).json({
      success: false,
      message: 'Provide at least one email or phone.',
    });
  }
  if (total > MAX_ROWS) {
    return res.status(400).json({
      success: false,
      message: `Too many entries. Maximum ${MAX_ROWS} allowed.`,
    });
  }

  const client = getHasuraClient();

  try {
    const deleteMutation = `
      mutation DeleteResellerAllowedCustomers($reseller_id: uuid!) {
        delete_reseller_allowed_customer(where: { reseller_id: { _eq: $reseller_id } }) {
          affected_rows
        }
      }
    `;
    await client.client.request(deleteMutation, { reseller_id: resellerId });
  } catch (err) {
    console.error('Error deleting existing allowed customers:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to update allowed list.',
    });
  }

  const objects = [];
  emailSet.forEach((email) => {
    objects.push({ reseller_id: resellerId, email, phone: null });
  });
  phoneSet.forEach((phone) => {
    objects.push({ reseller_id: resellerId, email: null, phone });
  });

  if (objects.length === 0) {
    return res.json({
      success: true,
      message: 'Allowed list cleared.',
      data: { count: 0 },
    });
  }

  try {
    const insertMutation = `
      mutation InsertResellerAllowedCustomers($objects: [reseller_allowed_customer_insert_input!]!) {
        insert_reseller_allowed_customer(objects: $objects) {
          affected_rows
        }
      }
    `;
    const result = await client.client.request(insertMutation, { objects });
    const affected = result?.insert_reseller_allowed_customer?.affected_rows ?? 0;
    return res.json({
      success: true,
      message: 'Allowed customers list updated.',
      data: { count: affected },
    });
  } catch (err) {
    console.error('Error inserting allowed customers:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to save allowed list.',
    });
  }
});

/**
 * @desc    Check if email or phone is allowed for customer onboarding (public, for ClientHub)
 * @route   POST /api/reseller/check-allowed-customer
 * @access  Public
 */
export const checkAllowedCustomer = asyncHandler(async (req, res) => {
  const { resellerId, email, phone } = req.body || {};

  if (!resellerId) {
    return res.status(400).json({
      success: false,
      message: 'resellerId is required.',
    });
  }

  const client = getHasuraClient();

  const resellerQuery = `
    query GetResellerAllowExisting($id: uuid!) {
      mst_reseller_by_pk(id: $id) {
        id
        allow_existing_customer
      }
    }
  `;
  let reseller;
  try {
    const r = await client.client.request(resellerQuery, { id: resellerId });
    reseller = r?.mst_reseller_by_pk;
  } catch (err) {
    console.error('Error fetching reseller:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to check allowed status.',
    });
  }

  if (!reseller) {
    return res.status(404).json({
      success: false,
      message: 'Reseller not found.',
    });
  }

  if (reseller.allow_existing_customer !== true) {
    return res.json({
      success: true,
      allowed: true,
      message: 'Reseller allows all customers.',
    });
  }

  const normEmail = normalizeEmail(email);
  const normPhone = normalizePhone(phone);
  if (!normEmail && !normPhone) {
    return res.json({
      success: true,
      allowed: false,
      message: 'Email or phone required to check.',
    });
  }

  let query;
  const variables = { reseller_id: resellerId };

  if (normEmail && normPhone) {
    query = `
      query CheckAllowedCustomer($reseller_id: uuid!, $email: String!, $phone: String!) {
        reseller_allowed_customer(
          where: {
            _or: [
              { reseller_id: { _eq: $reseller_id }, email: { _eq: $email } },
              { reseller_id: { _eq: $reseller_id }, phone: { _eq: $phone } }
            ]
          }
          limit: 1
        ) {
          id
        }
      }
    `;
    variables.email = normEmail;
    variables.phone = normPhone;
  } else if (normEmail) {
    query = `
      query CheckAllowedCustomer($reseller_id: uuid!, $email: String!) {
        reseller_allowed_customer(
          where: { reseller_id: { _eq: $reseller_id }, email: { _eq: $email } }
          limit: 1
        ) {
          id
        }
      }
    `;
    variables.email = normEmail;
  } else {
    query = `
      query CheckAllowedCustomer($reseller_id: uuid!, $phone: String!) {
        reseller_allowed_customer(
          where: { reseller_id: { _eq: $reseller_id }, phone: { _eq: $phone } }
          limit: 1
        ) {
          id
        }
      }
    `;
    variables.phone = normPhone;
  }

  try {
    const result = await client.client.request(query, variables);
    const rows = result?.reseller_allowed_customer ?? [];
    const allowed = rows.length > 0;
    return res.json({
      success: true,
      allowed,
      message: allowed ? 'Customer is allowed.' : 'Customer is not in the allowed list.',
    });
  } catch (err) {
    console.error('Error checking allowed customer:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to check allowed status.',
    });
  }
});

/**
 * @desc    Get count of allowed customers for logged-in reseller
 * @route   GET /api/reseller/allowed-customers/count
 * @access  Private (Reseller only)
 */
export const getAllowedCustomersCount = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'reseller') {
    return res.status(403).json({
      success: false,
      message: 'Only resellers can view allowed customers count.',
    });
  }

  const resellerId = req.user.userId;
  const client = getHasuraClient();

  const query = `
    query GetAllowedCount($reseller_id: uuid!) {
      reseller_allowed_customer_aggregate(where: { reseller_id: { _eq: $reseller_id } }) {
        aggregate {
          count
        }
      }
    }
  `;
  try {
    const result = await client.client.request(query, { reseller_id: resellerId });
    const count = result?.reseller_allowed_customer_aggregate?.aggregate?.count ?? 0;
    return res.json({
      success: true,
      data: { count },
    });
  } catch (err) {
    console.error('Error fetching allowed count:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch count.',
    });
  }
});
