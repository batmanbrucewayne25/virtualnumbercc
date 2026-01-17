import { Icon } from "@iconify/react/dist/iconify.js";
import { useState } from "react";

const AdminSettingLayer = () => {
  const [formData, setFormData] = useState({
    site_name: "",
    site_email: "",
    site_phone: "",
    site_address: "",
    currency: "INR",
    timezone: "Asia/Kolkata",
    maintenance_mode: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // TODO: Implement API call to save admin settings
      // For now, just simulate success
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      setSuccess("Admin settings saved successfully!");
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (err) {
      setError(err.message || "Failed to save admin settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='card h-100 p-0 radius-12'>
      <div className='card-header border-bottom bg-base py-16 px-24'>
        <h5 className='text-md text-primary-light mb-0'>Admin Settings</h5>
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

        <form onSubmit={handleSubmit}>
          <div className='row'>
            <div className='col-md-6'>
              <div className='mb-20'>
                <label
                  htmlFor='site_name'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  Site Name
                </label>
                <input
                  type='text'
                  className='form-control radius-8'
                  id='site_name'
                  name='site_name'
                  placeholder='Enter site name'
                  value={formData.site_name}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
            </div>

            <div className='col-md-6'>
              <div className='mb-20'>
                <label
                  htmlFor='site_email'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  Site Email
                </label>
                <input
                  type='email'
                  className='form-control radius-8'
                  id='site_email'
                  name='site_email'
                  placeholder='Enter site email'
                  value={formData.site_email}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
            </div>

            <div className='col-md-6'>
              <div className='mb-20'>
                <label
                  htmlFor='site_phone'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  Site Phone
                </label>
                <input
                  type='tel'
                  className='form-control radius-8'
                  id='site_phone'
                  name='site_phone'
                  placeholder='Enter site phone'
                  value={formData.site_phone}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
            </div>

            <div className='col-md-6'>
              <div className='mb-20'>
                <label
                  htmlFor='currency'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  Currency
                </label>
                <select
                  className='form-select radius-8'
                  id='currency'
                  name='currency'
                  value={formData.currency}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value='INR'>INR (₹)</option>
                  <option value='USD'>USD ($)</option>
                  <option value='EUR'>EUR (€)</option>
                  <option value='GBP'>GBP (£)</option>
                </select>
              </div>
            </div>

            <div className='col-md-6'>
              <div className='mb-20'>
                <label
                  htmlFor='timezone'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  Timezone
                </label>
                <select
                  className='form-select radius-8'
                  id='timezone'
                  name='timezone'
                  value={formData.timezone}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value='Asia/Kolkata'>Asia/Kolkata (IST)</option>
                  <option value='UTC'>UTC</option>
                  <option value='America/New_York'>America/New_York (EST)</option>
                  <option value='Europe/London'>Europe/London (GMT)</option>
                </select>
              </div>
            </div>

            <div className='col-md-12'>
              <div className='mb-20'>
                <label
                  htmlFor='site_address'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  Site Address
                </label>
                <textarea
                  className='form-control radius-8'
                  id='site_address'
                  name='site_address'
                  rows='3'
                  placeholder='Enter site address'
                  value={formData.site_address}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
            </div>

            <div className='col-md-12'>
              <div className='mb-20'>
                <div className='form-check form-switch'>
                  <input
                    className='form-check-input'
                    type='checkbox'
                    id='maintenance_mode'
                    name='maintenance_mode'
                    checked={formData.maintenance_mode}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  <label
                    className='form-check-label fw-semibold text-primary-light text-sm'
                    htmlFor='maintenance_mode'
                  >
                    Maintenance Mode
                  </label>
                </div>
                <small className='text-muted d-block mt-4'>
                  When enabled, the site will be in maintenance mode and only admins can access it.
                </small>
              </div>
            </div>
          </div>

          <div className='d-flex justify-content-end gap-2 mt-24'>
            <button
              type='button'
              className='btn btn-secondary radius-8'
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type='submit'
              className='btn btn-primary radius-8'
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Saving...
                </>
              ) : (
                "Save Settings"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminSettingLayer;
