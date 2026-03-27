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
  const [webhookSecretCopied, setWebhookSecretCopied] = useState(false);
  const [showKeySecret, setShowKeySecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  
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

  // Helper function to generate a random webhook secret
  const generateRandomWebhookSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
  };

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
        // Auto-generate webhook secret by default
        setFormData({
          key_id: configResult.data.key_id || "",
          key_secret: "", // Never pre-fill from server (not returned); user rotates by typing new
          webhook_secret:
            configResult.data.webhook_secret?.trim() ||
            generateRandomWebhookSecret(),
        });
      } else {
        setFormData({
          key_id: "",
          key_secret: "",
          webhook_secret: generateRandomWebhookSecret(),
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
        // Keep secrets in the form so the user can still see / copy what was saved this session
        setFormData(prev => ({
          ...prev,
          key_id: result.data?.key_id ?? prev.key_id,
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

  const handleCopyWebhookSecret = async () => {
    const text = (formData.webhook_secret || "").trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setWebhookSecretCopied(true);
      setTimeout(() => setWebhookSecretCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy webhook secret:", err);
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setWebhookSecretCopied(true);
      setTimeout(() => setWebhookSecretCopied(false), 2000);
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

  const generateWebhookSecret = () => {
    // Generate a random 32-character secret (similar to Razorpay webhook secrets)
    const secret = generateRandomWebhookSecret();
    setFormData(prev => ({
      ...prev,
      webhook_secret: secret
    }));
    // Keep secret hidden by default - user can click eye icon to reveal
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
          {/* <h5 className="mb-24">
            <Icon icon='logos:razorpay' className='me-2' />
            Razorpay Payment Gateway Configuration
          </h5> */}

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

          {/* Setup Instructions - button opens modal */}
          <div className="mb-24">
            <button
              type="button"
              className="btn btn-outline-warning radius-8 px-20 py-10 d-inline-flex align-items-center gap-2"
              onClick={() => setShowSetupModal(true)}
            >
              <Icon icon='material-symbols:info-outline' className='icon text-lg' />
              View Setup Instructions
            </button>
          </div>

          {/* Setup Instructions Modal */}
          {showSetupModal && (
            <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
              <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                <div className="modal-content radius-12">
                  <div className="modal-header border-bottom">
                    <h5 className="modal-title text-md text-warning-600 d-flex align-items-center gap-2">
                      <Icon icon='material-symbols:info-outline' className='icon text-lg' />
                      Setup Instructions
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setShowSetupModal(false)}
                      aria-label="Close"
                    />
                  </div>
                  <div className="modal-body p-24">
                    <ol className="text-sm text-muted mb-0 ps-16">
                      <li className="mb-8">Log in to your <a href="https://dashboard.razorpay.com" target="_blank" rel="noopener noreferrer" className="text-primary">Razorpay Dashboard</a></li>
                      <li className="mb-8">Go to <strong>Settings → API Keys</strong> and generate your API keys</li>
                      <li className="mb-8">Enter your <strong>Key ID</strong> and <strong>Key Secret</strong> below</li>
                      <li className="mb-8">Go to <strong>Settings → Webhooks</strong> in Razorpay Dashboard</li>
                      <li className="mb-8">Click <strong>"Add New Webhook"</strong> and paste the webhook URL above</li>
                      <li className="mb-8">Select these events: <code>payment.captured</code>, <code>payment.failed</code>, <code>subscription.activated</code>, <code>subscription.charged</code></li>
                      <li className="mb-8">Copy the <strong>Webhook Secret</strong> from Razorpay and paste it below</li>
                      <li>Click <strong>"Create Webhook"</strong> in Razorpay Dashboard</li>
                    </ol>
                  </div>
                  <div className="modal-footer border-top">
                    <button
                      type="button"
                      className="btn btn-primary radius-8"
                      onClick={() => setShowSetupModal(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status Indicator */}
          {/* {isConfigured && (
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
          )} */}

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
                  placeholder=""
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
                {isConfigured && (
                  <small className="d-block text-muted mb-8">
                    Leave blank to keep your existing secret; enter a new value only to replace it.
                  </small>
                )}
                <div className="position-relative">
                  <input
                    type={showKeySecret ? "text" : "password"}
                    name="key_secret"
                    className="form-control radius-8 pe-48"
                    value={formData.key_secret}
                    onChange={handleInputChange}
                  />
                  <button
                    type="button"
                    className="btn btn-unstyled position-absolute end-0 top-50 translate-middle-y me-12"
                    onClick={() => setShowKeySecret(!showKeySecret)}
                    style={{ zIndex: 10 }}
                  >
                    <Icon 
                      icon={showKeySecret ? 'solar:eye-closed-bold' : 'solar:eye-bold'} 
                      className='icon text-secondary-light text-lg hover-text-primary' 
                    />
                  </button>
                </div>
                </div>

              <div className="col-md-6 mb-20">
                <label className="form-label fw-semibold text-primary-light">
                  Webhook Secret
                </label>
                <div className="d-flex gap-2 align-items-start flex-wrap">
                  <div className="position-relative flex-grow-1" style={{ minWidth: "12rem" }}>
                    <input
                      type={showWebhookSecret ? "text" : "password"}
                      name="webhook_secret"
                      className="form-control radius-8 pe-48" 
                      value={formData.webhook_secret}
                      onChange={handleInputChange}
                    />
                    <button
                      type="button"
                      className="btn btn-unstyled position-absolute end-0 top-50 translate-middle-y me-12"
                      onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                      style={{ zIndex: 10 }}
                    >
                      <Icon 
                        icon={showWebhookSecret ? 'solar:eye-closed-bold' : 'solar:eye-bold'} 
                        className='icon text-secondary-light text-lg hover-text-primary' 
                      />
                    </button>
                  </div>
                  <button
                    type="button"
                    className={`btn ${webhookSecretCopied ? "btn-success" : "btn-outline-secondary"} radius-8 px-16 py-8 flex-shrink-0`}
                    onClick={handleCopyWebhookSecret}
                    disabled={!formData.webhook_secret?.trim()}
                    title="Copy webhook secret"
                  >
                    <Icon
                      icon={webhookSecretCopied ? "material-symbols:check" : "material-symbols:content-copy"}
                      className="icon text-sm"
                    />
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-primary radius-8 px-16 py-8 flex-shrink-0"
                    onClick={generateWebhookSecret}
                    title="Generate random webhook secret"
                  >
                    <Icon icon='solar:refresh-bold' className='icon text-sm' />
                  </button>
                </div>
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

          
        </div>
      </div>
    </div>
  );
};

export default RazorpayConfigLayer;
