import { useState, useEffect } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { getUserData, getAuthToken } from "@/utils/auth";
import { getRazorpayConfig, saveRazorpayConfig, getWebhookUrl } from "@/services/razorpayApi";

const RazorpayConfigLayer = () => {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [resellerId, setResellerId] = useState(null);
  const [razorpayConfig, setRazorpayConfig] = useState(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [copied, setCopied] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    key_id: "",
    key_secret: "",
    webhook_secret: ""
  });

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
      // Fetch config and webhook URL in parallel
      const [configResult, webhookResult] = await Promise.all([
        getRazorpayConfig(resellerId),
        getWebhookUrl(resellerId)
      ]);

      if (configResult.success && configResult.data) {
        setRazorpayConfig(configResult.data);
        setFormData({
          key_id: configResult.data.key_id || "",
          key_secret: "", // Never pre-fill secrets
          webhook_secret: ""
        });
      }

      if (webhookResult.success && webhookResult.data?.webhook_url) {
        setWebhookUrl(webhookResult.data.webhook_url);
      }
    } catch (err) {
      console.error("Error fetching Razorpay config:", err);
      // Don't show error if config just doesn't exist yet
      if (!err.message?.includes('not found')) {
        setError(err.message || "An error occurred while loading Razorpay configuration");
      }
    } finally {
      setFetching(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!resellerId) {
      setError("Reseller ID not found. Please login again.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await saveRazorpayConfig({
        reseller_id: resellerId,
        key_id: formData.key_id || null,
        key_secret: formData.key_secret || null,
        webhook_secret: formData.webhook_secret || null
      });

      if (result.success) {
        setSuccess("Razorpay configuration saved successfully!");
        setRazorpayConfig(result.data);
        if (result.data?.webhook_url) {
          setWebhookUrl(result.data.webhook_url);
        }
        // Clear sensitive fields
        setFormData(prev => ({
          ...prev,
          key_secret: "",
          webhook_secret: ""
        }));
        setTimeout(() => setSuccess(""), 5000);
      } else {
        setError(result.message || "Failed to save Razorpay configuration");
      }
    } catch (err) {
      console.error("Error saving Razorpay config:", err);
      setError(err.message || "An error occurred while saving Razorpay configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = webhookUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (fetching) {
    return (
      <div className="row gy-4">
        <div className="col-lg-10 mx-auto">
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

  const isConfigured = razorpayConfig?.key_id && razorpayConfig?.is_active;

  return (
    <div className="row gy-4">
      <div className="col-lg-10 mx-auto">
        <div className="card radius-12 p-24 h-100">
          <h5 className="mb-24">
            <Icon icon='logos:razorpay' className='me-2' />
            Razorpay Payment Gateway Configuration
          </h5>

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

          {/* Webhook URL Section */}
          <div className="mb-24 p-20 bg-info-focus border border-info-main radius-8">
            <div className="d-flex align-items-center gap-3 mb-16">
              <Icon icon='material-symbols:webhook' className='icon text-info-600 text-2xl' />
              <div>
                <h6 className="mb-0 text-info-600">Your Webhook URL</h6>
                <p className="text-sm text-muted mb-0 mt-4">
                  Copy this URL and paste it in your Razorpay Dashboard under Webhooks
                </p>
              </div>
            </div>
            
            {webhookUrl ? (
              <div className="d-flex gap-2 align-items-center">
                <input
                  type="text"
                  className="form-control font-monospace bg-white"
                  value={webhookUrl}
                  readOnly
                />
                <button
                  type="button"
                  className={`btn ${copied ? 'btn-success' : 'btn-primary'} px-16`}
                  onClick={handleCopyWebhookUrl}
                >
                  <Icon 
                    icon={copied ? 'material-symbols:check' : 'material-symbols:content-copy'} 
                    className='icon' 
                  />
                </button>
              </div>
            ) : (
              <p className="text-muted mb-0">Webhook URL will be generated after saving your configuration.</p>
            )}
          </div>

          {/* Setup Instructions */}
          <div className="mb-24 p-20 bg-warning-focus border border-warning-main radius-8">
            <div className="d-flex align-items-start gap-3">
              <Icon icon='material-symbols:info-outline' className='icon text-warning-600 text-2xl flex-shrink-0 mt-4' />
              <div>
                <h6 className="mb-12 text-warning-600">Setup Instructions</h6>
                <ol className="text-sm text-muted mb-0 ps-16">
                  <li className="mb-8">Log in to your <a href="https://dashboard.razorpay.com" target="_blank" rel="noopener noreferrer" className="text-primary">Razorpay Dashboard</a></li>
                  <li className="mb-8">Go to <strong>Settings → API Keys</strong> and generate your API keys</li>
                  <li className="mb-8">Enter your <strong>Key ID</strong> and <strong>Key Secret</strong> below</li>
                  <li className="mb-8">Go to <strong>Settings → Webhooks</strong> in Razorpay Dashboard</li>
                  <li className="mb-8">Click <strong>"Add New Webhook"</strong> and paste the webhook URL above</li>
                  <li className="mb-8">Select these events: <code>payment.captured</code>, <code>payment.failed</code>, <code>payment.authorized</code>, <code>refund.created</code></li>
                  <li className="mb-8">Copy the <strong>Webhook Secret</strong> from Razorpay and paste it below</li>
                  <li>Click <strong>"Create Webhook"</strong> in Razorpay Dashboard</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Status Indicator */}
          {isConfigured && (
            <div className="mb-24 p-20 bg-success-focus border border-success-main radius-8">
              <div className="d-flex align-items-center gap-3">
                <Icon icon='material-symbols:check-circle' className='icon text-success-600 text-2xl' />
                <div>
                  <h6 className="mb-0 text-success-600">Razorpay Configured</h6>
                  <p className="text-sm text-muted mb-0 mt-4">
                    Key ID: {razorpayConfig.key_id?.substring(0, 12)}...
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Configuration Form */}
          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-md-6 mb-20">
                <label className="form-label fw-semibold text-primary-light">
                  Razorpay Key ID <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="key_id"
                  className="form-control radius-8"
                  placeholder="rzp_test_xxxxxxxxxxxxx"
                  value={formData.key_id}
                  onChange={handleInputChange}
                  required
                />
                <small className="text-muted">Your Razorpay API Key ID (starts with rzp_test_ or rzp_live_)</small>
              </div>

              <div className="col-md-6 mb-20">
                <label className="form-label fw-semibold text-primary-light">
                  Razorpay Key Secret
                </label>
                <input
                  type="password"
                  name="key_secret"
                  className="form-control radius-8"
                  placeholder={isConfigured ? "••••••••••••••••" : "Enter key secret"}
                  value={formData.key_secret}
                  onChange={handleInputChange}
                />
                <small className="text-muted">Leave blank to keep existing secret</small>
              </div>

              <div className="col-md-6 mb-20">
                <label className="form-label fw-semibold text-primary-light">
                  Webhook Secret
                </label>
                <input
                  type="password"
                  name="webhook_secret"
                  className="form-control radius-8"
                  placeholder={razorpayConfig?.webhook_secret ? "••••••••••••••••" : "Enter webhook secret from Razorpay"}
                  value={formData.webhook_secret}
                  onChange={handleInputChange}
                />
                <small className="text-muted">For webhook signature verification (recommended)</small>
              </div>
            </div>

            <div className="d-flex gap-3 mt-24">
              <button 
                type="submit" 
                className="btn btn-primary px-32"
                disabled={loading || !formData.key_id}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <Icon icon='material-symbols:save' className='icon me-2' />
                    Save Configuration
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Info Section */}
          <div className="mt-24 p-20 bg-base border radius-8">
            <h6 className="mb-12">
              <Icon icon='material-symbols:info' className='icon me-2 text-info-600' />
              How it works
            </h6>
            <ul className="text-sm text-muted mb-0 ps-16">
              <li className="mb-8">When your customers make a payment, Razorpay will send a notification to the webhook URL above</li>
              <li className="mb-8">All successful payments will be automatically recorded in your transaction history</li>
              <li className="mb-8">The super admin can view all your payment transactions for monitoring purposes</li>
              <li className="mb-8">All money goes directly to your Razorpay account - no intermediaries</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RazorpayConfigLayer;
