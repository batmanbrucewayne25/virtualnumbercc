import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect } from "react";
import { getMstResellerDomainByResellerId, upsertMstResellerDomain } from "@/hasura/mutations/resellerDomain";
import { getUserData, getAuthToken } from "@/utils/auth";
import SuccessModal from "./SuccessModal";

const CustomDomainSettingsLayer = () => {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [domainData, setDomainData] = useState(null);
  const [resellerId, setResellerId] = useState(null);

  useEffect(() => {
    // Get logged-in reseller ID
    const userData = getUserData();
    const token = getAuthToken();
    
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role === 'reseller' && userData?.id) {
          setResellerId(userData.id);
          fetchDomainData(userData.id);
        } else {
          setError("Only resellers can update their custom domain");
          setFetching(false);
        }
      } catch (err) {
        console.error("Error decoding token:", err);
        setError("Failed to authenticate user");
        setFetching(false);
      }
    } else {
      setError("Please login to update your custom domain");
      setFetching(false);
    }
  }, []);

  const fetchDomainData = async (id) => {
    setFetching(true);
    setError("");
    try {
      const result = await getMstResellerDomainByResellerId(id);
      if (result.success) {
        if (result.data) {
          setDomainData(result.data);
          setDomain(result.data.domain || "");
        }
      } else {
        setError(result.message || "Failed to fetch domain data");
      }
    } catch (err) {
      console.error("Error fetching domain:", err);
      setError("An error occurred while loading domain data");
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (e) => {
    setDomain(e.target.value);
    setError("");
    setSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      if (!resellerId) {
        setError("Unable to determine reseller ID. Please log in again.");
        setLoading(false);
        return;
      }

      const newDomain = (domain || "").trim();
      const currentDomain = domainData?.domain || "";
      
      // Process domain if it's provided and different from current
      if (newDomain !== "" && newDomain !== currentDomain) {
        const domainResult = await upsertMstResellerDomain(resellerId, newDomain);
        
        if (!domainResult.success) {
          setError(`Failed to save domain: ${domainResult.message || "Unknown error"}`);
          setLoading(false);
          return;
        }
        
        // Check if approval is needed
        if (domainResult.data && !domainResult.data.approved) {
          // Domain change requires approval
          setSuccess(true);
          setError("");
          setSuccessMessage("Domain change submitted successfully. It will be active after admin approval.");
          setTimeout(() => {
            setShowSuccessModal(true);
          }, 100);
          // Refresh domain data
          await fetchDomainData(resellerId);
        } else {
          // Domain was saved successfully (either auto-approved or same domain)
          setSuccess(true);
          setSuccessMessage("Domain updated successfully!");
          setTimeout(() => {
            setShowSuccessModal(true);
          }, 100);
          // Refresh domain data
          await fetchDomainData(resellerId);
        }
      } else if (newDomain === "" && currentDomain !== "") {
        // Domain removal - you might want to handle this differently
        setError("Please contact admin to remove your domain");
      } else {
        setError("No changes detected");
      }
    } catch (err) {
      console.error("Error updating domain:", err);
      setError(err.message || "An error occurred while updating domain");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted mt-3">Loading domain settings...</p>
        </div>
      </div>
    );
  }

  if (error && !resellerId) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }

  return (
    <div className="card h-100 p-0 radius-12">
      <div className="card-header border-bottom bg-base py-16 px-24">
        <h5 className="text-md text-primary-light mb-0">Custom Domain Settings</h5>
      </div>
      <div className="card-body p-24">
        {error && (
          <div className="alert alert-danger alert-dismissible fade show" role="alert">
            {error}
            <button
              type="button"
              className="btn-close"
              onClick={() => setError("")}
              aria-label="Close"
            ></button>
          </div>
        )}

        {success && !showSuccessModal && (
          <div className="alert alert-success alert-dismissible fade show" role="alert">
            {successMessage}
            <button
              type="button"
              className="btn-close"
              onClick={() => setSuccess(false)}
              aria-label="Close"
            ></button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-20">
            <label
              htmlFor='custom_domain'
              className='form-label fw-semibold text-primary-light text-sm mb-8'
            >
              Custom Domain
            </label>
            <input
              type='text'
              className='form-control radius-8'
              id='custom_domain'
              name='custom_domain'
              placeholder='example.com'
              value={domain}
              onChange={handleChange}
              disabled={loading}
            />
            <small className="text-muted mt-2 d-block">
              Enter your custom domain (e.g., www.reseller.com or reseller.com). Domain changes require admin approval before becoming active.
            </small>
            {domainData && (
              <div className="mt-3">
                <div className="d-flex align-items-center gap-2">
                  <span className="text-sm text-secondary-light">Status:</span>
                  {domainData.approved ? (
                    <span className="badge bg-success">
                      <Icon icon="material-symbols:check-circle-outline" className="icon me-1" />
                      Domain Approved
                    </span>
                  ) : (
                    <span className="badge bg-warning">
                      <Icon icon="material-symbols:pending-outline" className="icon me-1" />
                      Pending Approval
                    </span>
                  )}
                </div>
                {domainData.domain && (
                  <div className="mt-2">
                    <span className="text-sm text-secondary-light">Current Domain: </span>
                    <span className="text-sm fw-medium text-primary-light">{domainData.domain}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="d-flex align-items-center justify-content-start gap-3 mt-24">
            <button
              type='submit'
              className='btn btn-primary radius-8 px-24 py-12'
              disabled={loading || domain.trim() === (domainData?.domain || "")}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Updating...
                </>
              ) : (
                <>
                  <Icon icon="material-symbols:save-outline" className="icon me-2" />
                  Update Domain
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          setSuccess(false);
        }}
        title="Success"
        message={successMessage}
        onConfirm={() => {
          setShowSuccessModal(false);
          setSuccess(false);
        }}
      />
    </div>
  );
};

export default CustomDomainSettingsLayer;

