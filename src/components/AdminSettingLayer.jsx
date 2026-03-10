import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect } from "react";
import { getMstAdminSetting, createMstAdminSetting, updateMstAdminSetting } from "@/hasura/mutations/adminSetting";

const AdminSettingLayer = () => {
  const [formData, setFormData] = useState({
    site_name: "",
    site_email: "",
    site_phone: "",
    maintenance_mode: false,
  });
  const [settingId, setSettingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadLoading, setLoadLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoadLoading(true);
      setError("");
      try {
        const result = await getMstAdminSetting();
        if (result.success && result.data) {
          const row = result.data;
          setSettingId(row.id);
          setFormData({
            site_name: row.site_name ?? "",
            site_email: row.site_email ?? "",
            site_phone: row.site_phone ?? "",
            maintenance_mode: row.maintenance_mode ?? false,
          });
        }
      } catch (err) {
        setError(err.message || "Failed to load admin settings");
      } finally {
        setLoadLoading(false);
      }
    };
    load();
  }, []);

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
      const payload = {
        site_name: formData.site_name || null,
        site_email: formData.site_email || null,
        site_phone: formData.site_phone || null,
        maintenance_mode: formData.maintenance_mode,
      };
      if (settingId) {
        const result = await updateMstAdminSetting(settingId, payload);
        if (result.success) {
          setSuccess(result.message || "Admin settings saved successfully!");
          setTimeout(() => setSuccess(""), 3000);
        } else {
          setError(result.message || "Failed to save admin settings");
        }
      } else {
        const result = await createMstAdminSetting(payload);
        if (result.success && result.data) {
          setSettingId(result.data.id);
          setSuccess(result.message || "Admin settings saved successfully!");
          setTimeout(() => setSuccess(""), 3000);
        } else {
          setError(result.message || "Failed to save admin settings");
        }
      }
    } catch (err) {
      setError(err.message || "Failed to save admin settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      

      {/* SMTP Template Card - Commented out for now */}
      {/* <div className='card h-100 p-0 radius-12 mb-24'>
        <div className='card-header border-bottom bg-base py-16 px-24'>
          <h5 className='text-md text-primary-light mb-0'>SMTP Template</h5>
        </div>
        <div className='card-body p-24'>
          <p className='text-secondary-light mb-16'>
            Manage email templates for reseller onboarding, password changes, wallet recharge, and other notifications.
          </p>
          <Link to="/admin-smtp-template" className='btn btn-primary'>
            <Icon icon='mdi:email-multiple-outline' className='icon me-2' />
            Manage Templates
          </Link>
        </div>
      </div> */}

      {/* General Settings Card */}
      <div className='card h-100 p-0 radius-12'>
        <div className='card-header border-bottom bg-base py-16 px-24'>
          <h5 className='text-md text-primary-light mb-0'>General Settings</h5>
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

        {loadLoading && (
          <div className='text-center py-24 text-secondary-light'>
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Loading settings...
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: loadLoading ? "none" : "block" }}>
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
                  disabled={loading || loadLoading}
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
                  disabled={loading || loadLoading}
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
                  disabled={loading || loadLoading}
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
                    disabled={loading || loadLoading}
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
              disabled={loading || loadLoading}
            >
              Cancel
            </button>
            <button
              type='submit'
              className='btn btn-primary radius-8'
              disabled={loading || loadLoading}
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
    </div>
  );
};

export default AdminSettingLayer;
