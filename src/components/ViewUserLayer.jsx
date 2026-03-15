import { Icon } from "@iconify/react/dist/iconify.js";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import {
  getCustomerWithTransactions,
  suspendCustomer,
} from "@/hasura/mutations/user";
import { updateMstCustomer } from "@/hasura/mutations/customer";
import { getMaxVirtualNumbersForCustomer } from "@/hasura/mutations/numberLimits";
import { getUserData, getAuthToken } from "@/utils/auth";
import { formatDateIST, formatDateTimeIST, parseDateAsUTC } from "@/utils/dateUtils";
import { getApiBaseUrl } from "@/utils/apiUrl";
import ApproveCustomerModal from "./ApproveCustomerModal";
import AddVirtualNumberModal from "./AddVirtualNumberModal";
import RenewalPlanModal from "./RenewalPlanModal";
import AlertModal from "./AlertModal";
import { updateMstVirtualNumberCallForwarding } from "@/hasura/mutations/virtualNumber";

const RENEW_THRESHOLD_DAYS = 20;

const ViewUserLayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approveError, setApproveError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: "", message: "", type: "info" });
  const [editingVirtualNumber, setEditingVirtualNumber] = useState(null);
  const [editCallForwardNumber, setEditCallForwardNumber] = useState("");
  const [updatingCallForward, setUpdatingCallForward] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [renewingId, setRenewingId] = useState(null);
  const [renewalModalOpen, setRenewalModalOpen] = useState(false);
  const [selectedVirtualNumberForRenewal, setSelectedVirtualNumberForRenewal] = useState(null);
  const [renewalError, setRenewalError] = useState("");
  const [showAddVirtualNumberModal, setShowAddVirtualNumberModal] = useState(false);

  const isAdminUser = userRole === "admin" || userRole === "super_admin";

  useEffect(() => {
    fetchCustomer();
    
    // Get user role
    const token = getAuthToken();
    const userData = getUserData();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const role = payload.role || userData?.role;
        setUserRole(role);
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    }
  }, [id]);

  // Initialize Bootstrap tooltips for edit buttons
  useEffect(() => {
    const initTooltips = async () => {
      try {
        const { Tooltip } = await import("bootstrap");
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        const tooltipList = Array.from(tooltipTriggerList).map((tooltipTriggerEl) => {
          return new Tooltip(tooltipTriggerEl);
        });

        return () => {
          tooltipList.forEach((tooltip) => tooltip.dispose());
        };
      } catch (err) {
        console.error("Error initializing tooltips:", err);
      }
    };

    if (customer?.mst_virtual_numbers?.length > 0) {
      // Small delay to ensure DOM is updated
      const timer = setTimeout(() => {
        initTooltips();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [customer?.mst_virtual_numbers, editingVirtualNumber]);

  const fetchCustomer = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getCustomerWithTransactions(id);
      if (result.success) {
        setCustomer(result.data);
      } else {
        setError(result.message || "Failed to load customer details");
      }
    } catch (err) {
      console.error("Error fetching customer:", err);
      setError("An error occurred while loading customer details");
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!customer) return;

    if (
      !window.confirm(
        `Are you sure you want to suspend the account for ${
          customer.profile_name || customer.email
        }?`
      )
    ) {
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      const result = await suspendCustomer(customer.id);
      if (result.success) {
        setAlertModal({
          isOpen: true,
          title: "Success",
          message: "Customer account suspended successfully!",
          type: "success"
        });
        await fetchCustomer();
      } else {
        setError(result.message || "Failed to suspend customer");
      }
    } catch (err) {
      console.error("Error suspending customer:", err);
      setError(err.message || "An error occurred while suspending customer");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveClick = () => {
    setApproveModalOpen(true);
  };

  const handleApprove = async (approvalData) => {
    if (!customer) return;

    setActionLoading(true);
    setError("");
    setApproveError("");

    try {
      // Call backend API to approve customer
      const { getApiBaseUrl } = await import("@/utils/apiUrl");
      const API_BASE_URL = getApiBaseUrl();
      const response = await fetch(`${API_BASE_URL}/customer/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({
          customer_id: customer.id,
          payment_method: approvalData.payment_method,
          ...approvalData,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Refresh customer data
        await fetchCustomer();
        setApproveModalOpen(false);
        setApproveError("");
        // Refresh header wallet balance after a short delay so DB commit is visible
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("wallet-should-refresh"));
        }, 300);
        setAlertModal({
          isOpen: true,
          title: "Success",
          message: "Customer approved successfully! Virtual number generated and emails sent.",
          type: "success"
        });
      } else {
        setApproveError(result.message || "Failed to approve customer");
      }
    } catch (err) {
      console.error("Error approving customer:", err);
      setApproveError(err.message || "An error occurred while approving customer");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = formatDateIST;
  const formatDateTime = formatDateTimeIST;

  const shouldShowRenewButton = (daysLeft) => {
    return typeof daysLeft === "number" && daysLeft <= RENEW_THRESHOLD_DAYS && daysLeft >= 0;
  };

  const handleRenewClick = (vn) => {
    setSelectedVirtualNumberForRenewal(vn);
    setRenewalError("");
    setRenewalModalOpen(true);
  };

  const handleRenew = async (vn, renewalData) => {
    if (!vn?.id || !customer?.email) {
      setRenewalError("Cannot send renewal: virtual number or customer email is missing.");
      return;
    }

    if (!renewalData?.subscription_plan_id) {
      setRenewalError("Please select a subscription plan.");
      return;
    }

    setRenewingId(vn.id);
    setRenewalError("");

    try {
      const API_BASE_URL = getApiBaseUrl();
      const isOffline = renewalData.payment_method === "offline";

      const endpoint = isOffline
        ? `${API_BASE_URL}/customer/renew-virtual-number-offline`
        : `${API_BASE_URL}/customer/send-renewal-payment-email`;

      const body = isOffline
        ? {
            virtual_number_id: vn.id,
            subscription_plan_id: renewalData.subscription_plan_id,
            payment_amount: renewalData.payment_amount,
            payment_reference_number: renewalData.payment_reference_number,
            payment_date: renewalData.payment_date,
          }
        : {
            virtual_number_id: vn.id,
            subscription_plan_id: renewalData.subscription_plan_id,
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        setSuccessMessage(
          isOffline
            ? `Virtual number renewed successfully for ${customer.email}.`
            : `Renewal payment link sent to ${customer.email}.`
        );
        setTimeout(() => setSuccessMessage(""), 5000);
        setRenewalModalOpen(false);
        setSelectedVirtualNumberForRenewal(null);
        await fetchCustomer();
      } else {
        setRenewalError(result.message || "Failed to process renewal.");
      }
    } catch (err) {
      console.error("Error processing renewal:", err);
      setRenewalError(err.message || "An error occurred while processing renewal.");
    } finally {
      setRenewingId(null);
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return "₹0.00";
    return `₹${Number(amount).toFixed(2)}`;
  };

  const handleEditField = (field, currentValue) => {
    setEditingField(field);
    setEditValues({ [field]: currentValue ?? "" });
    setError("");
  };

  const handleCancelEditField = () => {
    setEditingField(null);
    setEditValues({});
  };

  const handleSaveField = async (field) => {
    if (!customer || !id) return;
    setSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const updateData = {};
      const value = editValues[field];
      if (field === "pan_dob") {
        updateData.pan_dob = value || null;
      } else if (field === "gender") {
        updateData.gender = value || null;
      } else if (field === "pan_number") {
        updateData.pan_number = value ? String(value).toUpperCase() : null;
      }
      const result = await updateMstCustomer(id, updateData);
      if (result.success) {
        setSuccessMessage(`${field === "pan_dob" ? "Date of Birth" : field === "pan_number" ? "PAN Number" : "Gender"} updated successfully`);
        setEditingField(null);
        setEditValues({});
        await fetchCustomer();
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setError(result.message || "Failed to update");
      }
    } catch (err) {
      console.error("Error updating field:", err);
      setError(err?.message || "An error occurred while updating");
    } finally {
      setSaving(false);
    }
  };

  // Edit window: 48 hours for admin/super_admin, 24 hours for reseller
  const getEditWindowHours = () => {
    const isAdmin = userRole === "admin" || userRole === "super_admin";
    return isAdmin ? 48 : 24;
  };

  // Check if virtual number can be edited (within edit window)
  // created_at from API is UTC; parse as UTC so elapsed time vs "now" is correct (fixes wrong "hours remaining" in IST)
  const canEditCallForwarding = (virtualNumber) => {
    const raw = virtualNumber.created_at || virtualNumber.purchase_date;
    if (!raw) return false;
    const createdDate = parseDateAsUTC(raw);
    if (!createdDate) return false;
    const editWindowHours = getEditWindowHours();
    const now = new Date();
    const diffHours = (now - createdDate) / (1000 * 60 * 60);
    return diffHours <= editWindowHours;
  };

  // Get tooltip message for edit button (use UTC for created_at so hours remaining is correct)
  const getEditTooltipMessage = (virtualNumber) => {
    const raw = virtualNumber.created_at || virtualNumber.purchase_date;
    const createdDate = parseDateAsUTC(raw);
    if (!createdDate) return "Edit call forwarding number";
    const editWindowHours = getEditWindowHours();
    const now = new Date();
    const diffHours = (now - createdDate) / (1000 * 60 * 60);
    if (canEditCallForwarding(virtualNumber)) {
      const hoursLeft = Math.floor(editWindowHours - diffHours);
      return `Edit call forwarding number (${hoursLeft} hours remaining)`;
    } else {
      const hoursElapsed = Math.floor(diffHours - editWindowHours);
      return `Edit disabled: ${editWindowHours}-hour edit window has passed (${hoursElapsed} hours ago)`;
    }
  };

  const handleEditCallForwarding = (virtualNumber) => {
    setEditingVirtualNumber(virtualNumber);
    setEditCallForwardNumber(virtualNumber.call_forwarding_number || "");
  };

  const handleCancelEdit = () => {
    setEditingVirtualNumber(null);
    setEditCallForwardNumber("");
  };

  const handleSaveCallForwarding = async () => {
    if (!editingVirtualNumber) return;

    if (!editCallForwardNumber.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Validation Error",
        message: "Call forwarding number is required",
        type: "error"
      });
      return;
    }

    setUpdatingCallForward(true);
    setError("");

    try {
      const result = await updateMstVirtualNumberCallForwarding({
        id: editingVirtualNumber.id,
        call_forwarding_number: editCallForwardNumber.trim(),
      });

      if (result.success) {
        setAlertModal({
          isOpen: true,
          title: "Success",
          message: "Call forwarding number updated successfully",
          type: "success"
        });
        await fetchCustomer();
        handleCancelEdit();
      } else {
        setError(result.message || "Failed to update call forwarding number");
      }
    } catch (err) {
      console.error("Error updating call forwarding number:", err);
      setError(err.message || "An error occurred while updating call forwarding number");
    } finally {
      setUpdatingCallForward(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      success: {
        class: "bg-success-focus text-success-600 border-success-main",
        text: "Success",
      },
      captured: {
        class: "bg-success-focus text-success-600 border-success-main",
        text: "Success",
      },
      authorized: {
        class: "bg-info-focus text-info-600 border-info-main",
        text: "Authorized",
      },
      failed: {
        class: "bg-danger-focus text-danger-600 border-danger-main",
        text: "Failed",
      },
      failure: {
        class: "bg-danger-focus text-danger-600 border-danger-main",
        text: "Failed",
      },
      refunded: {
        class: "bg-secondary-focus text-secondary-600 border-secondary-main",
        text: "Refunded",
      },
      pending: {
        class: "bg-warning-focus text-warning-600 border-warning-main",
        text: "Pending",
      },
    };

    const config = statusConfig[status?.toLowerCase()] || statusConfig.pending;
    return (
      <span
        className={`${config.class} border px-24 py-4 radius-4 fw-medium text-sm`}
      >
        {config.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="card h-100 p-0 radius-12">
        <div className="card-body p-24">
          <div className="text-center py-40">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="text-muted mt-3">Loading customer details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !customer) {
    return (
      <div className="card h-100 p-0 radius-12">
        <div className="card-body p-24">
          <div className="alert alert-danger radius-8" role="alert">
            <Icon icon="material-symbols:error-outline" className="icon me-2" />
            {error}
          </div>
          <button
            type="button"
            className="btn btn-secondary mt-3"
            onClick={() => navigate("/users-list")}
          >
            Back to Users List
          </button>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="card h-100 p-0 radius-12">
        <div className="card-body p-24">
          <div className="text-center py-40">
            <Icon
              icon="mdi:account-off"
              className="icon text-6xl text-muted mb-3"
            />
            <p className="text-muted">Customer not found</p>
            <button
              type="button"
              className="btn btn-secondary mt-3"
              onClick={() => navigate("/users-list")}
            >
              Back to Users List
            </button>
          </div>
        </div>
      </div>
    );
  }

  const virtualNumbers = customer.mst_virtual_numbers || [];
  const transactions = customer.mst_transactions || [];
  const failedTransactions = transactions.filter(
    (txn) => txn.status?.toLowerCase() === "failure"
  );

  return (
    <div className="card h-100 p-0 radius-12">
      <div className="card-header border-bottom bg-base py-16 px-24 d-flex align-items-center justify-content-between">
        <h5 className="text-md text-primary-light mb-0">Customer Details</h5>
        <div className="d-flex gap-2">
          {customer.status !== "suspended" && (
            <button
              type="button"
              className="btn btn-danger btn-sm d-flex align-items-center gap-1"
              onClick={handleSuspend}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm"
                    role="status"
                  ></span>
                  Suspending...
                </>
              ) : (
                <>
                  <Icon icon="mdi:account-cancel" className="icon text-xl line-height-1" />
                  Suspend Account
                </>
              )}
            </button>
          )}
          
          <button
            type="button"
            className="btn btn-secondary btn-sm d-flex align-items-center gap-1"
            onClick={() => navigate("/users-list")}
          >
            <Icon icon="mdi:arrow-left" className="icon text-xl line-height-1" />
            Back
          </button>
        </div>
      </div>
      <div className="card-body p-24">
        {successMessage && (
          <div className="alert alert-success radius-8 mb-24" role="alert">
            <Icon icon="material-symbols:check-circle-outline" className="icon me-2" />
            {successMessage}
          </div>
        )}
        {error && (
          <div className="alert alert-danger radius-8 mb-24" role="alert">
            <Icon icon="material-symbols:error-outline" className="icon me-2" />
            {error}
          </div>
        )}

        {/* Customer Information */}
        <div className="row g-3 mb-24">
          <div className="col-md-6">
            <div className="card bg-base border p-16 radius-8">
              <h6 className="text-sm text-secondary-light mb-12">
                Basic Information
              </h6>
              <div className="d-flex flex-column gap-2">
                {/* <div>
                  <span className="text-xs text-secondary-light">
                    Profile Name:
                  </span>
                  <p className="text-sm fw-medium mb-0">
                    {customer.profile_name || "N/A"}
                  </p>
                </div> */}
                <div>
                  <span className="text-xs text-secondary-light">Email:</span>
                  <p className="text-sm fw-medium mb-0">
                    {customer.email || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-secondary-light">Phone:</span>
                  <p className="text-sm fw-medium mb-0">
                    {customer.phone || "N/A"}
                  </p>
                </div>
                {/* <div>
                  <span className="text-xs text-secondary-light">
                    Business Email:
                  </span>
                  <p className="text-sm fw-medium mb-0">
                    {customer.business_email || "N/A"}
                  </p>
                </div> */}
                <div>
                  <span className="text-xs text-secondary-light">Status:</span>
                  <p className="text-sm fw-medium mb-0">
                    <span
                      className={`badge ${
                        customer.status === "active" || customer.status === "approved"
                          ? "bg-success"
                          : customer.status === "suspended"
                          ? "bg-danger"
                          : "bg-warning"
                      }`}
                    >
                      {customer.status || "N/A"}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>


          {/* KYC Details */}
          <div className="col-md-6">
            <div className="card bg-base border p-16 radius-8">
              <h6 className="text-sm text-secondary-light mb-12">
                PAN Card Details
              </h6>
              <div className="d-flex flex-column gap-2">
                <div>
                  <span className="text-xs text-secondary-light d-flex align-items-center gap-2">
                    PAN Number:
                    {isAdminUser && (
                      <Icon
                        icon="lucide:edit"
                        className="icon text-xs cursor-pointer"
                        onClick={() => handleEditField("pan_number", customer.pan_number)}
                        style={{ cursor: editingField ? "not-allowed" : "pointer" }}
                        title="Edit PAN Number"
                      />
                    )}
                  </span>
                  {editingField === "pan_number" ? (
                    <div className="d-flex align-items-center gap-2 mt-2">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={editValues.pan_number ?? ""}
                        onChange={(e) => setEditValues({ pan_number: e.target.value.toUpperCase() })}
                        disabled={saving}
                        maxLength={10}
                        placeholder="Enter PAN number"
                      />
                      <button type="button" className="btn btn-sm btn-success" onClick={() => handleSaveField("pan_number")} disabled={saving}>
                        {saving ? "..." : "Save"}
                      </button>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={handleCancelEditField} disabled={saving}>Cancel</button>
                    </div>
                  ) : (
                    <p className="text-sm fw-medium mb-0">
                      {isAdminUser ? (customer.pan_number || "N/A") : customer.pan_number ? "****" + customer.pan_number.slice(-4) : "N/A"}
                    </p>
                  )}
                </div>
                <div>
                  <span className="text-xs text-secondary-light">
                    Full Name:
                  </span>
                  <p className="text-sm fw-medium mb-0">
                    {customer.pan_full_name || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-secondary-light d-flex align-items-center gap-2">
                    Date of Birth:
                    {isAdminUser && (
                      <Icon
                        icon="lucide:edit"
                        className="icon text-xs cursor-pointer"
                        onClick={() => handleEditField("pan_dob", customer.pan_dob)}
                        style={{ cursor: editingField ? "not-allowed" : "pointer" }}
                        title="Edit Date of Birth"
                      />
                    )}
                  </span>
                  {editingField === "pan_dob" ? (
                    <div className="d-flex align-items-center gap-2 mt-2">
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={editValues.pan_dob ?? ""}
                        onChange={(e) => setEditValues({ pan_dob: e.target.value })}
                        disabled={saving}
                      />
                      <button type="button" className="btn btn-sm btn-success" onClick={() => handleSaveField("pan_dob")} disabled={saving}>
                        {saving ? "..." : "Save"}
                      </button>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={handleCancelEditField} disabled={saving}>Cancel</button>
                    </div>
                  ) : (
                    <p className="text-sm fw-medium mb-0">
                      {formatDate(customer.pan_dob) || "N/A"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <div className="card bg-base border p-16 radius-8">
              <h6 className="text-sm text-secondary-light mb-12">
                Aadhaar & GST Details
              </h6>
              <div className="d-flex flex-column gap-2">
                <div>
                  <span className="text-xs text-secondary-light">
                    Aadhaar Name:
                  </span>
                  <p className="text-sm fw-medium mb-0">
                    {customer.pan_full_name || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-secondary-light">
                    Aadhaar Number:
                  </span>
                  <p className="text-sm fw-medium mb-0">
                    {isAdminUser ? (customer.aadhaar_number || "N/A") : customer.aadhaar_number ? "****" + customer.aadhaar_number.slice(-4) : "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-secondary-light">
                    Aadhaar DOB:
                  </span>
                  <p className="text-sm fw-medium mb-0">
                    {formatDate(customer.aadhaar_dob) || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-secondary-light d-flex align-items-center gap-2">
                    Gender:
                    {isAdminUser && (
                      <Icon
                        icon="lucide:edit"
                        className="icon text-xs cursor-pointer"
                        onClick={() => handleEditField("gender", customer.gender)}
                        style={{ cursor: editingField ? "not-allowed" : "pointer" }}
                        title="Edit Gender"
                      />
                    )}
                  </span>
                  {editingField === "gender" ? (
                    <div className="d-flex align-items-center gap-2 mt-2">
                      <select
                        className="form-control form-control-sm"
                        value={editValues.gender ?? ""}
                        onChange={(e) => setEditValues({ gender: e.target.value })}
                        disabled={saving}
                      >
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                      <button type="button" className="btn btn-sm btn-success" onClick={() => handleSaveField("gender")} disabled={saving}>
                        {saving ? "..." : "Save"}
                      </button>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={handleCancelEditField} disabled={saving}>Cancel</button>
                    </div>
                  ) : (
                    <p className="text-sm fw-medium mb-0">
                      {customer.gender || "N/A"}
                    </p>
                  )}
                </div>
                <div>
                  <span className="text-xs text-secondary-light">GST Status:</span>
                  <p className="text-sm fw-medium mb-0">
                    {customer.gstin_status ? (
                      <span className={`badge ${customer.gstin_status === "Active" ? "bg-success" : "bg-warning"}`}>
                        {customer.gstin_status}
                      </span>
                    ) : (
                      "N/A"
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-secondary-light">GSTIN:</span>
                  <p className="text-sm fw-medium mb-0">
                    {customer.gstin || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-secondary-light">
                    Business Name:
                  </span>
                  <p className="text-sm fw-medium mb-0">
                    {customer.business_name || "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-12">
            <div className="card bg-base border p-16 radius-8">
              <h6 className="text-sm text-secondary-light mb-12">
                Additional Information
              </h6>
              <div className="d-flex flex-column gap-2">
                <div>
                  <span className="text-xs text-secondary-light">
                    Max Virtual Numbers:
                  </span>
                  <p className="text-sm fw-medium mb-0">
                    {getMaxVirtualNumbersForCustomer(customer) ?? "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-secondary-light">
                    Created At:
                  </span>
                  <p className="text-sm fw-medium mb-0">
                    {formatDate(customer.created_at) || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-secondary-light">
                    Updated At:
                  </span>
                  <p className="text-sm fw-medium mb-0">
                    {formatDate(customer.updated_at) || "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Virtual Numbers List */}
        <div className="mb-24">
          <div className="d-flex justify-content-between align-items-center mb-16">
            <h6 className="text-sm text-secondary-light mb-0">
              Virtual Numbers List
              <span className="text-primary-600 fw-medium ms-2">
                ({virtualNumbers.length} / {getMaxVirtualNumbersForCustomer(customer) ?? "-"})
              </span>
            </h6>
          
            {(getMaxVirtualNumbersForCustomer(customer) != null && getMaxVirtualNumbersForCustomer(customer) > (customer?.mst_virtual_numbers?.length ?? 0)) && (
              <button
                type="button"
                className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                onClick={() => setShowAddVirtualNumberModal(true)}
              >
                <Icon icon="ic:baseline-plus" className="icon text-xl line-height-1" />
                Add Virtual Number
              </button>
            )}
          </div>
          
          {virtualNumbers.length > 0 ? (
            <div className="table-responsive scroll-sm">
              <table className="table bordered-table sm-table mb-0">
                <thead>
                  <tr>
                    <th scope="col">S.L</th>
                    <th scope="col">Virtual Number</th>
                    <th scope="col">Call Forward Number</th>
                    <th scope="col">Purchase Date</th>
                    <th scope="col">Expiry Date</th>
                    <th scope="col">Days Left</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {virtualNumbers.map((vn, index) => {
                    const calculateDaysLeft = (expiryDate) => {
                      if (!expiryDate) return "-";
                      const expiry = new Date(expiryDate);
                      const today = new Date();
                      const diffTime = expiry - today;
                      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      return daysLeft > 0 ? daysLeft : 0;
                    };

                    const daysLeft = vn.days_left !== null && vn.days_left !== undefined 
                      ? vn.days_left 
                      : calculateDaysLeft(vn.expiry_date);

                    return (
                      <tr key={vn.id}>
                        <td>{index + 1}</td>
                        <td>
                          <span className="text-sm fw-medium text-primary-600">
                            {vn.virtual_number || "-"}
                          </span>
                        </td>
                        <td>
                          {editingVirtualNumber?.id === vn.id ? (
                            <div className="d-flex gap-2 align-items-center">
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={editCallForwardNumber}
                                onChange={(e) => setEditCallForwardNumber(e.target.value)}
                                placeholder="Enter call forwarding number"
                                style={{ maxWidth: "200px" }}
                              />
                              <button
                                type="button"
                                className="btn btn-sm btn-success"
                                onClick={handleSaveCallForwarding}
                                disabled={updatingCallForward}
                              >
                                {updatingCallForward ? (
                                  <span className="spinner-border spinner-border-sm" role="status"></span>
                                ) : (
                                  <Icon icon="material-symbols:check" className="icon" />
                                )}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={handleCancelEdit}
                                disabled={updatingCallForward}
                              >
                                <Icon icon="material-symbols:close" className="icon" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm">
                              {vn.call_forwarding_number || "-"}
                            </span>
                          )}
                        </td>
                        <td>{formatDate(vn.purchase_date) || "-"}</td>
                        <td>
                          <span className={vn.expiry_date && new Date(vn.expiry_date) < new Date() ? "text-danger-600" : ""}>
                            {formatDate(vn.expiry_date) || "-"}
                          </span>
                        </td>
                        <td>
                          <span className={daysLeft !== "-" && daysLeft <= 30 && daysLeft > 0 ? "text-warning-600 fw-medium" : daysLeft === 0 || (typeof daysLeft === "number" && daysLeft < 0) ? "text-danger-600 fw-medium" : ""}>
                            {daysLeft !== "-" ? `${daysLeft} days` : "-"}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              vn.status === "active"
                                ? "bg-success"
                                : vn.status === "expired"
                                ? "bg-danger"
                                : vn.status === "suspended"
                                ? "bg-secondary"
                                : "bg-warning"
                            }`}
                          >
                            {vn.status || "N/A"}
                          </span>
                        </td>
                        <td className="text-center">
                          <div className="d-flex gap-1 justify-content-center align-items-center flex-wrap">
                            {shouldShowRenewButton(daysLeft) && (
                              <button
                                type="button"
                                className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"
                                onClick={() => handleRenewClick(vn)}
                                disabled={renewingId === vn.id}
                                title="Send renewal payment link to customer email"
                              >
                                {renewingId === vn.id ? (
                                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                                ) : (
                                  <>
                                    <Icon icon="mdi:email-send-outline" className="icon" style={{ fontSize: "1rem" }} />
                                    Renew
                                  </>
                                )}
                              </button>
                            )}
                            {editingVirtualNumber?.id === vn.id ? null : (
                              <span
                                data-bs-toggle="tooltip"
                                data-bs-placement="top"
                                data-bs-title={getEditTooltipMessage(vn)}
                                style={{ cursor: canEditCallForwarding(vn) ? 'pointer' : 'not-allowed' }}
                              >
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => handleEditCallForwarding(vn)}
                                  disabled={!canEditCallForwarding(vn)}
                                  style={{ pointerEvents: canEditCallForwarding(vn) ? 'auto' : 'none' }}
                                >
                                  <Icon icon="material-symbols:edit" className="icon" />
                                </button>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-20">
              <Icon icon="mdi:phone-off" className="icon text-4xl text-muted mb-3" />
              <p className="text-muted mb-0">No virtual numbers found</p>
            </div>
          )}
        </div>

        {/* Renewal Plan Modal */}
        <RenewalPlanModal
          isOpen={renewalModalOpen}
          onClose={() => {
            setRenewalModalOpen(false);
            setSelectedVirtualNumberForRenewal(null);
            setRenewalError("");
          }}
          virtualNumber={selectedVirtualNumberForRenewal}
          customer={customer}
          onRenew={handleRenew}
          loading={renewingId !== null}
          apiError={renewalError}
        />

        {/* Add Virtual Number Modal */}
        <AddVirtualNumberModal
          isOpen={showAddVirtualNumberModal}
          onClose={() => setShowAddVirtualNumberModal(false)}
          customer={customer}
          onSuccess={() => {
            fetchCustomer();
          }}
        />

        {/* Approve Customer Modal */}
        <ApproveCustomerModal
          isOpen={approveModalOpen}
          onClose={() => {
            setApproveModalOpen(false);
            setApproveError("");
          }}
          customer={customer}
          onApprove={handleApprove}
          loading={actionLoading}
          title="Add Virtual Number"
          apiError={approveError}
        />

        {/* Alert Modal */}
        <AlertModal
          isOpen={alertModal.isOpen}
          onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
          title={alertModal.title}
          message={alertModal.message}
          type={alertModal.type}
        />

        {/* Transactions Section */}
        <div className="mb-24">
          <div className="d-flex justify-content-between align-items-center mb-16">
            <h6 className="text-sm text-secondary-light mb-0">Transactions</h6>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
              onClick={() => setShowTransactions(!showTransactions)}
            >
              <Icon
                icon={showTransactions ? "mdi:chevron-up" : "mdi:chevron-down"}
                className="icon text-xl line-height-1"
              />
              {showTransactions ? "Hide" : "Show"} Transactions
            </button>
          </div>

          {showTransactions && (
            <div className="table-responsive scroll-sm">
              <table className="table bordered-table sm-table mb-0">
                <thead>
                  <tr>
                    <th scope="col">S.L</th>
                    <th scope="col">Transaction #</th>
                    <th scope="col">Date</th>
                    <th scope="col">Type</th>
                    <th scope="col">Payment Mode</th>
                    <th scope="col">Payment Method</th>
                    <th scope="col">Reference Number</th>
                    <th scope="col" className="text-end">
                      Amount
                    </th>
                    <th scope="col" className="text-center">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-20">
                        <p className="text-muted mb-0">No transactions found</p>
                      </td>
                    </tr>
                  ) : (
                    transactions.map((txn, index) => (
                      <tr key={txn.id}>
                        <td>{index + 1}</td>
                        <td>
                          <span className="text-sm fw-medium text-primary-600">
                            {txn.transaction_number || "-"}
                          </span>
                        </td>
                        <td>
                          {formatDate(txn.payment_date || txn.created_at)}
                        </td>
                        <td>
                          <span className="text-sm">
                            {txn.transaction_type || "-"}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm">
                            {txn.payment_mode || "-"}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm">
                            {txn.payment_method || "-"}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm">
                            {txn.reference_number || "-"}
                          </span>
                        </td>
                        <td className="text-end">
                          <span className="text-sm fw-medium text-success-600">
                            {formatCurrency(txn.amount)}
                          </span>
                        </td>
                        <td className="text-center">
                          {getStatusBadge(txn.status)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Failed Transactions Section */}
          {failedTransactions.length > 0 && (
            <div className="mt-24">
              <h6 className="text-sm text-danger-600 mb-16">
                Failed Transactions
              </h6>
              <div className="table-responsive scroll-sm">
                <table className="table bordered-table sm-table mb-0">
                  <thead>
                    <tr>
                      <th scope="col">S.L</th>
                      <th scope="col">Transaction #</th>
                      <th scope="col">Date</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Failure Reason</th>
                      <th scope="col" className="text-center">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedTransactions.map((txn, index) => (
                      <tr key={txn.id}>
                        <td>{index + 1}</td>
                        <td>
                          <span className="text-sm fw-medium text-primary-600">
                            {txn.transaction_number || "-"}
                          </span>
                        </td>
                        <td>
                          {formatDate(txn.payment_date || txn.created_at)}
                        </td>
                        <td className="text-end">
                          <span className="text-sm fw-medium">
                            {formatCurrency(txn.amount)}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm text-danger-600">
                            {txn.failure_reason || "N/A"}
                          </span>
                        </td>
                        <td className="text-center">
                          {getStatusBadge(txn.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewUserLayer;
