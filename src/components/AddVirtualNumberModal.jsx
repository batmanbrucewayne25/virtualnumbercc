import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect } from "react";
import { createMstVirtualNumber } from "@/hasura/mutations/virtualNumber";
import { getMstSubscriptionPlans } from "@/hasura/mutations/subscriptionPlan";
import { getUserData, getAuthToken } from "@/utils/auth";

const AddVirtualNumberModal = ({ isOpen, onClose, customer, onSuccess }) => {
  const [formData, setFormData] = useState({
    virtual_number: "",
    call_forwarding_number: "",
    purchase_date: "",
    expiry_date: "",
    status: "active",
    subscription_plan_id: "",
    is_auto_renew: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [resellerId, setResellerId] = useState(null);

  useEffect(() => {
    if (isOpen && customer) {
      // Initialize form with customer's phone as default call forwarding number
      setFormData({
        virtual_number: "",
        call_forwarding_number: customer.phone || "",
        purchase_date: new Date().toISOString().split("T")[0],
        expiry_date: (() => {
          const date = new Date();
          date.setDate(date.getDate() + 360);
          return date.toISOString().split("T")[0];
        })(),
        status: "active",
        subscription_plan_id: "",
        is_auto_renew: false,
      });
      setError("");
      setSuccess(false);

      // Get user role and reseller ID
      const token = getAuthToken();
      const userData = getUserData();

      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const role = payload.role || userData?.role;
          setUserRole(role);
          
          // Determine reseller_id: use customer's reseller_id or logged-in reseller's ID
          if (role === 'reseller' && userData?.id) {
            setResellerId(userData.id);
          } else if (customer.reseller_id) {
            setResellerId(customer.reseller_id);
          }
        } catch (err) {
          console.error("Error decoding token:", err);
        }
      }

      // Fetch subscription plans
      fetchSubscriptionPlans();
    }
  }, [isOpen, customer]);

  const fetchSubscriptionPlans = async () => {
    try {
      const token = getAuthToken();
      const userData = getUserData();
      let resellerIdForPlans = undefined;
      
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const role = payload.role || userData?.role;
          if (role === 'reseller' && userData?.id) {
            resellerIdForPlans = userData.id;
          }
        } catch (err) {
          console.error("Error decoding token:", err);
        }
      }

      const result = await getMstSubscriptionPlans(resellerIdForPlans);
      if (result.success) {
        // Filter only active plans
        const activePlans = (result.data || []).filter(plan => plan.is_active);
        setSubscriptionPlans(activePlans);
      }
    } catch (err) {
      console.error("Error fetching subscription plans:", err);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.virtual_number.trim()) {
        setError("Virtual number is required");
        setLoading(false);
        return;
      }

      if (!resellerId) {
        setError("Unable to determine reseller ID");
        setLoading(false);
        return;
      }

      const result = await createMstVirtualNumber({
        customer_id: customer.id,
        reseller_id: resellerId,
        virtual_number: formData.virtual_number.trim(),
        call_forwarding_number: formData.call_forwarding_number.trim() || null,
        purchase_date: formData.purchase_date || null,
        expiry_date: formData.expiry_date || null,
        status: formData.status || "active",
        subscription_plan_id: formData.subscription_plan_id || null,
        is_auto_renew: formData.is_auto_renew || false,
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setError(result.message || "Failed to create virtual number");
      }
    } catch (err) {
      console.error("Error creating virtual number:", err);
      setError(err.message || "An error occurred while creating virtual number");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content radius-16 bg-base">
          <div className="modal-header border-bottom">
            <h5 className="modal-title text-md text-primary-light">Add Virtual Number</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={loading}
              aria-label="Close"
            />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body p-24">
              {error && (
                <div className="alert alert-danger radius-8 mb-24" role="alert">
                  <Icon icon="material-symbols:error-outline" className="icon me-2" />
                  {error}
                </div>
              )}

              {success && (
                <div className="alert alert-success radius-8 mb-24" role="alert">
                  <Icon icon="material-symbols:check-circle-outline" className="icon me-2" />
                  Virtual number created successfully!
                </div>
              )}

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                    Virtual Number <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control radius-8"
                    name="virtual_number"
                    value={formData.virtual_number}
                    onChange={handleChange}
                    placeholder="e.g., +91XXXXXXXXXX"
                    required
                    disabled={loading}
                  />
                  <small className="text-muted">Enter the virtual number</small>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                    Call Forward Number
                  </label>
                  <input
                    type="text"
                    className="form-control radius-8"
                    name="call_forwarding_number"
                    value={formData.call_forwarding_number}
                    onChange={handleChange}
                    placeholder="Customer mobile number"
                    disabled={loading}
                  />
                  <small className="text-muted">Number to forward calls to (defaults to customer's phone)</small>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    className="form-control radius-8"
                    name="purchase_date"
                    value={formData.purchase_date}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  <small className="text-muted">Date when virtual number was purchased</small>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    className="form-control radius-8"
                    name="expiry_date"
                    value={formData.expiry_date}
                    onChange={handleChange}
                    min={formData.purchase_date}
                    disabled={loading}
                  />
                  <small className="text-muted">Date when virtual number expires (defaults to 360 days from purchase)</small>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                    Status
                  </label>
                  <select
                    className="form-select radius-8"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="expired">Expired</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                    Subscription Plan
                  </label>
                  <select
                    className="form-select radius-8"
                    name="subscription_plan_id"
                    value={formData.subscription_plan_id}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    <option value="">Select Subscription Plan (Optional)</option>
                    {subscriptionPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.plan_name} - ₹{Number(plan.amount).toFixed(2)} ({plan.duration_days} days)
                      </option>
                    ))}
                  </select>
                  <small className="text-muted">Optional: Link to a subscription plan</small>
                </div>

                <div className="col-md-12">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      name="is_auto_renew"
                      id="is_auto_renew"
                      checked={formData.is_auto_renew}
                      onChange={handleChange}
                      disabled={loading}
                    />
                    <label className="form-check-label" htmlFor="is_auto_renew">
                      Enable Auto Renew
                    </label>
                  </div>
                  <small className="text-muted d-block mt-2">Automatically renew the virtual number when it expires</small>
                </div>
              </div>
            </div>
            <div className="modal-footer border-top">
              <button
                type="button"
                className="btn btn-secondary radius-8"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary radius-8"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Creating...
                  </>
                ) : (
                  <>
                    <Icon icon="ic:baseline-plus" className="icon me-2" />
                    Add Virtual Number
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

export default AddVirtualNumberModal;

