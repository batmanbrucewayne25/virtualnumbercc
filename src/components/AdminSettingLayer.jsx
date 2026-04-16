import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect } from "react";
import { getMstAdminSetting, createMstAdminSetting, updateMstAdminSetting } from "@/hasura/mutations/adminSetting";
import { getApiBaseUrl } from "@/utils/apiUrl.js";

const AdminSettingLayer = () => {
  const [formData, setFormData] = useState({
    site_name: "",
    site_email: "",
    site_phone: "",
    maintenance_mode: false,
  });
  const [settingId, setSettingId] = useState(null);
  /** Last persisted maintenance_mode (DB); used to detect off→on / on→off for reseller mail */
  const [lastSavedMaintenanceMode, setLastSavedMaintenanceMode] = useState(false);
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
          const maintenance = row.maintenance_mode ?? false;
          setLastSavedMaintenanceMode(maintenance);
          setFormData({
            site_name: row.site_name ?? "",
            site_email: row.site_email ?? "",
            site_phone: row.site_phone ?? "",
            maintenance_mode: maintenance,
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

  const appendMaintenanceBroadcastMessage = async (
    baseMessage,
    turningMaintenanceOn,
    turningMaintenanceOff,
  ) => {
    if (!turningMaintenanceOn && !turningMaintenanceOff) return baseMessage;
    let msg = baseMessage;
    try {
      const API_BASE_URL = getApiBaseUrl();
      const path = turningMaintenanceOn
        ? "/admin/maintenance/notify-resellers-enabled"
        : "/admin/maintenance/notify-resellers-disabled";
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${typeof window !== "undefined" ? (localStorage.getItem("authToken") || "") : ""}`,
        },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const text = await response.text();
        console.warn("[Maintenance broadcast] API error:", response.status, text);
        msg += " Reseller notification emails could not be sent (see console).";
        return msg;
      }
      const data = await response.json();
      if (data.results?.failed > 0) {
        msg += ` Reseller emails: ${data.results.sent} sent, ${data.results.failed} failed.`;
      } else {
        msg += ` Reseller emails: ${data.results?.sent ?? 0} sent.`;
      }
    } catch (apiErr) {
      console.warn("[Maintenance broadcast] Request failed:", apiErr);
      msg += " Reseller notification emails could not be sent (network error).";
    }
    return msg;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const prevMaintenance = lastSavedMaintenanceMode;
    const turningMaintenanceOn =
      formData.maintenance_mode === true && prevMaintenance === false;
    const turningMaintenanceOff =
      formData.maintenance_mode === false && prevMaintenance === true;

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
          let msg = result.message || "Admin settings saved successfully!";
          msg = await appendMaintenanceBroadcastMessage(
            msg,
            turningMaintenanceOn,
            turningMaintenanceOff,
          );
          setLastSavedMaintenanceMode(formData.maintenance_mode);
          setSuccess(msg);
          setTimeout(() => setSuccess(""), 5000);
        } else {
          setError(result.message || "Failed to save admin settings");
        }
      } else {
        const result = await createMstAdminSetting(payload);
        if (result.success && result.data) {
          setSettingId(result.data.id);
          let msg = result.message || "Admin settings saved successfully!";
          msg = await appendMaintenanceBroadcastMessage(
            msg,
            turningMaintenanceOn,
            turningMaintenanceOff,
          );
          setLastSavedMaintenanceMode(formData.maintenance_mode);
          setSuccess(msg);
          setTimeout(() => setSuccess(""), 5000);
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
                  When enabled, reseller and other non-admin users are redirected to the maintenance page
                  and cannot use dashboard routes. Super admins and admins keep full access. ClientHub shows a
                  maintenance notice and may still be opened (public onboarding).
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
