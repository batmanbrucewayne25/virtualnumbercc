import { Icon } from "@iconify/react/dist/iconify.js";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  getCustomerWithTransactions,
  suspendCustomer,
} from "@/hasura/mutations/user";
import { getUserData, getAuthToken } from "@/utils/auth";
import ApproveCustomerModal from "./ApproveCustomerModal";

const ViewUserLayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);

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
        alert("Customer account suspended successfully!");
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
        alert(
          "Customer approved successfully! Virtual number generated and emails sent."
        );
      } else {
        setError(result.message || "Failed to approve customer");
      }
    } catch (err) {
      console.error("Error approving customer:", err);
      setError(err.message || "An error occurred while approving customer");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return "₹0.00";
    return `₹${Number(amount).toFixed(2)}`;
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
              className="btn btn-danger btn-sm"
              onClick={handleSuspend}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                  ></span>
                  Suspending...
                </>
              ) : (
                <>
                  <Icon icon="mdi:account-cancel" className="icon me-2" />
                  Suspend Account
                </>
              )}
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigate("/users-list")}
          >
            <Icon icon="mdi:arrow-left" className="icon me-2" />
            Back
          </button>
        </div>
      </div>
      <div className="card-body p-24">
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
                <div>
                  <span className="text-xs text-secondary-light">
                    Profile Name:
                  </span>
                  <p className="text-sm fw-medium mb-0">
                    {customer.profile_name || "N/A"}
                  </p>
                </div>
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
                <div>
                  <span className="text-xs text-secondary-light">
                    Business Email:
                  </span>
                  <p className="text-sm fw-medium mb-0">
                    {customer.business_email || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-secondary-light">Status:</span>
                  <p className="text-sm fw-medium mb-0">
                    <span
                      className={`badge ${
                        customer.status === "approved"
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
                  <span className="text-xs text-secondary-light">
                    PAN Number:
                  </span>
                  <p className="text-sm fw-medium mb-0">
                    {customer.pan_number || "N/A"}
                  </p>
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
                  <span className="text-xs text-secondary-light">
                    Date of Birth:
                  </span>
                  <p className="text-sm fw-medium mb-0">
                    {formatDate(customer.pan_dob) || "N/A"}
                  </p>
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
                    Aadhaar Number:
                  </span>
                  <p className="text-sm fw-medium mb-0">
                    {customer.aadhaar_number
                      ? "****" + customer.aadhaar_number.slice(-4)
                      : "N/A"}
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
        </div>

        {/* Virtual Numbers List */}
        <div className="mb-24">
          <div className="d-flex justify-content-between align-items-center mb-16">
            <h6 className="text-sm text-secondary-light mb-0">
              Virtual Numbers List
            </h6>
            {(userRole === 'admin' || userRole === 'super_admin' || userRole === 'reseller') && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleApproveClick}
                disabled={actionLoading}
              >
                <Icon icon="ic:baseline-plus" className="icon me-2" />
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
                    <th scope="col" className="text-center">Auto Renew</th>
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
                          <span className="text-sm">
                            {vn.call_forwarding_number || "-"}
                          </span>
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
                          {vn.is_auto_renew ? (
                            <span className="badge bg-success">Enabled</span>
                          ) : (
                            <span className="badge bg-secondary">Disabled</span>
                          )}
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

        {/* Approve Customer Modal (for adding virtual number) */}
        <ApproveCustomerModal
          isOpen={approveModalOpen}
          onClose={() => {
            setApproveModalOpen(false);
          }}
          customer={customer}
          onApprove={handleApprove}
          loading={actionLoading}
          title="Add Virtual Number"
        />

        {/* Transactions Section */}
        <div className="mb-24">
          <div className="d-flex justify-content-between align-items-center mb-16">
            <h6 className="text-sm text-secondary-light mb-0">Transactions</h6>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => setShowTransactions(!showTransactions)}
            >
              <Icon
                icon={showTransactions ? "mdi:chevron-up" : "mdi:chevron-down"}
                className="icon me-2"
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
