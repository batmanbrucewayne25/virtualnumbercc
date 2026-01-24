import { useState, useEffect } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { getUserData, getAuthToken } from "@/utils/auth";
import { getMstWhatsappConfigByAdminId, upsertMstWhatsappConfigByAdminId } from "@/hasura/mutations/adminWhatsappConfig";

const AdminWhatsAppLayer = () => {
  const [form, setForm] = useState({
    api_key: "",
    api_url: "",
    phone_number_id: "",
    business_account_id: "",
    is_active: true,
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [adminId, setAdminId] = useState(null);

  useEffect(() => {
    // Get logged-in admin ID
    const userData = getUserData();
    const token = getAuthToken();
    
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if ((payload.role === 'admin' || payload.role === 'super_admin') && userData?.id) {
          setAdminId(userData.id);
          fetchWhatsappConfig(userData.id);
        } else {
          setError("Only admins can configure WhatsApp settings");
          setFetching(false);
        }
      } catch (err) {
        console.error("Error decoding token:", err);
        setError("Failed to authenticate user");
        setFetching(false);
      }
    } else {
      setError("Please login to configure WhatsApp settings");
      setFetching(false);
    }
  }, []);

  const fetchWhatsappConfig = async (adminId) => {
    setFetching(true);
    setError("");
    try {
      const result = await getMstWhatsappConfigByAdminId(adminId);
      if (result.success && result.data) {
        setForm({
          api_key: result.data.api_key || "", // Populate API key from response
          api_url: result.data.api_url || "",
          phone_number_id: result.data.phone_number_id || "",
          business_account_id: result.data.business_account_id || "",
          is_active: result.data.is_active !== undefined ? result.data.is_active : true,
        });
      }
    } catch (err) {
      console.error("Error fetching WhatsApp config:", err);
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

    if (!adminId) {
      setError("Admin ID not found. Please login again.");
      return;
    }

    if (!form.api_url || !form.phone_number_id) {
      setError("Please fill all required WhatsApp fields (API URL, Phone Number ID)");
      return;
    }

    // Check if this is a new config (API key required) or update (API key optional)
    const existingConfig = await getMstWhatsappConfigByAdminId(adminId);
    const isNewConfig = !existingConfig.success || !existingConfig.data;
    
    if (isNewConfig && !form.api_key) {
      setError("API Key is required when creating a new WhatsApp configuration");
      return;
    }

    setLoading(true);
    try {
      const result = await upsertMstWhatsappConfigByAdminId(adminId, {
        api_key: form.api_key.trim(),
        api_url: form.api_url.trim(),
        phone_number_id: form.phone_number_id.trim(),
        business_account_id: form.business_account_id.trim() || null,
        is_active: form.is_active,
      });

      if (result.success) {
        setSuccess(result.message || "WhatsApp settings saved successfully");
        // Clear API key field after save
        setForm(prev => ({ ...prev, api_key: "" }));
        setTimeout(() => {
          setSuccess("");
        }, 3000);
      } else {
        setError(result.message || "Failed to save WhatsApp settings");
      }
    } catch (err) {
      console.error("Error saving WhatsApp config:", err);
      setError(err.message || "An error occurred while saving WhatsApp settings");
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
            <p className='text-muted mt-3'>Loading WhatsApp configuration...</p>
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
            {/* API Key */}
            <div className='col-sm-12'>
              <div className='mb-20'>
                <label
                  htmlFor='api_key'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  API Key <span className='text-danger-600'>*</span>
                  <small className='text-secondary ms-2'>(Required only for new configuration)</small>
                </label>
                <input
                  type='password'
                  className='form-control radius-8'
                  id='api_key'
                  name='api_key'
                  placeholder='Enter Meta WhatsApp API key (leave empty to keep existing)'
                  value={form.api_key}
                  onChange={handleChange}
                  disabled={loading}
                  autoComplete="off"
                />
                <small className='text-secondary'>
                  Leave empty if updating an existing configuration. Only required when creating a new configuration.
                </small>
              </div>
            </div>

            {/* API URL */}
            <div className='col-sm-12'>
              <div className='mb-20'>
                <label
                  htmlFor='api_url'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  API URL <span className='text-danger-600'>*</span>
                </label>
                <input
                  type='url'
                  className='form-control radius-8'
                  id='api_url'
                  name='api_url'
                  placeholder='https://graph.facebook.com/v18.0'
                  value={form.api_url}
                  onChange={handleChange}
                  disabled={loading}
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Phone Number ID */}
            <div className='col-sm-6'>
              <div className='mb-20'>
                <label
                  htmlFor='phone_number_id'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  Phone Number ID <span className='text-danger-600'>*</span>
                </label>
                <input
                  type='text'
                  className='form-control radius-8'
                  id='phone_number_id'
                  name='phone_number_id'
                  placeholder='WhatsApp phone number ID'
                  value={form.phone_number_id}
                  onChange={handleChange}
                  disabled={loading}
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Business Account ID */}
            <div className='col-sm-6'>
              <div className='mb-20'>
                <label
                  htmlFor='business_account_id'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  Business Account ID
                </label>
                <input
                  type='text'
                  className='form-control radius-8'
                  id='business_account_id'
                  name='business_account_id'
                  placeholder='Meta business account ID (optional)'
                  value={form.business_account_id}
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
            <div className='d-flex align-items-center justify-content-center gap-3 mt-24'>
              <button
                type='button'
                className='border border-danger-600 bg-hover-danger-200 text-danger-600 text-md px-40 py-11 radius-8'
                onClick={() => {
                  fetchWhatsappConfig(adminId);
                  setError("");
                  setSuccess("");
                }}
                disabled={loading}
              >
                Reset
              </button>
              <button
                type='submit'
                className='btn btn-primary border border-primary-600 text-md px-24 py-12 radius-8'
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Saving...
                  </>
                ) : (
                  "Save Change"
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminWhatsAppLayer;

