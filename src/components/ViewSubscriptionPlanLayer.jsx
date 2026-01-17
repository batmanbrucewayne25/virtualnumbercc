import { Icon } from "@iconify/react/dist/iconify.js";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getMstSubscriptionPlanById } from "@/hasura/mutations/subscriptionPlan";

const ViewSubscriptionPlanLayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const currentId = id;
    console.log("useParams id:", currentId, typeof currentId);
    
    if (!currentId || typeof currentId !== 'string' || currentId.trim() === '') {
      setError("Subscription plan ID is missing");
      setLoading(false);
      return;
    }

    const planId = currentId.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(planId)) {
      setError(`Invalid subscription plan ID format: ${currentId}`);
      setLoading(false);
      return;
    }

    const fetchPlan = async () => {
      setLoading(true);
      setError("");
      try {
        console.log("Fetching subscription plan with ID:", planId);
        const result = await getMstSubscriptionPlanById(planId);
        console.log("GraphQL result:", result);
        if (result.success && result.data) {
          setPlan(result.data);
        } else {
          setError(result.message || "Subscription plan not found");
        }
      } catch (err) {
        console.error("Error fetching subscription plan:", err);
        setError("An error occurred while loading subscription plan details");
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [id]);

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (amount, currency = 'INR') => {
    if (amount === null || amount === undefined) return `${currency} 0.00`;
    return `${currency} ${Number(amount).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className='card h-100 p-0 radius-12'>
        <div className='card-body p-24'>
          <div className='text-center py-40'>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className='text-muted mt-3'>Loading subscription plan details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className='card h-100 p-0 radius-12'>
        <div className='card-body p-24'>
          <div className='alert alert-danger radius-8' role='alert'>
            <Icon icon='material-symbols:error-outline' className='icon me-2' />
            {error || "Subscription plan not found"}
          </div>
          <Link to="/subscription-plan-list" className='btn btn-primary mt-3'>
            Back to Subscription Plans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='card h-100 p-0 radius-12'>
      <div className='card-body p-24'>
        <div className='d-flex justify-content-between align-items-center mb-24'>
          <h5 className='text-md text-primary-light mb-0'>Subscription Plan Details</h5>
          <Link
            to={`/edit-subscription-plan/${plan.id}`}
            className='btn btn-primary btn-sm d-flex align-items-center gap-2'
          >
            <Icon icon='lucide:edit' className='icon' />
            Edit Plan
          </Link>
        </div>

        <div className='row'>
          <div className='col-md-6'>
            <div className='card border mb-20'>
              <div className='card-body p-24'>
                <h6 className='text-sm text-primary-light mb-20'>Plan Information</h6>
                
                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Plan Name</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {plan.plan_name || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Amount</label>
                  <p className='text-md fw-medium text-success-600 mb-0'>
                    {formatCurrency(plan.amount, plan.currency)}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Currency</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {plan.currency || "INR"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Duration (Days)</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {plan.duration_days ? `${plan.duration_days} days` : "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Status</label>
                  <div>
                    <span
                      className={`${
                        plan.is_active
                          ? "bg-success-focus text-success-600 border border-success-main"
                          : "bg-danger-focus text-danger-600 border border-danger-main"
                      } px-24 py-4 radius-4 fw-medium text-sm`}
                    >
                      {plan.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className='col-md-6'>
            <div className='card border mb-20'>
              <div className='card-body p-24'>
                <h6 className='text-sm text-primary-light mb-20'>Reseller Information</h6>
                
                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Reseller</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {plan.mst_reseller?.business_name || plan.mst_reseller?.email || "-"}
                  </p>
                  {plan.mst_reseller?.email && (
                    <p className='text-xs text-muted mb-0 mt-1'>
                      {plan.mst_reseller.email}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className='row'>
          <div className='col-md-12'>
            <div className='card border mb-20'>
              <div className='card-body p-24'>
                <h6 className='text-sm text-primary-light mb-20'>Razorpay Information</h6>
                
                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Razorpay Plan ID</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {plan.razorpay_plan_id || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Razorpay Link ID</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {plan.razorpay_link_id || "-"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className='row'>
          <div className='col-md-12'>
            <div className='card border mb-20'>
              <div className='card-body p-24'>
                <h6 className='text-sm text-primary-light mb-20'>Additional Information</h6>
                
                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Description</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {plan.description || "-"}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Plan ID</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {plan.id}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Created Date</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {formatDate(plan.created_at)}
                  </p>
                </div>

                <div className='mb-16'>
                  <label className='form-label text-xs text-secondary-light mb-4'>Last Updated</label>
                  <p className='text-md fw-medium text-primary-light mb-0'>
                    {formatDate(plan.updated_at)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className='d-flex justify-content-end gap-3 mt-24'>
          <button
            type='button'
            className='btn btn-secondary'
            onClick={() => navigate("/subscription-plan-list")}
          >
            Back to List
          </button>
          <Link
            to={`/edit-subscription-plan/${plan.id}`}
            className='btn btn-primary'
          >
            Edit Plan
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ViewSubscriptionPlanLayer;
