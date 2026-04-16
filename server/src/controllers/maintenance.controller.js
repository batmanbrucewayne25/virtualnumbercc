import { asyncHandler } from "../utils/asyncHandler.js";
import {
  broadcastMaintenanceDisabledToResellers,
  broadcastMaintenanceEnabledToResellers,
} from "../services/maintenanceBroadcast.service.js";

function assertAdminRole(req, res) {
  const role = req.user?.role;
  if (role !== "admin" && role !== "super_admin") {
    res.status(403).json({
      success: false,
      message: "Only admins can broadcast maintenance emails.",
    });
    return false;
  }
  return true;
}

/**
 * @route   POST /api/admin/maintenance/notify-resellers-enabled
 * @desc    Email all eligible resellers (MAINTENANCE_ENABLED_ADMIN template, admin SMTP)
 */
export const notifyResellersMaintenanceEnabled = asyncHandler(
  async (req, res) => {
    if (!assertAdminRole(req, res)) return;
    const results = await broadcastMaintenanceEnabledToResellers();
    const allOk = results.failed === 0;
    res.status(allOk ? 200 : 207).json({
      success: allOk,
      message: allOk
        ? `Maintenance notice sent to ${results.sent} reseller(s).`
        : `Sent ${results.sent} of ${results.total}; ${results.failed} failed.`,
      results,
    });
  },
);

/**
 * @route   POST /api/admin/maintenance/notify-resellers-disabled
 * @desc    Email all eligible resellers when maintenance ends (MAINTENANCE_DISABLED_ADMIN)
 */
export const notifyResellersMaintenanceDisabled = asyncHandler(
  async (req, res) => {
    if (!assertAdminRole(req, res)) return;
    const results = await broadcastMaintenanceDisabledToResellers();
    const allOk = results.failed === 0;
    res.status(allOk ? 200 : 207).json({
      success: allOk,
      message: allOk
        ? `Maintenance completed notice sent to ${results.sent} reseller(s).`
        : `Sent ${results.sent} of ${results.total}; ${results.failed} failed.`,
      results,
    });
  },
);
