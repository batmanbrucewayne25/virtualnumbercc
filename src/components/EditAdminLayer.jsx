import { Icon } from "@iconify/react/dist/iconify.js";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getMstSuperAdminById, updateMstSuperAdmin } from "@/hasura/mutations/admin";
import { getMstRoles } from "@/hasura/mutations/role";

const EditAdminLayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [roles, setRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    role_id: "",
    status: true,
  });

  useEffect(() => {
    const fetchRoles = async () => {
      setLoadingRoles(true);
      try {
        const result = await getMstRoles();
        if (result.success) {
          // Filter only active roles
          const activeRoles = (result.data || []).filter(role => role.is_active);
          setRoles(activeRoles);
        } else {
          console.error("Failed to load roles:", result.message);
        }
      } catch (err) {
        console.error("Error fetching roles:", err);
      } finally {
        setLoadingRoles(false);
      }
    };

    fetchRoles();
  }, []);

  useEffect(() => {
    const currentId = id;
    console.log("useParams id:", currentId, typeof currentId); // Debug log
    
    // Validate id exists and is a non-empty string
    if (!currentId || typeof currentId !== 'string' || currentId.trim() === '') {
      setError("Admin ID is missing");
      setFetching(false);
      return;
    }

    // Validate id is a valid UUID
    const adminId = currentId.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(adminId)) {
      setError(`Invalid admin ID format: ${currentId}`);
      setFetching(false);
      return;
    }

    const fetchAdmin = async () => {
      setFetching(true);
      setError("");
      try {
        console.log("Fetching admin with ID:", adminId); // Debug log
        const result = await getMstSuperAdminById(adminId);
        console.log("GraphQL result:", result); // Debug log
        if (result.success && result.data) {
          setFormData({
            first_name: result.data.first_name || "",
            last_name: result.data.last_name || "",
            email: result.data.email || "",
            phone: result.data.phone || "",
            role_id: result.data.role_id || "",
            status: result.data.status !== undefined ? result.data.status : true,
          });
        } else {
          setError(result.message || "Admin not found");
        }
    } catch (err) {
        console.error("Error fetching admin:", err);
        setError("An error occurred while loading admin details");
      } finally {
        setFetching(false);
      }
    };

    fetchAdmin();
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError("");
  };

  const validateForm = () => {
    if (!formData.first_name || !formData.last_name || !formData.email) {
      setError("Please fill all required fields.");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!validateForm()) {
      return;
    }

    const currentId = id;
    console.log("Update - useParams id:", currentId, typeof currentId); // Debug log
    
    // Validate id exists and is a non-empty string
    if (!currentId || typeof currentId !== 'string' || currentId.trim() === '') {
      setError("Admin ID is missing");
      return;
    }

    // Validate id is a valid UUID
    const adminId = currentId.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(adminId)) {
      setError(`Invalid admin ID format: ${currentId}`);
      return;
    }

    setLoading(true);
    try {
      const result = await updateMstSuperAdmin(adminId, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone || null,
        role_id: formData.role_id || null,
        status: formData.status,
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate("/admin-list");
        }, 2000);
      } else {
        setError(result.message || "Failed to update admin. Please try again.");
      }
    } catch (err) {
      console.error("Error updating admin:", err);
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
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

  return (
    <div className='card h-100 p-0 radius-12'>
      <div className='card-body p-24'>
        <div className='row justify-content-center'>
          <div className='col-xxl-8 col-xl-10 col-lg-12'>
            <div className='card border'>
              <div className='card-body p-40'>
                <h6 className='text-md text-primary-light mb-24'>
                  Edit Admin
                </h6>

                {error && (
                  <div className='alert alert-danger radius-8 mb-24' role='alert'>
                    <Icon icon='material-symbols:error-outline' className='icon me-2' />
                    {error}
                  </div>
                )}

                {success && (
                  <div className='alert alert-success radius-8 mb-24' role='alert'>
                    <Icon icon='material-symbols:check-circle-outline' className='icon me-2' />
                    Admin updated successfully! Redirecting...
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className='row'>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='first_name'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          First Name <span className='text-danger-600'>*</span>
                        </label>
                        <input
                          type='text'
                          className='form-control radius-8'
                          id='first_name'
                          name='first_name'
                          placeholder='Enter first name'
                          value={formData.first_name}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    </div>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='last_name'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          Last Name <span className='text-danger-600'>*</span>
                        </label>
                        <input
                          type='text'
                          className='form-control radius-8'
                          id='last_name'
                          name='last_name'
                          placeholder='Enter last name'
                          value={formData.last_name}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className='mb-20'>
                    <label
                      htmlFor='email'
                      className='form-label fw-semibold text-primary-light text-sm mb-8'
                    >
                      Email <span className='text-danger-600'>*</span>
                    </label>
                    <input
                      type='email'
                      className='form-control radius-8'
                      id='email'
                      name='email'
                      placeholder='Enter email address'
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className='mb-20'>
                    <label
                      htmlFor='phone'
                      className='form-label fw-semibold text-primary-light text-sm mb-8'
                    >
                      Phone Number
                    </label>
                    <input
                      type='tel'
                      className='form-control radius-8'
                      id='phone'
                      name='phone'
                      placeholder='Enter phone number'
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </div>

                  <div className='mb-20'>
                    <label
                      htmlFor='role_id'
                      className='form-label fw-semibold text-primary-light text-sm mb-8'
                    >
                      Role
                    </label>
                    <select
                      className='form-control radius-8'
                      id='role_id'
                      name='role_id'
                      value={formData.role_id}
                      onChange={handleChange}
                      disabled={loadingRoles}
                    >
                      <option value=''>Select a role (Optional)</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.role_name}
                        </option>
                      ))}
                    </select>
                    {loadingRoles && (
                      <small className='text-muted d-block mt-2'>
                        Loading roles...
                      </small>
                    )}
                  </div>

                  <div className='mb-24'>
                    <div className='form-check'>
                      <input
                        className='form-check-input'
                        type='checkbox'
                        id='status'
                        name='status'
                        checked={formData.status}
                        onChange={handleChange}
                      />
                      <label className='form-check-label text-sm' htmlFor='status'>
                        Active Status
                      </label>
                    </div>
                  </div>

                  <div className='d-flex align-items-center justify-content-center gap-3'>
                    <button
                      type='button'
                      className='border border-danger-600 bg-hover-danger-200 text-danger-600 text-md px-56 py-11 radius-8'
                      onClick={() => navigate("/admin-list")}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      type='submit'
                      className='btn btn-primary border border-primary-600 text-md px-56 py-12 radius-8'
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Updating...
                        </>
                      ) : (
                        "Update Admin"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditAdminLayer;
