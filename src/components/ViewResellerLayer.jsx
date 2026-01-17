import { Icon } from "@iconify/react/dist/iconify.js";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getMstResellerById } from "@/hasura/mutations/reseller";

const ViewResellerLayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reseller, setReseller] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const currentId = id;
    console.log("useParams id:", currentId, typeof currentId);
    
    if (!currentId || typeof currentId !== 'string' || currentId.trim() === '') {
      setError("Reseller ID is missing");
      setLoading(false);
      return;
    }

    const resellerId = currentId.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(resellerId)) {
      setError(`Invalid reseller ID format: ${currentId}`);
      setLoading(false);
      return;
    }

    const fetchReseller = async () => {
      setLoading(true);
      setError("");
      try {
        console.log("Fetching reseller with ID:", resellerId);
        const result = await getMstResellerById(resellerId);
        console.log("GraphQL result:", result);
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

    fetchReseller();
  }, [id]);

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

  if (loading) {
    return (
      <div className='card h-100 p-0 radius-12'>
        <div className='card-body p-24'>
          <div className='text-center py-40'>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className='text-muted mt-3'>Loading reseller details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !reseller) {
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
    <div className='card h-100 p-0 radius-12'>
      <div className='card-body p-24'>
        <div className='d-flex justify-content-between align-items-center mb-24'>
          <h5 className='text-md text-primary-light mb-0'>Reseller Details</h5>
          <Link
            to={`/edit-reseller/${reseller.id}`}
            className='btn btn-primary btn-sm d-flex align-items-center gap-2'
          >
            <Icon icon='lucide:edit' className='icon' />
            Edit Reseller
          </Link>
        </div>

        <div className='row'>
          <div className='col-md-6'>
            <div className='card border mb-20'>
              <div className='card-body p-24'>
                <h6 className='text-sm text-primary-light mb-20'>Personal Information</h6>
                
                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>First Name</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {reseller.first_name || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Last Name</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {reseller.last_name || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Email</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {reseller.email || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Phone</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {reseller.phone || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Date of Birth</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {reseller.dob ? formatDate(reseller.dob) : "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Gender</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {reseller.gender || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Address</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {reseller.address || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>PAN Number</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {reseller.pan_number || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Aadhaar Number</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {reseller.aadhaar_number || "-"}
                  </p>
                </div>
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
                    {reseller.business_name || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Legal Name</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {reseller.legal_name || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Business Email</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {reseller.business_email || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Business Address</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {reseller.business_address || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>GSTIN</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {reseller.gstin || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>GSTIN Status</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {reseller.gstin_status || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Constitution of Business</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {reseller.constitution_of_business || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Nature of Business Activities</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {reseller.nature_bus_activities || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Referral Link</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {reseller.referral_link || "-"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className='row'>
          <div className='col-md-6'>
            <div className='card border mb-20'>
              <div className='card-body p-24'>
                <h6 className='text-sm text-primary-light mb-20'>Account Information</h6>
                
                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Reseller ID</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {reseller.id}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Wallet Balance</label>
                  <p className='text-md fw-medium text-success-600 mb-0'>
                    {formatCurrency(reseller.mst_wallet?.balance ?? 0)}
                  </p>
                </div>
                {reseller.mst_wallet && (
                  <>
                    <div className='mb-16'>
                      <label className='form-label text-xs text-secondary-light mb-4'>Total Credit</label>
                      <p className='text-md fw-medium text-success-600 mb-0'>
                        {formatCurrency(reseller.mst_wallet.credit_amount ?? 0)}
                      </p>
                    </div>
                    <div className='mb-16'>
                      <label className='form-label text-xs text-secondary-light mb-4'>Total Debit</label>
                      <p className='text-md fw-medium text-danger-600 mb-0'>
                        {formatCurrency(reseller.mst_wallet.debit_amount ?? 0)}
                      </p>
                    </div>
                    {reseller.mst_wallet.last_transaction_at && (
                      <div className='mb-16'>
                        <label className='form-label text-xs text-secondary-light mb-4'>Last Transaction</label>
                        <p className='text-md fw-medium text-primary-light mb-0'>
                          {formatDateTime(reseller.mst_wallet.last_transaction_at)}
                        </p>
                      </div>
                    )}
                  </>
                )}

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Status</label>
                  <div>
                    <span
                      className={`${
                        reseller.status
                          ? "bg-success-focus text-success-600 border border-success-main"
                          : "bg-danger-focus text-danger-600 border border-danger-main"
                      } px-24 py-4 radius-4 fw-medium text-sm`}
                    >
                      {reseller.status ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Signup Completed</label>
                  <div>
                    <span
                      className={`${
                        reseller.signup_completed
                          ? "bg-success-focus text-success-600 border border-success-main"
                          : "bg-warning-focus text-warning-600 border border-warning-main"
                      } px-24 py-4 radius-4 fw-medium text-sm`}
                    >
                      {reseller.signup_completed ? "Yes" : "No"}
                    </span>
                  </div>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Created Date</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {formatDate(reseller.created_at)}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Last Updated</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {formatDate(reseller.updated_at)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className='d-flex justify-content-end gap-3 mt-24'>
          <button
            type='button'
            className='btn btn-secondary'
            onClick={() => navigate("/reseller-list")}
          >
            Back to List
          </button>
          <Link
            to={`/edit-reseller/${reseller.id}`}
            className='btn btn-primary'
          >
            Edit Reseller
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ViewResellerLayer;
