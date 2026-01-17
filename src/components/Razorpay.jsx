import { useState, useEffect } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { getUserData, getAuthToken } from "@/utils/auth";
import { getMstRazorpayConfigByResellerId, upsertMstRazorpayConfig } from "@/hasura/mutations/razorpayConfig";

const RazorpayPlanAdminStatic = () => {
  const [form, setForm] = useState({
    key_id: "",
    key_secret: "",
    webhook_secret: "",
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
          fetchRazorpayConfig(userData.id);
        } else {
          setError("Only resellers can configure Razorpay settings");
          setFetching(false);
        }
      } catch (err) {
        console.error("Error decoding token:", err);
        setError("Failed to authenticate user");
        setFetching(false);
      }
    } else {
      setError("Please login to configure Razorpay settings");
      setFetching(false);
    }
  }, []);

  const fetchRazorpayConfig = async (resellerId) => {
    setFetching(true);
    setError("");
    try {
      const result = await getMstRazorpayConfigByResellerId(resellerId);
      if (result.success) {
        if (result.data) {
          setForm({
            key_id: result.data.key_id || "",
            key_secret: "", // Don't show secret
            webhook_secret: "", // Don't show webhook secret
            is_active: result.data.is_active !== undefined ? result.data.is_active : true,
          });
        }
        // If no data found, keep form empty (new config)
      } else {
        setError(result.message || "Failed to fetch Razorpay configuration");
      }
    } catch (err) {
      console.error("Error fetching Razorpay config:", err);
      setError(err.message || "An error occurred while loading Razorpay configuration");
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

    if (!form.key_id || !form.key_secret) {
      setError("Please fill all required Razorpay fields (Key ID and Key Secret)");
      return;
    }

    setLoading(true);
    try {
      const result = await upsertMstRazorpayConfig(resellerId, {
        key_id: form.key_id.trim(),
        key_secret: form.key_secret.trim(),
        webhook_secret: form.webhook_secret.trim() || null,
        is_active: form.is_active,
      });

      if (result.success) {
        setSuccess(result.message || "Razorpay settings saved successfully");
        // Clear secret fields after save
        setForm(prev => ({ 
          ...prev, 
          key_secret: "",
          webhook_secret: ""
        }));
        setTimeout(() => {
          setSuccess("");
        }, 3000);
      } else {
        setError(result.message || "Failed to save Razorpay settings");
      }
    } catch (err) {
      console.error("Error saving Razorpay config:", err);
      setError(err.message || "An error occurred while saving Razorpay settings");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="row gy-4">
        <div className="col-lg-8 mx-auto">
          <div className="card radius-12 p-24 h-100">
            <div className='text-center py-40'>
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className='text-muted mt-3'>Loading Razorpay configuration...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="row gy-4">
      <div className="col-lg-8 mx-auto">
        <div className="card radius-12 p-24 h-100">
          <h5 className="mb-24">Razorpay Configuration</h5>

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
            {/* Key ID */}
            <div className="mb-20">
              <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                Key ID <span className="text-danger-600">*</span>
              </label>
              <input
                type="text"
                className="form-control radius-8"
                name="key_id"
                placeholder="rzp_live_xxxxx or rzp_test_xxxxx"
                value={form.key_id}
                onChange={handleChange}
                disabled={loading}
                autoComplete="off"
              />
            </div>

            {/* Key Secret */}
            <div className="mb-20">
              <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                Key Secret <span className="text-danger-600">*</span>
              </label>
              <input
                type="password"
                className="form-control radius-8"
                name="key_secret"
                placeholder="Enter Razorpay key secret"
                value={form.key_secret}
                onChange={handleChange}
                disabled={loading}
                autoComplete="off"
              />
            </div>

            {/* Webhook Secret */}
            <div className="mb-20">
              <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                Webhook Secret
              </label>
              <input
                type="password"
                className="form-control radius-8"
                name="webhook_secret"
                placeholder="Enter webhook secret (optional)"
                value={form.webhook_secret}
                onChange={handleChange}
                disabled={loading}
                autoComplete="off"
              />
            </div>

            {/* Active Status */}
            <div className="mb-24">
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

            {/* Action */}
            <button 
              type="submit" 
              className="btn btn-primary w-100"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Saving...
                </>
              ) : (
                "Save Razorpay Configuration"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RazorpayPlanAdminStatic;
