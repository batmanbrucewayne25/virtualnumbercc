import { Icon } from "@iconify/react/dist/iconify.js";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  getMstCustomerById,
  updateMstCustomer,
} from "@/hasura/mutations/customer";
import ApproveCustomerModal from "./ApproveCustomerModal";
import RejectCustomerModal from "./RejectCustomerModal";
import { getUserData, getAuthToken } from "@/utils/auth";
import AddVirtualNumberModal from "./AddVirtualNumberModal";
import AlertModal from "./AlertModal";

// Helper function to format address object into readable string
const formatAddress = (address) => {
  if (!address) return "N/A";

  // If it's already a string, return as is
  if (typeof address === "string") {
    try {
      // Try to parse if it's a JSON string
      const parsed = JSON.parse(address);
      if (typeof parsed === "object") {
        return formatAddressObject(parsed);
      }
      return address;
    } catch {
      return address;
    }
  }

  // If it's an object, format it
  if (typeof address === "object") {
    return formatAddressObject(address);
  }

  return "N/A";
};

const formatAddressObject = (addr) => {
  const parts = [];

  // House number and street
  if (addr.house) parts.push(addr.house);
  if (addr.street) parts.push(addr.street);

  // Landmark
  if (addr.landmark) parts.push(addr.landmark);

  // Location/Village/Town/City
  if (addr.loc) parts.push(addr.loc);
  if (addr.vtc) parts.push(addr.vtc);

  // Sub-district and District
  if (addr.subdist) parts.push(addr.subdist);
  if (addr.dist) parts.push(addr.dist);

  // State and Post Office
  if (addr.state) parts.push(addr.state);
  if (addr.po) parts.push(`PIN: ${addr.po}`);

  // Country
  if (addr.country) parts.push(addr.country);

  return parts.length > 0 ? parts.join(", ") : "N/A";
};

const ViewCustomerLayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAddVirtualNumberModal, setShowAddVirtualNumberModal] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: "", message: "", type: "info" });
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

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
        if (role === "admin" || role === "super_admin") {
          setIsAdmin(true);
        }
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    }
  }, [id]);

  const fetchCustomer = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getMstCustomerById(id);
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

  const handleApproveClick = () => {
    setApproveModalOpen(true);
  };

  const handleRejectClick = () => {
    setRejectModalOpen(true);
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
        setAlertModal({
          isOpen: true,
          title: "Success",
          message: "Customer approved successfully! Virtual number generated and emails sent.",
          type: "success"
        });
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

  const handleReject = async (rejectionReason) => {
    if (!customer) return;

    setActionLoading(true);
    setError("");

    try {
      const { getApiBaseUrl } = await import("@/utils/apiUrl");
      const API_BASE_URL = getApiBaseUrl();
      const response = await fetch(`${API_BASE_URL}/customer/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          customer_id: customer.id,
          rejection_reason: rejectionReason || "No reason provided.",
        }),
      });

      const result = await response.json();

      if (result.success) {
        await fetchCustomer();
        setRejectModalOpen(false);
        const message = result.data?.emailWarning
          ? `Customer rejected successfully. ${result.data.emailWarning}`
          : "Customer rejected successfully! Rejection email sent to customer.";
        setAlertModal({
          isOpen: true,
          title: "Success",
          message,
          type: "success"
        });
      } else {
        setError(result.message || "Failed to reject customer");
      }
    } catch (err) {
      console.error("Error rejecting customer:", err);
      setError(err.message || "An error occurred while rejecting customer");
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

  const handleEditField = (field, currentValue) => {
    setEditingField(field);
    setEditValues({ [field]: currentValue || "" });
    setSuccessMessage("");
    setError("");
  };

  const handleCancelEdit = () => {
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
        updateData.pan_number = value || null;
      }

      const result = await updateMstCustomer(id, updateData);

      if (result.success) {
        setSuccessMessage(`${field === "pan_dob" ? "Date of Birth" : field === "pan_number" ? "PAN Number" : "Gender"} updated successfully!`);
        setEditingField(null);
        setEditValues({});
        
        // Refresh customer data
        await fetchCustomer();
        
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setError(result.message || "Failed to update field");
      }
    } catch (err) {
      console.error("Error updating field:", err);
      setError(err.message || "An error occurred while updating");
    } finally {
      setSaving(false);
    }
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
            onClick={() => navigate("/customer-list")}
          >
            Back to Customer List
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
              onClick={() => navigate("/customer-list")}
            >
              Back to Customer List
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card h-100 p-0 radius-12">
      <div className="card-header border-bottom bg-base py-16 px-24 d-flex align-items-center justify-content-between">
        <h5 className="text-md text-primary-light mb-0">
          Customer KYC Details
        </h5>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => navigate("/customer-list")}
        >
          <Icon icon="mdi:arrow-left" className="icon me-2" />
          Back
        </button>
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

        
{customer.rejection_reason && (
            <div className="col-md-12">
              <div className="alert alert-danger radius-8">
                <h6 className="text-sm mb-8">Rejection Reason:</h6>
                <p className="text-sm mb-0">{customer.rejection_reason}</p>
              </div>
            </div>
          )}

        {/* Action Buttons - Only show if status is pending */}
        
        {customer.approval !== "approved"   && (
          <div className="d-flex gap-3 mb-24">
            <button
              type="button"
              className="btn btn-success"
              onClick={handleApproveClick}
              disabled={actionLoading}
            >
              <Icon
                icon="material-symbols:check-circle-outline"
                className="icon me-2"
              />
              Approve
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleRejectClick}
              disabled={actionLoading}
            >
              <Icon
                icon="material-symbols:cancel-outline"
                className="icon me-2"
              />
              Reject
            </button>
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
                          : customer.status === "pending_payment"
                          ? "bg-info"
                          : customer.status === "rejected"
                          ? "bg-danger"
                          : customer.status === "suspended"
                          ? "bg-secondary"
                          : "bg-warning"
                      }`}
                    >
                      {customer.status === "pending_payment"
                        ? "Pending Payment"
                        : customer.status || "N/A"}
                    </span>
                  </p>
                </div>
                {/* <div>
                  <span className="text-xs text-secondary-light">
                    KYC Status:
                  </span>
                  <p className="text-sm fw-medium mb-0">
                    <span
                      className={`badge ${
                        customer.kyc_status === "verified"
                          ? "bg-success"
                          : customer.kyc_status === "rejected"
                          ? "bg-danger"
                          : "bg-warning"
                      }`}
                    >
                      {customer.kyc_status || "N/A"}
                    </span>
                  </p>
                </div> */}
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <div className="card bg-base border p-16 radius-8">
              <h6 className="text-sm text-secondary-light mb-12">
                PAN Card Details
              </h6>
              <div className="d-flex flex-column gap-2">
                <div>
                  <span className="text-xs text-secondary-light d-flex align-items-center gap-2">
                    PAN Number:
                    {isAdmin && (
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
                        value={editValues.pan_number || ""}
                        onChange={(e) => setEditValues({ pan_number: e.target.value.toUpperCase() })}
                        disabled={saving}
                        maxLength={10}
                        placeholder="Enter PAN number"
                      />
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleSaveField("pan_number")}
                        disabled={saving}
                      >
                        {saving ? "..." : "Save"}
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={handleCancelEdit}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm fw-medium mb-0">
                      {isAdmin
                        ? (customer.pan_number || "N/A")
                        : customer.pan_number
                          ? "****" + customer.pan_number.slice(-4)
                          : "N/A"}
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
                    {isAdmin && (
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
                        value={editValues.pan_dob || ""}
                        onChange={(e) => setEditValues({ pan_dob: e.target.value })}
                        disabled={saving}
                      />
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleSaveField("pan_dob")}
                        disabled={saving}
                      >
                        {saving ? "..." : "Save"}
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={handleCancelEdit}
                        disabled={saving}
                      >
                        Cancel
                      </button>
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
                Aadhaar Card Details
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
                    {isAdmin
                      ? (customer.aadhaar_number || "N/A")
                      : customer.aadhaar_number
                        ? "****" + customer.aadhaar_number.slice(-4)
                        : "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-secondary-light">
                    Date of Birth:
                  </span>
                  <p className="text-sm fw-medium mb-0">
                    {formatDate(customer.aadhaar_dob) || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-secondary-light d-flex align-items-center gap-2">
                    Gender:
                    {isAdmin && (
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
                        value={editValues.gender || ""}
                        onChange={(e) => setEditValues({ gender: e.target.value })}
                        disabled={saving}
                      >
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleSaveField("gender")}
                        disabled={saving}
                      >
                        {saving ? "..." : "Save"}
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={handleCancelEdit}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm fw-medium mb-0">
                      {customer.gender || "N/A"}
                    </p>
                  )}
                </div>
                {/* <div>
                  <span className="text-xs text-secondary-light">
                    DOB Match Verified:
                  </span>
                  <p className="text-sm fw-medium mb-0">
                    {customer.dob_match_verified ? (
                      <span className="badge bg-success">Verified</span>
                    ) : (
                      <span className="badge bg-warning">Not Verified</span>
                    )}
                  </p>
                </div> */}
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <div className="card bg-base border p-16 radius-8">
              <h6 className="text-sm text-secondary-light mb-12">
                GST Details
              </h6>
              <div className="d-flex flex-column gap-2">
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


          {(customer.signatureImage || customer.signature_hash) && (
            <div className="col-md-6">
              <div className="card bg-base border p-16 radius-8">
                <h6 className="text-sm text-secondary-light mb-12">
                  Digital Signature
                </h6>
                <div className="d-flex flex-column gap-2">
                  {customer.signatureImage ? (
                    <div>
                      {(() => {
                        const raw = customer.signatureImage;
                        const isFullUrl = raw && (raw.startsWith('data:') || raw.startsWith('http') || raw.startsWith('/'));
                        const IMAGE_UPLOAD_PATH = import.meta.env?.VITE_IMAGE_UPLOAD_PATH || 'http://localhost:3001/uploads';
                        const signatureSrc = isFullUrl ? raw : `${IMAGE_UPLOAD_PATH}/signatures/${raw}`;
                        return (
                          <img 
                            src={signatureSrc} 
                            alt="Digital Signature" 
                            className="rounded border"
                            style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', cursor: 'pointer', display: 'block', backgroundColor: '#fff' }}
                            onError={(e) => {
                              console.error('Error loading signature image:', e);
                              e.target.style.display = 'none';
                              const errorDiv = document.createElement('div');
                              errorDiv.className = 'alert alert-warning';
                              errorDiv.textContent = 'Failed to load signature image';
                              e.target.parentNode?.appendChild(errorDiv);
                            }}
                            onClick={() => {
                              const newWindow = window.open();
                              if (newWindow) {
                                newWindow.document.write(`<img src="${signatureSrc}" style="max-width: 100%; height: auto; background: white;" />`);
                              }
                            }}
                            title="Click to view full size"
                          />
                        );
                      })()}
                    </div>
                  ) : customer.signature_hash ? (
                    <div>
                      <span className="text-xs text-secondary-light">Signature Hash:</span>
                      <p className="text-sm fw-medium mb-0">
                        {customer.signature_hash?.substring(0, 32) ?? ''}...
                      </p>
                      <small className="text-secondary-light">Signature stored as hash (image not available)</small>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

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
                    {customer.max_virtual_numbers || "N/A"}
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
                ({(customer.mst_virtual_numbers?.length || 0)} / {customer.max_virtual_numbers ?? "-"})
              </span>
            </h6>
            {(customer?.max_virtual_numbers > customer?.mst_virtual_numbers?.length) && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddVirtualNumberModal(true)}
              >
                <Icon icon="ic:baseline-plus" className="icon me-2" />
                Add Virtual Number
              </button>
            )}
          </div>
          
          {customer.mst_virtual_numbers && customer.mst_virtual_numbers.length > 0 ? (
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
                    {/* <th scope="col" className="text-center">Auto Renew</th> */}
                  </tr>
                </thead>
                <tbody>
                  {customer.mst_virtual_numbers.map((vn, index) => {
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
                        {/* <td className="text-center">
                          {vn.is_auto_renew ? (
                            <span className="badge bg-success">Enabled</span>
                          ) : (
                            <span className="badge bg-secondary">Disabled</span>
                          )}
                        </td> */}
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

        {/* Add Virtual Number Modal */}
        <AddVirtualNumberModal
          isOpen={showAddVirtualNumberModal}
          onClose={() => setShowAddVirtualNumberModal(false)}
          customer={customer}
          onSuccess={() => {
            fetchCustomer();
          }}
        />
      </div>

      {/* Approve Modal */}
      <ApproveCustomerModal
        isOpen={approveModalOpen}
        onClose={() => {
          setApproveModalOpen(false);
        }}
        customer={customer}
        onApprove={handleApprove}
        loading={actionLoading}
      />

      {/* Reject Modal */}
      <RejectCustomerModal
        isOpen={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
        }}
        customer={customer}
        onReject={handleReject}
        loading={actionLoading}
      />

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
};

export default ViewCustomerLayer;
