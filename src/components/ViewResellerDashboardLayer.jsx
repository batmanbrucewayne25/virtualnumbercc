import { Icon } from "@iconify/react/dist/iconify.js";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getMstResellerById } from "@/hasura/mutations/reseller";
import { getApprovedCustomersByReseller, getCustomerWithTransactions, suspendCustomer } from "@/hasura/mutations/user";
import { getUserData, getAuthToken } from "@/utils/auth";

const ViewResellerDashboardLayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reseller, setReseller] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    // Get current user role
    const token = getAuthToken();
    const userData = getUserData();
    
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const role = payload.role || userData?.role;
        setCurrentUserRole(role);
        setIsSuperAdmin(role === 'admin' || role === 'super_admin');
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    }

    if (id) {
      fetchReseller();
      fetchCustomers();
    }
  }, [id]);

  const fetchReseller = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getMstResellerById(id);
      if (result.success && result.data) {
        setReseller(result.data);
      } else {
        setError(result.message || "Reseller not found");
      }
    } catch (err) {
      console.error("Error fetching reseller:", err);
      setError("An error occurred while loading reseller details");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const result = await getApprovedCustomersByReseller(id);
      if (result.success) {
        setCustomers(result.data || []);
      }
    } catch (err) {
      console.error("Error fetching customers:", err);
    }
  };

  const handleCustomerClick = async (customerId) => {
    setActionLoading(true);
    try {
      const result = await getCustomerWithTransactions(customerId);
      if (result.success) {
        setSelectedCustomer(result.data);
        setShowCustomerModal(true);
      } else {
        setError(result.message || "Failed to load customer details");
      }
    } catch (err) {
      console.error("Error fetching customer:", err);
      setError("An error occurred while loading customer details");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspendCustomer = async () => {
    if (!selectedCustomer) return;
    
    if (!window.confirm(`Are you sure you want to suspend the account for ${selectedCustomer.profile_name || selectedCustomer.email}?`)) {
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      const result = await suspendCustomer(selectedCustomer.id);
      if (result.success) {
        alert("Customer account suspended successfully!");
        await handleCustomerClick(selectedCustomer.id);
        await fetchCustomers();
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

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return "₹0.00";
    return `₹${Number(amount).toFixed(2)}`;
  };

  const calculateDaysLeft = (expiryDate) => {
    if (!expiryDate) return "-";
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffTime = expiry - today;
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return daysLeft > 0 ? daysLeft : 0;
  };

  if (loading) {
    return (
      <div className='card h-100 p-0 radius-12'>
        <div className='card-body p-24'>
          <div className='text-center py-40'>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className='text-muted mt-3'>Loading reseller dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !reseller) {
    return (
      <div className='card h-100 p-0 radius-12'>
        <div className='card-body p-24'>
          <div className='alert alert-danger radius-8' role='alert'>
            <Icon icon='material-symbols:error-outline' className='icon me-2' />
            {error || "Reseller not found"}
          </div>
          <Link to="/reseller-list" className='btn btn-primary mt-3'>
            Back to Reseller List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Reseller Profile Section */}
      <div className='card h-100 p-0 radius-12 mb-24'>
        <div className='card-header border-bottom bg-base py-16 px-24'>
          <h5 className='text-md text-primary-light mb-0'>Reseller Profile</h5>
        </div>
        <div className='card-body p-24'>
          <div className='row'>
            <div className='col-md-6'>
              <div className='card border mb-20'>
                <div className='card-body p-24'>
                  <h6 className='text-sm text-primary-light mb-20'>Personal Information</h6>
                  
                  <div className='mb-16'>
                    <label className='form-label text-xs text-secondary-light mb-4'>Name</label>
                    <p className='text-md fw-medium text-primary-light mb-0'>
                      {reseller?.first_name} {reseller?.last_name}
                    </p>
                  </div>

                  <div className='mb-16'>
                    <label className='form-label text-xs text-secondary-light mb-4'>Email</label>
                    <p className='text-md fw-medium text-primary-light mb-0'>
                      {reseller?.email || "-"}
                    </p>
                  </div>

                  <div className='mb-16'>
                    <label className='form-label text-xs text-secondary-light mb-4'>Phone</label>
                    <p className='text-md fw-medium text-primary-light mb-0'>
                      {reseller?.phone || "-"}
                    </p>
                  </div>

                  {isSuperAdmin && (
                    <>
                      <div className='mb-16'>
                        <label className='form-label text-xs text-secondary-light mb-4'>Date of Birth</label>
                        <p className='text-md fw-medium text-primary-light mb-0'>
                          {reseller?.dob ? formatDate(reseller.dob) : "-"}
                        </p>
                      </div>

                      <div className='mb-16'>
                        <label className='form-label text-xs text-secondary-light mb-4'>Gender</label>
                        <p className='text-md fw-medium text-primary-light mb-0'>
                          {reseller?.gender || "-"}
                        </p>
                      </div>

                      <div className='mb-16'>
                        <label className='form-label text-xs text-secondary-light mb-4'>Address</label>
                        <p className='text-md fw-medium text-primary-light mb-0'>
                          {reseller?.address || "-"}
                        </p>
                      </div>

                      <div className='mb-16'>
                        <label className='form-label text-xs text-secondary-light mb-4'>PAN Number</label>
                        <p className='text-md fw-medium text-primary-light mb-0'>
                          {reseller?.pan_number ? `****${reseller.pan_number.slice(-4)}` : "-"}
                        </p>
                      </div>

                      <div className='mb-16'>
                        <label className='form-label text-xs text-secondary-light mb-4'>Aadhaar Number</label>
                        <p className='text-md fw-medium text-primary-light mb-0'>
                          {reseller?.aadhaar_number ? `****${reseller.aadhaar_number.slice(-4)}` : "-"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className='col-md-6'>
              <div className='card border mb-20'>
                <div className='card-body p-24'>
                  <h6 className='text-sm text-primary-light mb-20'>Business Information</h6>
                  
                  <div className='mb-16'>
                    <label className='form-label text-xs text-secondary-light mb-4'>Business Name</label>
                    <p className='text-md fw-medium text-primary-light mb-0'>
                      {reseller?.business_name || "-"}
                    </p>
                  </div>

                  <div className='mb-16'>
                    <label className='form-label text-xs text-secondary-light mb-4'>Business Email</label>
                    <p className='text-md fw-medium text-primary-light mb-0'>
                      {reseller?.business_email || "-"}
                    </p>
                  </div>

                  <div className='mb-16'>
                    <label className='form-label text-xs text-secondary-light mb-4'>GSTIN</label>
                    <p className='text-md fw-medium text-primary-light mb-0'>
                      {reseller?.gstin || "-"}
                    </p>
                  </div>

                  <div className='mb-16'>
                    <label className='form-label text-xs text-secondary-light mb-4'>Wallet Balance</label>
                    <p className='text-md fw-medium text-success-600 mb-0'>
                      {formatCurrency(reseller?.mst_wallet?.balance ?? 0)}
                    </p>
                  </div>

                  <div className='mb-16'>
                    <label className='form-label text-xs text-secondary-light mb-4'>Status</label>
                    <div>
                      <span
                        className={`${
                          reseller?.status
                            ? "bg-success-focus text-success-600 border border-success-main"
                            : "bg-danger-focus text-danger-600 border border-danger-main"
                        } px-24 py-4 radius-4 fw-medium text-sm`}
                      >
                        {reseller?.status ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customers List Section */}
      <div className='card h-100 p-0 radius-12'>
        <div className='card-header border-bottom bg-base py-16 px-24'>
          <h5 className='text-md text-primary-light mb-0'>Customers</h5>
        </div>
        <div className='card-body p-24'>
          {customers.length === 0 ? (
            <div className='text-center py-40'>
              <Icon icon='mdi:account-group-outline' className='icon text-6xl text-muted mb-3' />
              <p className='text-muted'>No customers found</p>
            </div>
          ) : (
            <div className='table-responsive scroll-sm'>
              <table className='table bordered-table sm-table mb-0'>
                <thead>
                  <tr>
                    <th scope='col'>S.L</th>
                    <th scope='col'>Customer Name</th>
                    <th scope='col'>Virtual Number</th>
                    <th scope='col'>Call Forwarding Number</th>
                    <th scope='col'>Purchase Date</th>
                    <th scope='col'>Expiry Date</th>
                    <th scope='col' className='text-center'>Days Left</th>
                    <th scope='col' className='text-center'>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer, index) => {
                    const virtualNumber = customer.mst_virtual_numbers?.[0];
                    const daysLeft = virtualNumber?.expiry_date ? calculateDaysLeft(virtualNumber.expiry_date) : "-";
                    
                    return (
                      <tr key={customer.id}>
                        <td>{index + 1}</td>
                        <td>
                          <span className='text-sm fw-medium'>
                            {customer.profile_name || customer.business_name || customer.pan_full_name || "N/A"}
                          </span>
                        </td>
                        <td>
                          <span className='text-sm'>
                            {virtualNumber?.virtual_number || "-"}
                          </span>
                        </td>
                        <td>
                          <span className='text-sm'>
                            {virtualNumber?.call_forwarding_number || "-"}
                          </span>
                        </td>
                        <td>{formatDate(virtualNumber?.purchase_date)}</td>
                        <td>{formatDate(virtualNumber?.expiry_date)}</td>
                        <td className='text-center'>
                          <span className={`text-sm fw-medium ${
                            daysLeft !== "-" && daysLeft < 7 
                              ? "text-danger-600" 
                              : daysLeft !== "-" && daysLeft < 15 
                              ? "text-warning-600" 
                              : "text-secondary-light"
                          }`}>
                            {daysLeft !== "-" ? `${daysLeft} days` : "-"}
                          </span>
                        </td>
                        <td className='text-center'>
                          <button
                            type='button'
                            onClick={() => handleCustomerClick(customer.id)}
                            className='btn btn-sm btn-primary'
                            disabled={actionLoading}
                          >
                            <Icon icon='majesticons:eye-line' className='icon me-1' />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Customer Detail Modal */}
      {showCustomerModal && selectedCustomer && (
        <div className='modal show d-block' style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }} tabIndex="-1">
          <div className='modal-dialog modal-lg modal-dialog-scrollable'>
            <div className='modal-content'>
              <div className='modal-header'>
                <h5 className='modal-title'>Customer Details</h5>
                <button
                  type='button'
                  className='btn-close'
                  onClick={() => {
                    setShowCustomerModal(false);
                    setSelectedCustomer(null);
                  }}
                ></button>
              </div>
              <div className='modal-body'>
                {error && (
                  <div className='alert alert-danger radius-8 mb-24' role='alert'>
                    <Icon icon='material-symbols:error-outline' className='icon me-2' />
                    {error}
                  </div>
                )}

                <div className='row'>
                  <div className='col-md-6'>
                    <div className='card border mb-20'>
                      <div className='card-body p-24'>
                        <h6 className='text-sm text-primary-light mb-20'>Customer Information</h6>
                        
                        <div className='mb-16'>
                          <label className='form-label text-xs text-secondary-light mb-4'>Name</label>
                          <p className='text-md fw-medium text-primary-light mb-0'>
                            {selectedCustomer.profile_name || selectedCustomer.business_name || selectedCustomer.pan_full_name || "N/A"}
                          </p>
                        </div>

                        <div className='mb-16'>
                          <label className='form-label text-xs text-secondary-light mb-4'>Email</label>
                          <p className='text-md fw-medium text-primary-light mb-0'>
                            {selectedCustomer.email || "-"}
                          </p>
                        </div>

                        <div className='mb-16'>
                          <label className='form-label text-xs text-secondary-light mb-4'>Phone</label>
                          <p className='text-md fw-medium text-primary-light mb-0'>
                            {selectedCustomer.phone || "-"}
                          </p>
                        </div>

                        <div className='mb-16'>
                          <label className='form-label text-xs text-secondary-light mb-4'>Business Email</label>
                          <p className='text-md fw-medium text-primary-light mb-0'>
                            {selectedCustomer.business_email || "-"}
                          </p>
                        </div>

                        {isSuperAdmin && (
                          <>
                            <div className='mb-16'>
                              <label className='form-label text-xs text-secondary-light mb-4'>PAN Number</label>
                              <p className='text-md fw-medium text-primary-light mb-0'>
                                {selectedCustomer.pan_number ? `****${selectedCustomer.pan_number.slice(-4)}` : "-"}
                              </p>
                            </div>

                            <div className='mb-16'>
                              <label className='form-label text-xs text-secondary-light mb-4'>PAN Full Name</label>
                              <p className='text-md fw-medium text-primary-light mb-0'>
                                {selectedCustomer.pan_full_name || "-"}
                              </p>
                            </div>

                            <div className='mb-16'>
                              <label className='form-label text-xs text-secondary-light mb-4'>PAN DOB</label>
                              <p className='text-md fw-medium text-primary-light mb-0'>
                                {selectedCustomer.pan_dob ? formatDate(selectedCustomer.pan_dob) : "-"}
                              </p>
                            </div>

                            <div className='mb-16'>
                              <label className='form-label text-xs text-secondary-light mb-4'>Aadhaar Number</label>
                              <p className='text-md fw-medium text-primary-light mb-0'>
                                {selectedCustomer.aadhaar_number ? `****${selectedCustomer.aadhaar_number.slice(-4)}` : "-"}
                              </p>
                            </div>

                            <div className='mb-16'>
                              <label className='form-label text-xs text-secondary-light mb-4'>Aadhaar DOB</label>
                              <p className='text-md fw-medium text-primary-light mb-0'>
                                {selectedCustomer.aadhaar_dob ? formatDate(selectedCustomer.aadhaar_dob) : "-"}
                              </p>
                            </div>

                            <div className='mb-16'>
                              <label className='form-label text-xs text-secondary-light mb-4'>Gender</label>
                              <p className='text-md fw-medium text-primary-light mb-0'>
                                {selectedCustomer.gender || "-"}
                              </p>
                            </div>

                            <div className='mb-16'>
                              <label className='form-label text-xs text-secondary-light mb-4'>GSTIN</label>
                              <p className='text-md fw-medium text-primary-light mb-0'>
                                {selectedCustomer.gstin || "-"}
                              </p>
                            </div>

                            <div className='mb-16'>
                              <label className='form-label text-xs text-secondary-light mb-4'>Business Name</label>
                              <p className='text-md fw-medium text-primary-light mb-0'>
                                {selectedCustomer.business_name || "-"}
                              </p>
                            </div>

                            <div className='mb-16'>
                              <label className='form-label text-xs text-secondary-light mb-4'>Address</label>
                              <p className='text-md fw-medium text-primary-light mb-0'>
                                {selectedCustomer.address ? JSON.stringify(selectedCustomer.address) : "-"}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className='col-md-6'>
                    <div className='card border mb-20'>
                      <div className='card-body p-24'>
                        <h6 className='text-sm text-primary-light mb-20'>Virtual Numbers</h6>
                        
                        {selectedCustomer.mst_virtual_numbers && selectedCustomer.mst_virtual_numbers.length > 0 ? (
                          selectedCustomer.mst_virtual_numbers.map((vn) => (
                            <div key={vn.id} className='mb-16 pb-16 border-bottom'>
                              <div className='mb-8'>
                                <label className='form-label text-xs text-secondary-light mb-4'>Virtual Number</label>
                                <p className='text-md fw-medium text-primary-light mb-0'>
                                  {vn.virtual_number || "-"}
                                </p>
                              </div>
                              <div className='mb-8'>
                                <label className='form-label text-xs text-secondary-light mb-4'>Call Forwarding</label>
                                <p className='text-md fw-medium text-primary-light mb-0'>
                                  {vn.call_forwarding_number || "-"}
                                </p>
                              </div>
                              <div className='mb-8'>
                                <label className='form-label text-xs text-secondary-light mb-4'>Purchase Date</label>
                                <p className='text-md fw-medium text-primary-light mb-0'>
                                  {formatDate(vn.purchase_date)}
                                </p>
                              </div>
                              <div className='mb-8'>
                                <label className='form-label text-xs text-secondary-light mb-4'>Expiry Date</label>
                                <p className='text-md fw-medium text-primary-light mb-0'>
                                  {formatDate(vn.expiry_date)}
                                </p>
                              </div>
                              <div className='mb-8'>
                                <label className='form-label text-xs text-secondary-light mb-4'>Status</label>
                                <span className={`${
                                  vn.status === "active"
                                    ? "bg-success-focus text-success-600 border border-success-main"
                                    : "bg-danger-focus text-danger-600 border border-danger-main"
                                } px-24 py-4 radius-4 fw-medium text-sm`}>
                                  {vn.status || "-"}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className='text-muted'>No virtual numbers assigned</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transactions Section */}
                {selectedCustomer.mst_transactions && selectedCustomer.mst_transactions.length > 0 && (
                  <div className='card border mt-20'>
                    <div className='card-body p-24'>
                      <h6 className='text-sm text-primary-light mb-20'>Transactions</h6>
                      <div className='table-responsive'>
                        <table className='table table-sm'>
                          <thead>
                            <tr>
                              <th>Transaction #</th>
                              <th>Date</th>
                              <th>Type</th>
                              <th>Payment Mode</th>
                              <th>Amount</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedCustomer.mst_transactions.map((txn) => (
                              <tr key={txn.id}>
                                <td>{txn.transaction_number || "-"}</td>
                                <td>{formatDate(txn.payment_date || txn.created_at)}</td>
                                <td>{txn.transaction_type || "-"}</td>
                                <td>{txn.payment_mode || "-"}</td>
                                <td>{formatCurrency(txn.amount)}</td>
                                <td>
                                  <span className={`${
                                    txn.status === "success"
                                      ? "bg-success-focus text-success-600"
                                      : txn.status === "failure"
                                      ? "bg-danger-focus text-danger-600"
                                      : "bg-warning-focus text-warning-600"
                                  } px-12 py-2 radius-4 fw-medium text-xs`}>
                                    {txn.status || "-"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className='modal-footer'>
                {isSuperAdmin && selectedCustomer.status !== "suspended" && (
                  <button
                    type='button'
                    className='btn btn-danger'
                    onClick={handleSuspendCustomer}
                    disabled={actionLoading}
                  >
                    {actionLoading ? "Suspending..." : "Suspend Account"}
                  </button>
                )}
                <button
                  type='button'
                  className='btn btn-secondary'
                  onClick={() => {
                    setShowCustomerModal(false);
                    setSelectedCustomer(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Back Button */}
      <div className='d-flex justify-content-end gap-3 mt-24'>
        <button
          type='button'
          className='btn btn-secondary'
          onClick={() => navigate("/reseller-list")}
        >
          Back to Reseller List
        </button>
      </div>
    </div>
  );
};

export default ViewResellerDashboardLayer;

