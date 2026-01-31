import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect } from "react";
import { getPendingDomainApprovals, approveMstResellerDomain } from "@/hasura/mutations/resellerDomain";
import { getUserData } from "@/utils/auth";

const DomainApprovalLayer = () => {
  const [pendingDomains, setPendingDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getPendingDomainApprovals();
      if (result.success) {
        setPendingDomains(result.data || []);
      } else {
        setError(result.message || "Failed to load pending approvals");
      }
    } catch (err) {
      console.error("Error fetching pending approvals:", err);
      setError("An error occurred while loading pending approvals");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (domainId, domain, resellerName) => {
    if (!window.confirm(`Approve domain "${domain}" for reseller "${resellerName}"?`)) {
      return;
    }

    setActionLoading(domainId);
    setError("");
    setSuccess("");

    try {
      const userData = getUserData();
      if (!userData || !userData.id) {
        setError("Unable to determine admin ID. Please log in again.");
        setActionLoading(null);
        return;
      }

      const result = await approveMstResellerDomain(domainId, userData.id);
      
      if (result.success) {
        setSuccess(`Domain "${domain}" approved successfully!`);
        setTimeout(() => {
          setSuccess("");
          fetchPendingApprovals();
        }, 2000);
      } else {
        setError(result.message || "Failed to approve domain");
      }
    } catch (err) {
      console.error("Error approving domain:", err);
      setError(err?.message || "An error occurred while approving domain");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className='card h-100 p-0 radius-12'>
        <div className='card-body p-24'>
          <div className='text-center py-40'>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className='text-muted mt-3'>Loading pending domain approvals...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='card h-100 p-0 radius-12'>
      <div className='card-header border-bottom bg-base py-16 px-24'>
        <h5 className='text-md text-primary-light mb-0'>Domain Approval Requests</h5>
      </div>
      <div className='card-body p-24'>
        {error && (
          <div className="alert alert-danger alert-dismissible fade show" role="alert">
            {error}
            <button
              type="button"
              className="btn-close"
              onClick={() => setError("")}
            ></button>
          </div>
        )}

        {success && (
          <div className="alert alert-success alert-dismissible fade show" role="alert">
            {success}
            <button
              type="button"
              className="btn-close"
              onClick={() => setSuccess("")}
            ></button>
          </div>
        )}

        {pendingDomains.length === 0 ? (
          <div className="text-center py-40">
            <Icon icon="mdi:check-circle" className="text-success" style={{ fontSize: '48px' }} />
            <p className="text-muted mt-3">No pending domain approvals</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Reseller</th>
                  <th>Domain</th>
                  <th>Requested Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingDomains.map((domainRecord) => (
                  <tr key={domainRecord.id}>
                    <td>
                      <div>
                        <strong>{domainRecord.reseller_data?.business_name || `${domainRecord.reseller_data?.first_name || ''} ${domainRecord.reseller_data?.last_name || ''}`.trim()}</strong>
                        <br />
                        <small className="text-muted">{domainRecord.reseller_data?.email}</small>
                      </div>
                    </td>
                    <td>
                      <code>{domainRecord.domain}</code>
                    </td>
                    <td>
                      {domainRecord.id ? 'Pending' : '-'}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleApprove(
                          domainRecord.id,
                          domainRecord.domain,
                          domainRecord.reseller_data?.business_name || `${domainRecord.reseller_data?.first_name || ''} ${domainRecord.reseller_data?.last_name || ''}`.trim()
                        )}
                        disabled={actionLoading === domainRecord.id}
                      >
                        {actionLoading === domainRecord.id ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                            Approving...
                          </>
                        ) : (
                          <>
                            <Icon icon="mdi:check" className="me-1" />
                            Approve
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DomainApprovalLayer;

