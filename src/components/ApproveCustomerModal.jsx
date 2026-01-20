import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect } from "react";
import { getMstSubscriptionPlans } from "@/hasura/mutations/subscriptionPlan";
import { getUserData } from "@/utils/auth";

const ApproveCustomerModal = ({ isOpen, onClose, customer, onApprove, loading }) => {
  const [formData, setFormData] = useState({
    payment_method: "",
    subscription_plan_id: "",
    payment_reference_number: "",
    payment_amount: "",
    payment_date: "",
  });
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && formData.payment_method === "online") {
      fetchSubscriptionPlans();
    }
  }, [isOpen, formData.payment_method]);

  const fetchSubscriptionPlans = async () => {
    setLoadingPlans(true);
    try {
      const userData = getUserData();
      if (!userData || !userData.id) {
        setError("Unable to determine reseller ID.");
        setLoadingPlans(false);
        return;
      }

      const result = await getMstSubscriptionPlans();
      if (result.success) {
        // Filter plans for current reseller
        const filteredPlans = result.data.filter(
          (plan) => plan.reseller_id === userData.id && plan.is_active
        );
        setSubscriptionPlans(filteredPlans);
      }
    } catch (err) {
      console.error("Error fetching subscription plans:", err);
      setError("Failed to load subscription plans");
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.payment_method) {
      setError("Please select a payment method");
      return;
    }

    if (formData.payment_method === "offline") {
      if (!formData.payment_reference_number || !formData.payment_amount || !formData.payment_date) {
        setError("Please fill all required fields for offline payment");
        return;
      }

      const amount = parseFloat(formData.payment_amount);
      if (isNaN(amount) || amount <= 0) {
        setError("Payment amount must be a valid positive number");
        return;
      }
    } else if (formData.payment_method === "online") {
      if (!formData.subscription_plan_id) {
        setError("Please select a subscription plan");
        return;
      }
    }

    onApprove(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content radius-12">
          <div className="modal-header border-bottom">
            <h5 className="modal-title text-md text-primary-light">Approve Customer</h5>
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
              <div className="mb-20">
                <p className="text-sm text-secondary-light mb-0">
                  Approve customer: <strong>{customer?.profile_name || customer?.email}</strong>
                </p>
              </div>

              {error && (
                <div className='alert alert-danger radius-8 mb-24' role='alert'>
                  <Icon icon='material-symbols:error-outline' className='icon me-2' />
                  {error}
                </div>
              )}

              <div className="mb-20">
                <label
                  htmlFor='payment_method'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  Payment Method <span className='text-danger-600'>*</span>
                </label>
                <select
                  className='form-select radius-8'
                  id='payment_method'
                  name='payment_method'
                  value={formData.payment_method}
                  onChange={handleChange}
                  required
                  disabled={loading}
                >
                  <option value="">Select Payment Method</option>
                  <option value="offline">Offline Payment</option>
                  <option value="online">Online Payment</option>
                </select>
              </div>

              {/* Offline Payment Fields */}
              {formData.payment_method === "offline" && (
                <>
                  <div className="mb-20">
                    <label
                      htmlFor='payment_reference_number'
                      className='form-label fw-semibold text-primary-light text-sm mb-8'
                    >
                      Payment Reference Number <span className='text-danger-600'>*</span>
                    </label>
                    <input
                      type='text'
                      className='form-control radius-8'
                      id='payment_reference_number'
                      name='payment_reference_number'
                      placeholder='Enter payment reference number'
                      value={formData.payment_reference_number}
                      onChange={handleChange}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="mb-20">
                    <label
                      htmlFor='payment_amount'
                      className='form-label fw-semibold text-primary-light text-sm mb-8'
                    >
                      Payment Amount (₹) <span className='text-danger-600'>*</span>
                    </label>
                    <input
                      type='number'
                      step='0.01'
                      min='0'
                      className='form-control radius-8'
                      id='payment_amount'
                      name='payment_amount'
                      placeholder='Enter payment amount'
                      value={formData.payment_amount}
                      onChange={handleChange}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="mb-20">
                    <label
                      htmlFor='payment_date'
                      className='form-label fw-semibold text-primary-light text-sm mb-8'
                    >
                      Payment Date <span className='text-danger-600'>*</span>
                    </label>
                    <input
                      type='date'
                      className='form-control radius-8'
                      id='payment_date'
                      name='payment_date'
                      value={formData.payment_date}
                      onChange={handleChange}
                      required
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              {/* Online Payment Fields */}
              {formData.payment_method === "online" && (
                <div className="mb-20">
                  <label
                    htmlFor='subscription_plan_id'
                    className='form-label fw-semibold text-primary-light text-sm mb-8'
                  >
                    Subscription Plan <span className='text-danger-600'>*</span>
                  </label>
                  {loadingPlans ? (
                    <div className="text-center py-3">
                      <div className="spinner-border spinner-border-sm text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      <p className="text-sm text-muted mt-2">Loading plans...</p>
                    </div>
                  ) : subscriptionPlans.length === 0 ? (
                    <div className="alert alert-warning radius-8">
                      <Icon icon='material-symbols:warning-outline' className='icon me-2' />
                      No active subscription plans found. Please create a subscription plan first.
                    </div>
                  ) : (
                    <select
                      className='form-select radius-8'
                      id='subscription_plan_id'
                      name='subscription_plan_id'
                      value={formData.subscription_plan_id}
                      onChange={handleChange}
                      required
                      disabled={loading}
                    >
                      <option value="">Select Subscription Plan</option>
                      {subscriptionPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.plan_name} - ₹{Number(plan.amount).toFixed(2)} ({plan.duration_days} days)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
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
                disabled={loading || (formData.payment_method === "online" && subscriptionPlans.length === 0)}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Approving...
                  </>
                ) : (
                  "Approve"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ApproveCustomerModal;

