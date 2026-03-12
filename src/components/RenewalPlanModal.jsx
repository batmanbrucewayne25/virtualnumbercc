import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect } from "react";
import { getMstSubscriptionPlans } from "@/hasura/mutations/subscriptionPlan";
import { getUserData, getAuthToken } from "@/utils/auth";

const RenewalPlanModal = ({
  isOpen,
  onClose,
  virtualNumber,
  customer,
  onRenew,
  loading,
  apiError,
}) => {
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSelectedPlanId("");
      setError("");
      fetchSubscriptionPlans();
    }
  }, [isOpen]);

  const fetchSubscriptionPlans = async () => {
    setLoadingPlans(true);
    try {
      const userData = getUserData();
      if (!userData?.id) {
        setError("Unable to determine reseller ID.");
        setLoadingPlans(false);
        return;
      }

      const token = getAuthToken();
      let resellerId = customer?.reseller_id;
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          const role = payload.role || userData?.role;
          if (role === "reseller" && userData?.id) {
            resellerId = userData.id;
          }
        } catch (err) {
          console.error("Error decoding token:", err);
        }
      }

      const result = await getMstSubscriptionPlans(resellerId);
      if (result.success) {
        const filteredPlans = (result.data || []).filter(
          (plan) => plan.is_active === true
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!selectedPlanId) {
      setError("Please select a subscription plan.");
      return;
    }

    onRenew(virtualNumber, selectedPlanId);
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal show d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      tabIndex="-1"
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content radius-12">
          <div className="modal-header border-bottom">
            <h5 className="modal-title text-md text-primary-light">
              Renew Virtual Number
            </h5>
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
                  Select a subscription plan to send the renewal payment link to{" "}
                  <strong>{customer?.profile_name || customer?.email}</strong> for
                  virtual number{" "}
                  <strong>{virtualNumber?.virtual_number || "-"}</strong>
                </p>
              </div>

              {(apiError || error) && (
                <div className="alert alert-danger radius-8 mb-24" role="alert">
                  <Icon icon="material-symbols:error-outline" className="icon me-2" />
                  {apiError || error}
                </div>
              )}

              <div className="mb-20">
                <label
                  htmlFor="subscription_plan_id"
                  className="form-label fw-semibold text-primary-light text-sm mb-8"
                >
                  Subscription Plan <span className="text-danger-600">*</span>
                </label>
                {loadingPlans ? (
                  <div className="text-center py-3">
                    <div
                      className="spinner-border spinner-border-sm text-primary"
                      role="status"
                    >
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="text-sm text-muted mt-2">Loading plans...</p>
                  </div>
                ) : subscriptionPlans.length === 0 ? (
                  <div className="alert alert-warning radius-8">
                    <Icon icon="material-symbols:warning-outline" className="icon me-2" />
                    No active subscription plans found. Please add subscription plans
                    first.
                  </div>
                ) : (
                  <select
                    className="form-select radius-8"
                    id="subscription_plan_id"
                    name="subscription_plan_id"
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    disabled={loading}
                    required
                  >
                    <option value="">Select a plan</option>
                    {subscriptionPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.plan_name} - ₹{Number(plan.amount).toFixed(2)} (
                        {plan.duration_days} days)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="modal-footer border-top">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary d-inline-flex align-items-center gap-2"
                disabled={loading || loadingPlans || subscriptionPlans.length === 0}
              >
                {loading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm"
                      role="status"
                      aria-hidden="true"
                    />
                    Sending...
                  </>
                ) : (
                  <>
                    <Icon icon="mdi:email-send-outline" className="icon" style={{ fontSize: "1rem" }} />
                    Send Payment Link
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

export default RenewalPlanModal;
