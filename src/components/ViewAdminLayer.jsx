import { Icon } from "@iconify/react/dist/iconify.js";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getMstSuperAdminById } from "@/hasura/mutations/admin";

const ViewAdminLayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const currentId = id;
    console.log("useParams id:", currentId, typeof currentId); // Debug log
    
    // Validate id exists and is a non-empty string
    if (!currentId || typeof currentId !== 'string' || currentId.trim() === '') {
      setError("Admin ID is missing");
      setLoading(false);
      return;
    }

    // Validate id is a valid UUID
    const adminId = currentId.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(adminId)) {
      setError(`Invalid admin ID format: ${currentId}`);
      setLoading(false);
      return;
    }

    const fetchAdmin = async () => {
      setLoading(true);
      setError("");
      try {
        console.log("Fetching admin with ID:", adminId); // Debug log
        const result = await getMstSuperAdminById(adminId);
        console.log("GraphQL result:", result); // Debug log
        if (result.success && result.data) {
          setAdmin(result.data);
        } else {
          setError(result.message || "Admin not found");
        }
    } catch (err) {
        console.error("Error fetching admin:", err);
        setError("An error occurred while loading admin details");
      } finally {
        setLoading(false);
      }
    };

    fetchAdmin();
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

  if (loading) {
    return (
      <div className='card h-100 p-0 radius-12'>
        <div className='card-body p-24'>
          <div className='text-center py-40'>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className='text-muted mt-3'>Loading admin details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !admin) {
    return (
      <div className='card h-100 p-0 radius-12'>
        <div className='card-body p-24'>
          <div className='alert alert-danger radius-8' role='alert'>
            <Icon icon='material-symbols:error-outline' className='icon me-2' />
            {error || "Admin not found"}
          </div>
          <Link to="/admin-list" className='btn btn-primary mt-3'>
            Back to Admin List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='card h-100 p-0 radius-12'>
      <div className='card-body p-24'>
        <div className='d-flex justify-content-between align-items-center mb-24'>
          <h5 className='text-md text-primary-light mb-0'>Admin Details</h5>
          <Link
            to={`/edit-admin/${admin.id}`}
            className='btn btn-primary btn-sm d-flex align-items-center gap-2'
          >
            <Icon icon='lucide:edit' className='icon' />
            Edit Admin
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
                    {admin.first_name || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Last Name</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {admin.last_name || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Email</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {admin.email || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Phone</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {admin.phone || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Status</label>
                  <div>
                    <span
                      className={`${
                        admin.status
                          ? "bg-success-focus text-success-600 border border-success-main"
                          : "bg-danger-focus text-danger-600 border border-danger-main"
                      } px-24 py-4 radius-4 fw-medium text-sm`}
                    >
                      {admin.status ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className='col-md-6'>
            <div className='card border mb-20'>
              <div className='card-body p-24'>
                <h6 className='text-sm text-primary-light mb-20'>Account Information</h6>
                
                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Admin ID</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    #{admin.id}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Created Date</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {formatDate(admin.created_at)}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Last Updated</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {formatDate(admin.updated_at)}
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
            onClick={() => navigate("/admin-list")}
          >
            Back to List
          </button>
          <Link
            to={`/edit-admin/${admin.id}`}
            className='btn btn-primary'
          >
            Edit Admin
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ViewAdminLayer;
