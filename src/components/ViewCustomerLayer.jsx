import { Icon } from "@iconify/react/dist/iconify.js";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getMstCustomerById, updateMstCustomerStatus } from "@/hasura/mutations/customer";
import ApproveCustomerModal from "./ApproveCustomerModal";
import RejectCustomerModal from "./RejectCustomerModal";

const ViewCustomerLayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchCustomer();
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
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'}/customer/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
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
        alert("Customer approved successfully! Virtual number generated and emails sent.");
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
      const result = await updateMstCustomerStatus(
        customer.id,
        "rejected",
        "rejected",
        rejectionReason
      );

      if (result.success) {
        await fetchCustomer();
        setRejectModalOpen(false);
        alert("Customer rejected successfully!");
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

  if (loading) {
    return (
      <div className='card h-100 p-0 radius-12'>
        <div className='card-body p-24'>
          <div className='text-center py-40'>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className='text-muted mt-3'>Loading customer details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !customer) {
    return (
      <div className='card h-100 p-0 radius-12'>
        <div className='card-body p-24'>
          <div className='alert alert-danger radius-8' role='alert'>
            <Icon icon='material-symbols:error-outline' className='icon me-2' />
            {error}
          </div>
          <button
            type='button'
            className='btn btn-secondary mt-3'
            onClick={() => navigate('/customer-list')}
          >
            Back to Customer List
          </button>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className='card h-100 p-0 radius-12'>
        <div className='card-body p-24'>
          <div className='text-center py-40'>
            <Icon icon='mdi:account-off' className='icon text-6xl text-muted mb-3' />
            <p className='text-muted'>Customer not found</p>
            <button
              type='button'
              className='btn btn-secondary mt-3'
              onClick={() => navigate('/customer-list')}
            >
              Back to Customer List
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='card h-100 p-0 radius-12'>
      <div className='card-header border-bottom bg-base py-16 px-24 d-flex align-items-center justify-content-between'>
        <h5 className='text-md text-primary-light mb-0'>Customer KYC Details</h5>
        <button
          type='button'
          className='btn btn-secondary btn-sm'
          onClick={() => navigate('/customer-list')}
        >
          <Icon icon='mdi:arrow-left' className='icon me-2' />
          Back
        </button>
      </div>
      <div className='card-body p-24'>
        {error && (
          <div className='alert alert-danger radius-8 mb-24' role='alert'>
            <Icon icon='material-symbols:error-outline' className='icon me-2' />
            {error}
          </div>
        )}

        {/* Action Buttons - Only show if status is pending */}
        {customer.status === "pending" && customer.kyc_status === "pending" && (
          <div className='d-flex gap-3 mb-24'>
            <button
              type='button'
              className='btn btn-success'
              onClick={handleApproveClick}
              disabled={actionLoading}
            >
              <Icon icon='material-symbols:check-circle-outline' className='icon me-2' />
              Approve
            </button>
            <button
              type='button'
              className='btn btn-danger'
              onClick={handleRejectClick}
              disabled={actionLoading}
            >
              <Icon icon='material-symbols:cancel-outline' className='icon me-2' />
              Reject
            </button>
          </div>
        )}

        {/* Customer Information */}
        <div className='row g-3 mb-24'>
          <div className='col-md-6'>
            <div className='card bg-base border p-16 radius-8'>
              <h6 className='text-sm text-secondary-light mb-12'>Basic Information</h6>
              <div className='d-flex flex-column gap-2'>
                <div>
                  <span className='text-xs text-secondary-light'>Profile Name:</span>
                  <p className='text-sm fw-medium mb-0'>{customer.profile_name || "N/A"}</p>
                </div>
                <div>
                  <span className='text-xs text-secondary-light'>Email:</span>
                  <p className='text-sm fw-medium mb-0'>{customer.email || "N/A"}</p>
                </div>
                <div>
                  <span className='text-xs text-secondary-light'>Phone:</span>
                  <p className='text-sm fw-medium mb-0'>{customer.phone || "N/A"}</p>
                </div>
                <div>
                  <span className='text-xs text-secondary-light'>Business Email:</span>
                  <p className='text-sm fw-medium mb-0'>{customer.business_email || "N/A"}</p>
                </div>
                <div>
                  <span className='text-xs text-secondary-light'>Status:</span>
                  <p className='text-sm fw-medium mb-0'>
                    <span className={`badge ${
                      customer.status === "approved" ? "bg-success" :
                      customer.status === "rejected" ? "bg-danger" : "bg-warning"
                    }`}>
                      {customer.status || "N/A"}
                    </span>
                  </p>
                </div>
                <div>
                  <span className='text-xs text-secondary-light'>KYC Status:</span>
                  <p className='text-sm fw-medium mb-0'>
                    <span className={`badge ${
                      customer.kyc_status === "verified" ? "bg-success" :
                      customer.kyc_status === "rejected" ? "bg-danger" : "bg-warning"
                    }`}>
                      {customer.kyc_status || "N/A"}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className='col-md-6'>
            <div className='card bg-base border p-16 radius-8'>
              <h6 className='text-sm text-secondary-light mb-12'>PAN Card Details</h6>
              <div className='d-flex flex-column gap-2'>
                <div>
                  <span className='text-xs text-secondary-light'>PAN Number:</span>
                  <p className='text-sm fw-medium mb-0'>{customer.pan_number || "N/A"}</p>
                </div>
                <div>
                  <span className='text-xs text-secondary-light'>Full Name:</span>
                  <p className='text-sm fw-medium mb-0'>{customer.pan_full_name || "N/A"}</p>
                </div>
                <div>
                  <span className='text-xs text-secondary-light'>Date of Birth:</span>
                  <p className='text-sm fw-medium mb-0'>{formatDate(customer.pan_dob) || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className='col-md-6'>
            <div className='card bg-base border p-16 radius-8'>
              <h6 className='text-sm text-secondary-light mb-12'>Aadhaar Card Details</h6>
              <div className='d-flex flex-column gap-2'>
                <div>
                  <span className='text-xs text-secondary-light'>Aadhaar Number:</span>
                  <p className='text-sm fw-medium mb-0'>{customer.aadhaar_number ? "****" + customer.aadhaar_number.slice(-4) : "N/A"}</p>
                </div>
                <div>
                  <span className='text-xs text-secondary-light'>Date of Birth:</span>
                  <p className='text-sm fw-medium mb-0'>{formatDate(customer.aadhaar_dob) || "N/A"}</p>
                </div>
                <div>
                  <span className='text-xs text-secondary-light'>Gender:</span>
                  <p className='text-sm fw-medium mb-0'>{customer.gender || "N/A"}</p>
                </div>
                <div>
                  <span className='text-xs text-secondary-light'>DOB Match Verified:</span>
                  <p className='text-sm fw-medium mb-0'>
                    {customer.dob_match_verified ? (
                      <span className='badge bg-success'>Verified</span>
                    ) : (
                      <span className='badge bg-warning'>Not Verified</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className='col-md-6'>
            <div className='card bg-base border p-16 radius-8'>
              <h6 className='text-sm text-secondary-light mb-12'>GST Details</h6>
              <div className='d-flex flex-column gap-2'>
                <div>
                  <span className='text-xs text-secondary-light'>GSTIN:</span>
                  <p className='text-sm fw-medium mb-0'>{customer.gstin || "N/A"}</p>
                </div>
                <div>
                  <span className='text-xs text-secondary-light'>Business Name:</span>
                  <p className='text-sm fw-medium mb-0'>{customer.business_name || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>

          {customer.address && (
            <div className='col-md-12'>
              <div className='card bg-base border p-16 radius-8'>
                <h6 className='text-sm text-secondary-light mb-12'>Address</h6>
                <div className='d-flex flex-column gap-2'>
                  <p className='text-sm fw-medium mb-0'>
                    {typeof customer.address === 'string' 
                      ? customer.address 
                      : JSON.stringify(customer.address)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {customer.rejection_reason && (
            <div className='col-md-12'>
              <div className='alert alert-danger radius-8'>
                <h6 className='text-sm mb-8'>Rejection Reason:</h6>
                <p className='text-sm mb-0'>{customer.rejection_reason}</p>
              </div>
            </div>
          )}

          <div className='col-md-12'>
            <div className='card bg-base border p-16 radius-8'>
              <h6 className='text-sm text-secondary-light mb-12'>Additional Information</h6>
              <div className='d-flex flex-column gap-2'>
                <div>
                  <span className='text-xs text-secondary-light'>Max Virtual Numbers:</span>
                  <p className='text-sm fw-medium mb-0'>{customer.max_virtual_numbers || "N/A"}</p>
                </div>
                <div>
                  <span className='text-xs text-secondary-light'>Created At:</span>
                  <p className='text-sm fw-medium mb-0'>{formatDate(customer.created_at) || "N/A"}</p>
                </div>
                <div>
                  <span className='text-xs text-secondary-light'>Updated At:</span>
                  <p className='text-sm fw-medium mb-0'>{formatDate(customer.updated_at) || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
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
    </div>
  );
};

export default ViewCustomerLayer;

