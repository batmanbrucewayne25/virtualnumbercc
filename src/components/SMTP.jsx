import { useState, useEffect } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { getUserData, getAuthToken } from "@/utils/auth";
import { getMstSmtpConfigByResellerId, upsertMstSmtpConfig } from "@/hasura/mutations/smtpConfig";

const SMTPSettings = () => {
  const [form, setForm] = useState({
    host: "",
    port: "",
    username: "",
    password: "",
    from_email: "",
    from_name: "",
    is_active: true,
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
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
          fetchSmtpConfig(userData.id);
        } else {
          setError("Only resellers can configure SMTP settings");
          setFetching(false);
        }
      } catch (err) {
        console.error("Error decoding token:", err);
        setError("Failed to authenticate user");
        setFetching(false);
      }
    } else {
      setError("Please login to configure SMTP settings");
      setFetching(false);
    }
  }, []);

  const fetchSmtpConfig = async (resellerId) => {
    setFetching(true);
    setError("");
    try {
      const result = await getMstSmtpConfigByResellerId(resellerId);
      if (result.success && result.data) {
        setForm({
          host: result.data.host || "",
          port: result.data.port?.toString() || "",
          username: result.data.username || "",
          password: "", // Don't show password
          from_email: result.data.from_email || "",
          from_name: result.data.from_name || "",
          is_active: result.data.is_active !== undefined ? result.data.is_active : true,
        });
      }
    } catch (err) {
      console.error("Error fetching SMTP config:", err);
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ 
      ...form, 
      [name]: type === "checkbox" ? checked : value 
    });
    setError("");
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!resellerId) {
      setError("Reseller ID not found. Please login again.");
      return;
    }

    const requiredFields = [
      "host",
      "port",
      "username",
      "password",
      "from_email",
    ];

    for (let field of requiredFields) {
      if (!form[field]) {
        setError("Please fill all required SMTP fields");
        return;
      }
    }

    const port = parseInt(form.port);
    if (isNaN(port) || port < 1 || port > 65535) {
      setError("Please enter a valid SMTP port (1-65535)");
      return;
    }

    setLoading(true);
    try {
      const result = await upsertMstSmtpConfig(resellerId, {
        host: form.host.trim(),
        port: port,
        username: form.username.trim(),
        password: form.password, // Will be encrypted by backend
        from_email: form.from_email.trim(),
        from_name: form.from_name.trim() || null,
        is_active: form.is_active,
      });

      if (result.success) {
        setSuccess(result.message || "SMTP settings saved successfully");
        // Clear password field after save
        setForm(prev => ({ ...prev, password: "" }));
        setTimeout(() => {
          setSuccess("");
        }, 3000);
      } else {
        setError(result.message || "Failed to save SMTP settings");
      }
    } catch (err) {
      console.error("Error saving SMTP config:", err);
      setError(err.message || "An error occurred while saving SMTP settings");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className='card h-100 p-0 radius-12 overflow-hidden'>
        <div className='card-body p-40'>
          <div className='text-center py-40'>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className='text-muted mt-3'>Loading SMTP configuration...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='card h-100 p-0 radius-12 overflow-hidden'>
      <div className='card-body p-40'>
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
        <form onSubmit={handleSubmit}>
          <div className='row'>

            {/* Host */}
            <div className='col-sm-12'>
              <div className='mb-20'>
                <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                  Host <span className='text-danger-600'>*</span>
                </label>
                <input
                  type='text'
                  name='host'
                  className='form-control radius-8'
                  placeholder='smtp.yourdomain.com'
                  value={form.host}
                  onChange={handleChange}
                  disabled={loading}
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Port */}
            <div className='col-sm-6'>
              <div className='mb-20'>
                <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                  Port <span className='text-danger-600'>*</span>
                </label>
                <input
                  type='number'
                  name='port'
                  className='form-control radius-8'
                  placeholder='465 or 587'
                  value={form.port}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Username */}
            <div className='col-sm-6'>
              <div className='mb-20'>
                <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                  Username <span className='text-danger-600'>*</span>
                </label>
                <input
                  type='text'
                  name='username'
                  className='form-control radius-8'
                  placeholder='no-reply@yourdomain.com'
                  value={form.username}
                  onChange={handleChange}
                  disabled={loading}
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Password */}
            <div className='col-sm-12'>
              <div className='mb-20'>
                <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                  Password <span className='text-danger-600'>*</span>
                </label>
                <input
                  type='password'
                  name='password'
                  className='form-control radius-8'
                  placeholder='App password'
                  value={form.password}
                  onChange={handleChange}
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {/* From Email */}
            <div className='col-sm-6'>
              <div className='mb-20'>
                <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                  From Email <span className='text-danger-600'>*</span>
                </label>
                <input
                  type='email'
                  name='from_email'
                  className='form-control radius-8'
                  placeholder='support@yourdomain.com'
                  value={form.from_email}
                  onChange={handleChange}
                  disabled={loading}
                  autoComplete="off"
                />
              </div>
            </div>

            {/* From Name */}
            <div className='col-sm-6'>
              <div className='mb-20'>
                <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                  From Name
                </label>
                <input
                  type='text'
                  name='from_name'
                  className='form-control radius-8'
                  placeholder='Your Company Name'
                  value={form.from_name}
                  onChange={handleChange}
                  disabled={loading}
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Active Status */}
            <div className='col-sm-12'>
              <div className='mb-20'>
                <div className='form-check form-switch'>
                  <input
                    className='form-check-input'
                    type='checkbox'
                    id='is_active'
                    name='is_active'
                    checked={form.is_active}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  <label
                    className='form-check-label fw-semibold text-primary-light text-sm'
                    htmlFor='is_active'
                  >
                    Active
                  </label>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className='col-sm-12'>
              <div className='d-flex align-items-center justify-content-center gap-3 mt-24'>
                <button
                  type='reset'
                  className='border border-danger-600 bg-hover-danger-200 text-danger-600 px-40 py-11 radius-8'
                  onClick={() => {
                    fetchSmtpConfig(resellerId);
                    setError("");
                    setSuccess("");
                  }}
                  disabled={loading}
                >
                  Reset
                </button>

                <button
                  type='submit'
                  className='btn btn-primary border border-primary-600 px-40 py-11 radius-8'
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Saving...
                    </>
                  ) : (
                    "Save SMTP Settings"
                  )}
                </button>
              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
};

export default SMTPSettings;
