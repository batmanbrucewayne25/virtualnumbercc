import { Icon } from "@iconify/react/dist/iconify.js";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getMstResellers, deleteMstReseller, approveMstReseller, rejectMstReseller, suspendMstReseller, reactivateMstReseller, updateMstResellerStatus } from "@/hasura/mutations/reseller";
import { getUserData } from "@/utils/auth";
import ApproveResellerModal from "./ApproveResellerModal";
import RejectResellerModal from "./RejectResellerModal";
import SuspendResellerModal from "./SuspendResellerModal";
import PermissionGuard from "@/components/PermissionGuard";

const ResellerListLayer = () => {
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchResellers();
  }, []);

  const fetchResellers = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getMstResellers();
      if (result.success) {
        setResellers(result.data || []);
      } else {
        setError("Failed to load resellers");
      }
    } catch (err) {
      console.error("Error fetching resellers:", err);
      setError("An error occurred while loading resellers");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete reseller "${name}"?`)) {
      return;
    }

    try {
      const result = await deleteMstReseller(id);
      if (result.success) {
        setSuccess("Reseller deleted successfully");
        setTimeout(() => setSuccess(""), 3000);
        fetchResellers();
      } else {
        setError(result.message || "Failed to delete reseller");
        setTimeout(() => setError(""), 5000);
      }
    } catch (err) {
      console.error("Error deleting reseller:", err);
      setError("An error occurred while deleting reseller");
      setTimeout(() => setError(""), 5000);
    }
  };

  const handleApproveClick = (reseller) => {
    setSelectedReseller(reseller);
    setApproveModalOpen(true);
  };

  const handleRejectClick = (reseller) => {
    setSelectedReseller(reseller);
    setRejectModalOpen(true);
  };

  const handleSuspendClick = (reseller) => {
    setSelectedReseller(reseller);
    setSuspendModalOpen(true);
  };

  const handleApprove = async (approvalData) => {
    if (!selectedReseller) return;

    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      const userData = getUserData();
      if (!userData || !userData.id) {
        setError("Unable to determine admin ID. Please log in again.");
        setActionLoading(false);
        return;
      }

      const result = await approveMstReseller(selectedReseller.id, userData.id, approvalData);
      
      if (result.success) {
        setSuccess("Reseller approved successfully! Email and WhatsApp notifications sent.");
        setTimeout(() => {
          setSuccess("");
          setApproveModalOpen(false);
          setSelectedReseller(null);
          fetchResellers();
        }, 2000);
      } else {
        setError(result.message || "Failed to approve reseller");
      }
    } catch (err) {
      console.error("Error approving reseller:", err);
      setError(err.message || "An error occurred while approving reseller");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (rejectionReason) => {
    if (!selectedReseller) return;

    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      const userData = getUserData();
      if (!userData || !userData.id) {
        setError("Unable to determine admin ID. Please log in again.");
        setActionLoading(false);
        return;
      }

      const result = await rejectMstReseller(selectedReseller.id, userData.id, rejectionReason);
      
      if (result.success) {
        setSuccess("Reseller rejected successfully! Email notification sent.");
        setTimeout(() => {
          setSuccess("");
          setRejectModalOpen(false);
          setSelectedReseller(null);
          fetchResellers();
        }, 2000);
        
        // TODO: Send rejection email notification
        // await sendRejectionEmail(selectedReseller.email, rejectionReason);
      } else {
        setError(result.message || "Failed to reject reseller");
      }
    } catch (err) {
      console.error("Error rejecting reseller:", err);
      setError(err.message || "An error occurred while rejecting reseller");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async (suspendedReason) => {
    if (!selectedReseller) return;

    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      const userData = getUserData();
      if (!userData || !userData.id) {
        setError("Unable to determine admin ID. Please log in again.");
        setActionLoading(false);
        return;
      }

      const result = await suspendMstReseller(selectedReseller.id, userData.id, suspendedReason);
      
      if (result.success) {
        setSuccess("Reseller suspended successfully!");
        setTimeout(() => {
          setSuccess("");
          setSuspendModalOpen(false);
          setSelectedReseller(null);
          fetchResellers();
        }, 2000);
      } else {
        setError(result.message || "Failed to suspend reseller");
      }
    } catch (err) {
      console.error("Error suspending reseller:", err);
      setError(err.message || "An error occurred while suspending reseller");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async (reseller) => {
    if (!window.confirm(`Are you sure you want to reactivate reseller "${reseller.first_name} ${reseller.last_name}"?`)) {
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      const userData = getUserData();
      if (!userData || !userData.id) {
        setError("Unable to determine admin ID. Please log in again.");
        setActionLoading(false);
        return;
      }

      const result = await reactivateMstReseller(reseller.id, userData.id);
      
      if (result.success) {
        setSuccess("Reseller reactivated successfully!");
        setTimeout(() => {
          setSuccess("");
          fetchResellers();
        }, 2000);
      } else {
        setError(result.message || "Failed to reactivate reseller");
      }
    } catch (err) {
      console.error("Error reactivating reseller:", err);
      setError(err.message || "An error occurred while reactivating reseller");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (reseller) => {
    // Don't allow toggling if suspended
    if (reseller.suspended_at) {
      setError("Cannot change status of a suspended reseller. Please reactivate first.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const newStatus = !reseller.status;
    const action = newStatus ? "activate" : "deactivate";
    
    if (!window.confirm(`Are you sure you want to ${action} reseller "${reseller.first_name} ${reseller.last_name}"?`)) {
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await updateMstResellerStatus(reseller.id, newStatus);
      
      if (result.success) {
        setSuccess(`Reseller ${action}d successfully!`);
        setTimeout(() => {
          setSuccess("");
          fetchResellers();
        }, 2000);
      } else {
        setError(result.message || `Failed to ${action} reseller`);
      }
    } catch (err) {
      console.error(`Error ${action}ing reseller:`, err);
      setError(err.message || `An error occurred while ${action}ing reseller`);
    } finally {
      setActionLoading(false);
    }
  };

  const isPendingReseller = (reseller) => {
    // A reseller is pending if they have completed signup but haven't been approved yet
    return reseller.signup_completed && !reseller.approval_date;
  };

  // Filter resellers based on search and status
  const filteredResellers = resellers.filter((reseller) => {
    const matchesSearch =
      searchTerm === "" ||
      `${reseller.first_name} ${reseller.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reseller.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reseller.phone?.includes(searchTerm) ||
      reseller.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reseller.business_email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && reseller.status && !reseller.suspended_at) ||
      (statusFilter === "inactive" && !reseller.status && !reseller.suspended_at) ||
      (statusFilter === "suspended" && reseller.suspended_at);

    return matchesSearch && matchesStatus;
  });

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

  return (
    <div className='card h-100 p-0 radius-12'>
      <div className='card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between'>
        <div className='d-flex align-items-center flex-wrap gap-3'>
          <form className='navbar-search'>
            <input
              type='text'
              className='bg-base h-40-px w-auto'
              name='search'
              placeholder='Search by name, email, phone, or business'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Icon icon='ion:search-outline' className='icon' />
          </form>
          <select
            className='form-select form-select-sm w-auto ps-12 py-6 radius-12 h-40-px'
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value='all'>All Status</option>
            <option value='active'>Active</option>
            <option value='inactive'>Inactive</option>
            <option value='suspended'>Suspended</option>
          </select>
        </div>
        <PermissionGuard module="Reseller" action="create">
          <Link
            to='/add-reseller'
            className='btn btn-primary text-sm btn-sm px-12 py-12 radius-8 d-flex align-items-center gap-2'
          >
            <Icon
              icon='ic:baseline-plus'
              className='icon text-xl line-height-1'
            />
            Add New Reseller
          </Link>
        </PermissionGuard>
      </div>
      <div className='card-body p-24'>
        {error && (
          <div className='alert alert-danger radius-8 mb-24' role='alert'>
            <Icon icon='material-symbols:error-outline' className='icon me-2' />
            {error}
          </div>
        )}
        {success && (
          <div className='alert alert-success radius-8 mb-24' role='alert'>
            <Icon icon='material-symbols:check-circle-outline' className='icon me-2' />
            {success}
          </div>
        )}

        {loading ? (
          <div className='text-center py-40'>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className='text-muted mt-3'>Loading resellers...</p>
          </div>
        ) : filteredResellers.length === 0 ? (
          <div className='text-center py-40'>
            <Icon icon='mdi:account-off' className='icon text-6xl text-muted mb-3' />
            <p className='text-muted'>No resellers found</p>
          </div>
        ) : (
          <>
            <div className='table-responsive scroll-sm'>
              <table className='table bordered-table sm-table mb-0'>
                <thead>
                  <tr>
                    <th scope='col'>S.L</th>
                    <th scope='col'>Date</th>
                    <th scope='col'>Name</th>
                    <th scope='col'>Email</th>
                    <th scope='col'>Phone</th>
                    <th scope='col'>Wallet Balance</th>
                    <th scope='col' className='text-center'>
                      Approval Status
                    </th>
                    <th scope='col' className='text-center'>
                      Status
                    </th>
                    <th scope='col' className='text-center'>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResellers.map((reseller, index) => (
                    <tr key={reseller.id}>
                      <td>{index + 1}</td>
                      <td>{formatDate(reseller.created_at)}</td>
                      <td>
                        <Link 
                          to={`/view-reseller/${reseller.id}`}
                          className='text-decoration-none'
                        >
                          <div className='d-flex align-items-center hover-text-primary'>
                            <div className='w-40-px h-40-px rounded-circle flex-shrink-0 me-12 overflow-hidden bg-primary-100 d-flex align-items-center justify-content-center'>
                              <Icon
                                icon='solar:user-bold'
                                className='icon text-primary-600 text-xl'
                              />
                            </div>
                            <div className='flex-grow-1'>
                              <span className='text-md mb-0 fw-normal text-secondary-light hover-text-primary'>
                                {reseller.first_name} {reseller.last_name}
                              </span>
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td>
                        <span className='text-md mb-0 fw-normal text-secondary-light'>
                          {reseller.email || "-"}
                        </span>
                      </td>
                      <td>
                        <span className='text-md mb-0 fw-normal text-secondary-light'>
                          {reseller.phone || "-"}
                        </span>
                      </td>
                      <td>
                        <span className='text-md mb-0 fw-medium text-success-600'>
                          {formatCurrency(reseller.mst_wallet?.balance ?? 0)}
                        </span>
                      </td>
                      <td className='text-center'>
                        {reseller.suspended_at ? (
                          <span className="bg-warning-focus text-warning-600 border border-warning-main px-24 py-4 radius-4 fw-medium text-sm" title={reseller.suspended_reason || 'SUSPEND'}>
                            SUSPEND
                          </span>
                        ) : reseller.approval_date ? (
                          <span className="bg-success-focus text-success-600 border border-success-main px-24 py-4 radius-4 fw-medium text-sm">
                            Approved
                          </span>
                        ) : reseller.rejection_reason ? (
                          <span className="bg-danger-focus text-danger-600 border border-danger-main px-24 py-4 radius-4 fw-medium text-sm" title={reseller.rejection_reason}>
                            Rejected
                          </span>
                        ) : isPendingReseller(reseller) ? (
                          <span className="bg-warning-focus text-warning-600 border border-warning-main px-24 py-4 radius-4 fw-medium text-sm">
                            Pending
                          </span>
                        ) : (
                          <div className='d-flex align-items-center gap-8 justify-content-center'>
                            <PermissionGuard module="Reseller" action="update">
                              <button
                                type='button'
                                onClick={() => handleApproveClick(reseller)}
                                className='bg-success-focus text-success-600 bg-hover-success-200 fw-medium w-32-px h-32-px d-flex justify-content-center align-items-center rounded-circle border-0'
                                title='Approve'
                              >
                                <Icon
                                  icon='material-symbols:check-circle-outline'
                                  className='icon text-lg'
                                />
                              </button>
                            </PermissionGuard>
                            <PermissionGuard module="Reseller" action="update">
                              <button
                                type='button'
                                onClick={() => handleRejectClick(reseller)}
                                className='bg-danger-focus text-danger-600 bg-hover-danger-200 fw-medium w-32-px h-32-px d-flex justify-content-center align-items-center rounded-circle border-0'
                                title='Reject'
                              >
                                <Icon
                                  icon='material-symbols:cancel-outline'
                                  className='icon text-lg'
                                />
                              </button>
                            </PermissionGuard>
                          </div>
                        )}
                      </td>
                      <td className='text-center'>
                        {reseller.suspended_at ? (
                          <span className="bg-warning-focus text-warning-600 border border-warning-main px-24 py-4 radius-4 fw-medium text-sm">
                            SUSPEND
                          </span>
                        ) : (
                          <PermissionGuard 
                            module="Reseller" 
                            action="update"
                            fallback={
                              <span
                                className={`${
                                  reseller.status
                                    ? "bg-success-focus text-success-600 border border-success-main"
                                    : "bg-danger-focus text-danger-600 border border-danger-main"
                                } px-24 py-4 radius-4 fw-medium text-sm`}
                              >
                                {reseller.status ? "Active" : "Inactive"}
                              </span>
                            }
                          >
                            <div className="form-check form-switch d-inline-flex align-items-center justify-content-center">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                role="switch"
                                id={`status-toggle-${reseller.id}`}
                                checked={reseller.status || false}
                                onChange={() => handleToggleStatus(reseller)}
                                disabled={actionLoading || reseller.suspended_at}
                                style={{ cursor: actionLoading || reseller.suspended_at ? 'not-allowed' : 'pointer', width: '3rem', height: '1.5rem' }}
                              />
                              <label
                                className="form-check-label ms-2 text-sm fw-medium"
                                htmlFor={`status-toggle-${reseller.id}`}
                                style={{ cursor: actionLoading || reseller.suspended_at ? 'not-allowed' : 'pointer' }}
                              >
                                {reseller.status ? "Active" : "Inactive"}
                              </label>
                            </div>
                          </PermissionGuard>
                        )}
                      </td>
                      <td className='text-center'>
                        <div className='d-flex align-items-center gap-10 justify-content-center flex-wrap'>
                          <PermissionGuard module="Reseller" action="view">
                            <Link
                              to={`/view-reseller/${reseller.id}`}
                              className='bg-info-focus bg-hover-info-200 text-info-600 fw-medium w-40-px h-40-px d-flex justify-content-center align-items-center rounded-circle'
                              title='View'
                            >
                              <Icon
                                icon='majesticons:eye-line'
                                className='icon text-xl'
                              />
                            </Link>
                          </PermissionGuard>
                          {reseller.approval_date && !reseller.suspended_at && (
                            <PermissionGuard module="Reseller" action="update">
                              <button
                                type='button'
                                onClick={() => handleSuspendClick(reseller)}
                                className='bg-warning-focus bg-hover-warning-200 text-warning-600 fw-medium w-40-px h-40-px d-flex justify-content-center align-items-center rounded-circle border-0'
                                title='Suspend'
                              >
                                <Icon
                                  icon='material-symbols:block'
                                  className='icon text-xl'
                                />
                              </button>
                            </PermissionGuard>
                          )}
                          {reseller.suspended_at && (
                            <PermissionGuard module="Reseller" action="update">
                              <button
                                type='button'
                                onClick={() => handleReactivate(reseller)}
                                className='bg-success-focus bg-hover-success-200 text-success-600 fw-medium w-40-px h-40-px d-flex justify-content-center align-items-center rounded-circle border-0'
                                title='Reactivate'
                                disabled={actionLoading}
                              >
                                <Icon
                                  icon='material-symbols:check-circle'
                                  className='icon text-xl'
                                />
                              </button>
                            </PermissionGuard>
                          )}
                          <PermissionGuard module="Reseller" action="update">
                            <Link
                              to={`/edit-reseller/${reseller.id}`}
                              className='bg-success-focus text-success-600 bg-hover-success-200 fw-medium w-40-px h-40-px d-flex justify-content-center align-items-center rounded-circle'
                              title='Edit'
                            >
                              <Icon icon='lucide:edit' className='menu-icon' />
                            </Link>
                          </PermissionGuard>
                          <PermissionGuard module="Reseller" action="delete">
                            <button
                              type='button'
                              onClick={() =>
                                handleDelete(
                                  reseller.id,
                                  `${reseller.first_name} ${reseller.last_name}`
                                )
                              }
                              className='remove-item-btn bg-danger-focus bg-hover-danger-200 text-danger-600 fw-medium w-40-px h-40-px d-flex justify-content-center align-items-center rounded-circle border-0'
                              title='Delete'
                            >
                              <Icon
                                icon='fluent:delete-24-regular'
                                className='menu-icon'
                              />
                            </button>
                          </PermissionGuard>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className='d-flex align-items-center justify-content-between flex-wrap gap-2 mt-24'>
              <span>
                Showing {filteredResellers.length} of {resellers.length} reseller(s)
              </span>
            </div>
          </>
        )}
      </div>

      {/* Approve Modal */}
      <ApproveResellerModal
        isOpen={approveModalOpen}
        onClose={() => {
          setApproveModalOpen(false);
          setSelectedReseller(null);
        }}
        reseller={selectedReseller}
        onApprove={handleApprove}
        loading={actionLoading}
      />

      {/* Reject Modal */}
      <RejectResellerModal
        isOpen={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setSelectedReseller(null);
        }}
        reseller={selectedReseller}
        onReject={handleReject}
        loading={actionLoading}
      />
      <SuspendResellerModal
        isOpen={suspendModalOpen}
        onClose={() => {
          setSuspendModalOpen(false);
          setSelectedReseller(null);
        }}
        reseller={selectedReseller}
        onSuspend={handleSuspend}
        loading={actionLoading}
      />
    </div>
  );
};

export default ResellerListLayer;
