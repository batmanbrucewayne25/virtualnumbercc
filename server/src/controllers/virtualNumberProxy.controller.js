import { VnApiClient } from "../utils/vnApiClient.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getHasuraClient } from "../config/hasura.client.js";

/**
 * @desc    Get available virtual numbers (proxy to VN API)
 * @route   GET /api/virtual-numbers/available
 * @access  Protected (JWT)
 */
export const getAvailableNumbers = asyncHandler(async (req, res) => {
  const result = await VnApiClient.getAvailableNumbers();
  res.status(200).json(result);
});

/**
 * @desc    Activate a virtual number (proxy to VN API)
 * @route   POST /api/virtual-numbers/activate
 * @access  Protected (JWT)
 */
export const activateNumber = asyncHandler(async (req, res) => {
  const { number } = req.body;
  if (!number) {
    return res.status(400).json({ status: 400, message: "number is required" });
  }

  const result = await VnApiClient.activateNumber(number);
  res.status(200).json(result);
});

/**
 * @desc    Update call forwarding (proxy to VN API + local DB update)
 * @route   PUT /api/virtual-numbers/call-forward
 * @access  Protected (JWT)
 */
export const updateCallForwarding = asyncHandler(async (req, res) => {
  const { virtual_number_id, number, forward_type, forward_value } = req.body;

  if (!number || !forward_value) {
    return res.status(400).json({
      status: 400,
      message: "number and forward_value are required",
    });
  }

  const fType = forward_type || "mobile";

  const apiResult = await VnApiClient.updateCallForwarding(number, fType, forward_value);

  if (virtual_number_id) {
    try {
      const client = getHasuraClient();
      await client.client.request(
        `mutation UpdateCallForward($id: uuid!, $call_forwarding_number: String!) {
          update_mst_virtual_number_by_pk(
            pk_columns: { id: $id }
            _set: { call_forwarding_number: $call_forwarding_number }
          ) {
            id
            call_forwarding_number
          }
        }`,
        { id: virtual_number_id, call_forwarding_number: forward_value },
      );
    } catch (dbErr) {
      console.error("[virtualNumberProxy] Local DB update failed (non-fatal):", dbErr.message);
    }
  }

  res.status(200).json({
    success: true,
    message: apiResult.message || "Call forwarding updated successfully",
    data: apiResult.data,
  });
});
