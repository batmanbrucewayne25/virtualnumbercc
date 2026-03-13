import { Icon } from "@iconify/react/dist/iconify.js";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getMstVirtualNumbers } from "@/hasura/mutations/virtualNumber";
import { getMstResellers } from "@/hasura/mutations/reseller";
import { getUserData, getAuthToken } from "@/utils/auth";
import { formatDateIST } from "@/utils/dateUtils";
import { getApiBaseUrl } from "@/utils/apiUrl";
import RenewalPlanModal from "./RenewalPlanModal";
import GracePeriodConfirmModal from "./GracePeriodConfirmModal";

const RENEW_THRESHOLD_DAYS = 30;

const VirtualNumbersListLayer = () => {
  const [virtualNumbers, setVirtualNumbers] = useState([]);
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [renewingId, setRenewingId] = useState(null);
  const [renewalModalOpen, setRenewalModalOpen] = useState(false);
  const [selectedVirtualNumberForRenewal, setSelectedVirtualNumberForRenewal] =
    useState(null);
  const [renewalError, setRenewalError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [resellerFilter, setResellerFilter] = useState("all");
  const [userRole, setUserRole] = useState(null);

  const [gracePeriodModalOpen, setGracePeriodModalOpen] = useState(false);
  const [selectedVnForGracePeriod, setSelectedVnForGracePeriod] =
    useState(null);
  const [gracePeriodLoading, setGracePeriodLoading] = useState(false);
  const [gracePeriodError, setGracePeriodError] = useState("");

  useEffect(() => {
    const token = getAuthToken();
    const userData = getUserData();
    let role = userData?.role;
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        role = payload.role || role;
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    }
    setUserRole(role);
  }, []);

  const isReseller = userRole === "reseller";
  const isAdmin = userRole === "admin" || userRole === "super_admin";

  useEffect(() => {
    fetchResellers();
  }, []);

  useEffect(() => {
    fetchVirtualNumbers();
  }, [resellerFilter]);

  const fetchResellers = async () => {
    try {
      const result = await getMstResellers();
      if (result.success) {
        setResellers(result.data || []);
      }
    } catch (err) {
      console.error("Error fetching resellers:", err);
    }
  };

  const fetchVirtualNumbers = async () => {
    setLoading(true);
    setError("");
    try {
      const userData = getUserData();
      const filters = {};

      if (userData?.role === "reseller" && userData?.id) {
        filters.resellerId = userData.id;
      } else if (resellerFilter && resellerFilter !== "all") {
        filters.resellerId = resellerFilter;
      }

      const result = await getMstVirtualNumbers(filters);
      if (result.success) {
        setVirtualNumbers(result.data || []);
      } else {
        setError(result.message || "Failed to load virtual numbers");
      }
    } catch (err) {
      console.error("Error fetching virtual numbers:", err);
      setError("An error occurred while loading virtual numbers");
    } finally {
      setLoading(false);
    }
  };

  const getResellerDisplayName = (reseller) => {
    if (!reseller) return "-";
    return (
      reseller.brand_name ||
      reseller.business_name ||
      [reseller.first_name, reseller.last_name].filter(Boolean).join(" ") ||
      reseller.email ||
      "-"
    );
  };

  const getCustomerDisplayName = (customer) => {
    if (!customer) return "-";
    return customer.profile_name || customer.email || "-";
  };

  const formatDate = formatDateIST;

  const getDaysLeft = (expiryDateStr) => {
    if (!expiryDateStr) return "-";
    const expiry = new Date(expiryDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    const diffMs = expiry - today;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays < 0 ? 0 : diffDays;
  };

  const isGracePeriodActive = (gracePeriodEnd) => {
    if (!gracePeriodEnd) return false;
    return new Date(gracePeriodEnd) > new Date();
  };

  const formatGracePeriodEnd = (gracePeriodEnd) => {
    if (!gracePeriodEnd) return "-";
    const d = new Date(gracePeriodEnd);
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const shouldShowRenewButton = (expiryDateStr, gracePeriodEnd) => {
    const daysLeft = getDaysLeft(expiryDateStr);
    if (typeof daysLeft !== "number") return false;

    if (daysLeft > 0 && daysLeft <= RENEW_THRESHOLD_DAYS) return true;

    if (daysLeft === 0 && isGracePeriodActive(gracePeriodEnd)) return true;

    return false;
  };

  const isRenewDisabled = (expiryDateStr, gracePeriodEnd) => {
    const daysLeft = getDaysLeft(expiryDateStr);
    if (daysLeft === 0 && !isGracePeriodActive(gracePeriodEnd)) return true;
    return false;
  };

  const handleRenewClick = (vn) => {
    setSelectedVirtualNumberForRenewal(vn);
    setRenewalError("");
    setRenewalModalOpen(true);
  };

  const handleRenew = async (vn, subscriptionPlanId) => {
    if (!vn?.id || !vn?.mst_customer?.email) {
      setRenewalError(
        "Cannot send renewal: virtual number or customer email is missing.",
      );
      return;
    }

    if (!subscriptionPlanId) {
      setRenewalError("Please select a subscription plan.");
      return;
    }

    setRenewingId(vn.id);
    setRenewalError("");

    try {
      const API_BASE_URL = getApiBaseUrl();
      const response = await fetch(
        `${API_BASE_URL}/customer/send-renewal-payment-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAuthToken()}`,
          },
          body: JSON.stringify({
            virtual_number_id: vn.id,
            subscription_plan_id: subscriptionPlanId,
          }),
        },
      );

      const result = await response.json();

      if (result.success) {
        setSuccessMessage(
          `Renewal payment link sent to ${vn.mst_customer?.email}.`,
        );
        setTimeout(() => setSuccessMessage(""), 5000);
        setRenewalModalOpen(false);
        setSelectedVirtualNumberForRenewal(null);
        fetchVirtualNumbers();
      } else {
        setRenewalError(
          result.message || "Failed to send renewal payment email.",
        );
      }
    } catch (err) {
      console.error("Error sending renewal payment email:", err);
      setRenewalError(
        err.message || "An error occurred while sending renewal payment email.",
      );
    } finally {
      setRenewingId(null);
    }
  };

  const handleGracePeriodClick = (vn) => {
    setSelectedVnForGracePeriod(vn);
    setGracePeriodError("");
    setGracePeriodModalOpen(true);
  };

  const handleEnableGracePeriod = async (virtualNumberId) => {
    setGracePeriodLoading(true);
    setGracePeriodError("");

    try {
      const API_BASE_URL = getApiBaseUrl();
      const response = await fetch(
        `${API_BASE_URL}/customer/enable-grace-period`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAuthToken()}`,
          },
          body: JSON.stringify({ virtual_number_id: virtualNumberId }),
        },
      );

      const result = await response.json();

      if (result.success) {
        setSuccessMessage(
          result.message || "Grace period enabled successfully.",
        );
        setTimeout(() => setSuccessMessage(""), 5000);
        setGracePeriodModalOpen(false);
        setSelectedVnForGracePeriod(null);
        fetchVirtualNumbers();
      } else {
        setGracePeriodError(result.message || "Failed to enable grace period.");
      }
    } catch (err) {
      console.error("Error enabling grace period:", err);
      setGracePeriodError(
        err.message || "An error occurred while enabling grace period.",
      );
    } finally {
      setGracePeriodLoading(false);
    }
  };

  const filteredVirtualNumbers = virtualNumbers.filter((vn) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const vnNum = (vn.virtual_number || "").toLowerCase();
    const callFwd = (vn.call_forwarding_number || "").toLowerCase();
    const customerName = getCustomerDisplayName(vn.mst_customer).toLowerCase();
    const customerEmail = (vn.mst_customer?.email || "").toLowerCase();
    const resellerName = getResellerDisplayName(vn.mst_reseller).toLowerCase();
    const resellerEmail = (vn.mst_reseller?.email || "").toLowerCase();
    return (
      vnNum.includes(term) ||
      callFwd.includes(term) ||
      customerName.includes(term) ||
      customerEmail.includes(term) ||
      resellerName.includes(term) ||
      resellerEmail.includes(term)
    );
  });

  const uniqueResellerIds = [
    ...new Set(virtualNumbers.map((vn) => vn.mst_reseller?.id).filter(Boolean)),
  ];
  const resellerCount = uniqueResellerIds.length;

  return (
    <div className="card h-100 p-0 radius-12">
      <div className="card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between">
        <div className="d-flex align-items-center flex-wrap gap-3">
          <form className="navbar-search">
            <input
              type="text"
              className="bg-base h-40-px w-auto"
              name="search"
              placeholder="Search by number, customer, reseller..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Icon icon="ion:search-outline" className="icon" />
          </form>
          {isAdmin && (
            <select
              className="form-select form-select-sm w-auto ps-12 py-6 radius-12 h-40-px"
              value={resellerFilter}
              onChange={(e) => setResellerFilter(e.target.value)}
            >
              <option value="all">All Resellers</option>
              {resellers.map((r) => (
                <option key={r.id} value={r.id}>
                  {getResellerDisplayName(r)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <div className="card-body p-24">
        {isAdmin && (
          <p className="text-muted small mb-3">
            {resellerFilter === "all"
              ? `Showing ${filteredVirtualNumbers.length} of ${virtualNumbers.length} virtual number(s) across ${resellerCount} reseller(s)`
              : `Showing ${filteredVirtualNumbers.length} of ${virtualNumbers.length} virtual number(s) of 1 reseller`}
          </p>
        )}
        {isReseller && (
          <p className="text-muted small mb-3">
            Showing {filteredVirtualNumbers.length} of {virtualNumbers.length}{" "}
            virtual number(s) (your customers)
          </p>
        )}
        {error && (
          <div className="alert alert-danger radius-8 mb-24" role="alert">
            <Icon icon="material-symbols:error-outline" className="icon me-2" />
            {error}
          </div>
        )}
        {successMessage && (
          <div className="alert alert-success radius-8 mb-24" role="alert">
            <Icon icon="mdi:check-circle-outline" className="icon me-2" />
            {successMessage}
          </div>
        )}

        {loading ? (
          <div className="text-center py-40">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="text-muted mt-3">Loading virtual numbers...</p>
          </div>
        ) : filteredVirtualNumbers.length === 0 ? (
          <div className="text-center py-40">
            <Icon
              icon="mdi:phone-off"
              className="icon text-6xl text-muted mb-3"
            />
            <p className="text-muted">No virtual numbers found</p>
          </div>
        ) : (
          <div className="table-responsive scroll-sm">
            <table className="table bordered-table sm-table mb-0">
              <thead>
                <tr>
                  <th scope="col">S NO</th>
                  <th scope="col">Virtual Number</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Call Forwarding Num</th>
                  {isAdmin && <th scope="col">Reseller Name</th>}
                  <th scope="col">Exp Date</th>
                  <th scope="col">Days Left</th>
                  {isAdmin && (
                    <th scope="col" className="text-center">
                      Action
                    </th>
                  )}
                  {isReseller && (
                    <th scope="col" className="text-center">
                      Action
                    </th>
                  )}
                  <th scope="col">Grace Period</th>
                </tr>
              </thead>
              <tbody>
                {filteredVirtualNumbers.map((vn, index) => {
                  const daysLeft = getDaysLeft(vn.expiry_date);
                  const graceActive = isGracePeriodActive(vn.grace_period_end);

                  return (
                    <tr key={vn.id}>
                      <td>{index + 1}</td>
                      <td>
                        <span className="fw-medium">
                          {vn.virtual_number || "-"}
                        </span>
                      </td>
                      <td>
                        {vn.mst_customer ? (
                          <Link
                            to={`/view-customer/${vn.mst_customer.id}`}
                            className="text-decoration-none hover-text-primary"
                          >
                            {getCustomerDisplayName(vn.mst_customer)}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>{vn.call_forwarding_number || "-"}</td>
                      {isAdmin && (
                        <td>
                          {vn.mst_reseller ? (
                            <Link
                              to={`/view-reseller/${vn.mst_reseller.id}`}
                              className="text-decoration-none hover-text-primary"
                            >
                              {getResellerDisplayName(vn.mst_reseller)}
                            </Link>
                          ) : (
                            "-"
                          )}
                        </td>
                      )}
                      <td>{formatDate(vn.expiry_date)}</td>
                      <td>{daysLeft}</td>

                      {isAdmin && (
                        <td className="text-center">
                          {daysLeft === 0 && !graceActive ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary radius-8 d-inline-flex align-items-center gap-1"
                              onClick={() => handleGracePeriodClick(vn)}
                              title="Enable 24-hour grace period for reseller to renew"
                            >
                              <Icon
                                icon="mdi:shield-clock-outline"
                                className="icon"
                                style={{ fontSize: "1rem" }}
                              />
                              Extend
                            </button>
                          ) : daysLeft === 0 && graceActive ? (
                            <span className="badge bg-success-focus text-success-main">
                              <Icon
                                icon="mdi:check-circle-outline"
                                className="icon me-1"
                                style={{ fontSize: "0.85rem" }}
                              />
                              Grace Active
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                      )}

                      {isReseller && (
                        <td className="text-center">
                          {shouldShowRenewButton(
                            vn.expiry_date,
                            vn.grace_period_end,
                          ) ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary radius-8 d-inline-flex align-items-center gap-1"
                              onClick={() => handleRenewClick(vn)}
                              disabled={
                                renewingId === vn.id ||
                                isRenewDisabled(
                                  vn.expiry_date,
                                  vn.grace_period_end,
                                )
                              }
                              title={
                                isRenewDisabled(
                                  vn.expiry_date,
                                  vn.grace_period_end,
                                )
                                  ? "Renewal disabled — contact admin to enable grace period"
                                  : "Send renewal payment link to customer email"
                              }
                            >
                              {renewingId === vn.id ? (
                                <>
                                  <span
                                    className="spinner-border spinner-border-sm"
                                    role="status"
                                    aria-hidden="true"
                                  />
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <Icon
                                    icon="mdi:email-send-outline"
                                    className="icon"
                                    style={{ fontSize: "1rem" }}
                                  />
                                  Renew
                                </>
                              )}
                            </button>
                          ) : daysLeft === 0 ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary radius-8 d-inline-flex align-items-center gap-1"
                              disabled
                              title="Renewal disabled — contact admin to enable grace period"
                            >
                              <Icon
                                icon="mdi:email-send-outline"
                                className="icon"
                                style={{ fontSize: "1rem" }}
                              />
                              Renew
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                      )}

                      <td>
                        {vn.grace_period_end ? (
                          <span
                            className={`badge ${graceActive ? "bg-warning-focus text-warning-main" : "bg-neutral-200 text-secondary-light"}`}
                          >
                            {formatGracePeriodEnd(vn.grace_period_end)}
                            {graceActive ? " (Active)" : " (Expired)"}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {isReseller && (
          <RenewalPlanModal
            isOpen={renewalModalOpen}
            onClose={() => {
              setRenewalModalOpen(false);
              setSelectedVirtualNumberForRenewal(null);
              setRenewalError("");
            }}
            virtualNumber={selectedVirtualNumberForRenewal}
            customer={selectedVirtualNumberForRenewal?.mst_customer}
            onRenew={handleRenew}
            loading={renewingId !== null}
            apiError={renewalError}
          />
        )}

        {isAdmin && (
          <GracePeriodConfirmModal
            isOpen={gracePeriodModalOpen}
            onClose={() => {
              setGracePeriodModalOpen(false);
              setSelectedVnForGracePeriod(null);
              setGracePeriodError("");
            }}
            onConfirm={handleEnableGracePeriod}
            virtualNumber={selectedVnForGracePeriod}
            loading={gracePeriodLoading}
            apiError={gracePeriodError}
          />
        )}
      </div>
    </div>
  );
};

export default VirtualNumbersListLayer;
