import { Icon } from "@iconify/react/dist/iconify.js";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getMstSubscriptionPlanById, updateMstSubscriptionPlan } from "@/hasura/mutations/subscriptionPlan";
import { getMstResellers } from "@/hasura/mutations/reseller";
import { getUserData } from "@/utils/auth";

const EditSubscriptionPlanLayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [loadingResellers, setLoadingResellers] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resellers, setResellers] = useState([]);
  const [isReseller, setIsReseller] = useState(false);
  
  const [formData, setFormData] = useState({
    reseller_id: "",
    plan_name: "",
    amount: "",
    currency: "INR",
    duration_days: "",
    razorpay_plan_id: "",
    razorpay_link_id: "",
    is_active: true,
    description: "",
  });

  useEffect(() => {
    // Check if logged in user is a reseller
    const userData = getUserData();
    if (userData && userData.id) {
      try {
        const token = localStorage.getItem('authToken');
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const userRole = payload.role;
          if (userRole === 'reseller') {
            setIsReseller(true);
          }
        }
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    }

    // Fetch plan details and resellers
    const currentId = id;
    console.log("useParams id:", currentId, typeof currentId);
    
    if (!currentId || typeof currentId !== 'string' || currentId.trim() === '') {
      setError("Subscription plan ID is missing");
      setFetching(false);
      return;
    }

    const planId = currentId.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(planId)) {
      setError(`Invalid subscription plan ID format: ${currentId}`);
      setFetching(false);
      return;
    }

    const fetchPlan = async () => {
      setFetching(true);
      setError("");
      try {
        console.log("Fetching subscription plan with ID:", planId);
        const result = await getMstSubscriptionPlanById(planId);
        console.log("GraphQL result:", result);
        if (result.success && result.data) {
          setFormData({
            reseller_id: result.data.reseller_id || "",
            plan_name: result.data.plan_name || "",
            amount: result.data.amount?.toString() || "",
            currency: result.data.currency || "INR",
            duration_days: result.data.duration_days?.toString() || "",
            razorpay_plan_id: result.data.razorpay_plan_id || "",
            razorpay_link_id: result.data.razorpay_link_id || "",
            is_active: result.data.is_active !== undefined ? result.data.is_active : true,
            description: result.data.description || "",
          });
          
          // If not reseller, fetch resellers for dropdown
          if (!isReseller) {
            fetchResellers();
          }
        } else {
          setError(result.message || "Subscription plan not found");
        }
      } catch (err) {
        console.error("Error fetching subscription plan:", err);
        setError("An error occurred while loading subscription plan details");
      } finally {
        setFetching(false);
      }
    };

    fetchPlan();
  }, [id, isReseller]);

  const fetchResellers = async () => {
    setLoadingResellers(true);
    try {
      const result = await getMstResellers();
      if (result.success) {
        setResellers(result.data || []);
      }
    } catch (err) {
      console.error("Error fetching resellers:", err);
    } finally {
      setLoadingResellers(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError("");
  };

  const validateForm = () => {
    if (!formData.plan_name || !formData.amount || !formData.duration_days) {
      setError("Please fill all required fields.");
      return false;
    }

    if (!isReseller && !formData.reseller_id) {
      setError("Please select a reseller.");
      return false;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setError("Amount must be a positive number.");
      return false;
    }

    const durationDays = parseInt(formData.duration_days);
    if (isNaN(durationDays) || durationDays <= 0) {
      setError("Duration days must be a positive number.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!validateForm()) {
      return;
    }

    const currentId = id;
    console.log("Update - useParams id:", currentId, typeof currentId);
    
    if (!currentId || typeof currentId !== 'string' || currentId.trim() === '') {
      setError("Subscription plan ID is missing");
      return;
    }

    const planId = currentId.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(planId)) {
      setError(`Invalid subscription plan ID format: ${currentId}`);
      return;
    }

    setLoading(true);
    try {
      const result = await updateMstSubscriptionPlan(planId, {
        reseller_id: isReseller ? formData.reseller_id : formData.reseller_id,
        plan_name: formData.plan_name,
        amount: parseFloat(formData.amount),
        currency: formData.currency || "INR",
        duration_days: parseInt(formData.duration_days),
        razorpay_plan_id: formData.razorpay_plan_id || null,
        razorpay_link_id: formData.razorpay_link_id || null,
        is_active: formData.is_active,
        description: formData.description || null,
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate("/subscription-plan-list");
        }, 2000);
      } else {
        setError(result.message || "Failed to update subscription plan. Please try again.");
      }
    } catch (err) {
      console.error("Error updating subscription plan:", err);
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
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

  return (
    <div className='card h-100 p-0 radius-12'>
      <div className='card-body p-24'>
        <div className='row justify-content-center'>
          <div className='col-xxl-8 col-xl-10 col-lg-12'>
            <div className='card border'>
              <div className='card-body p-40'>
                <h6 className='text-md text-primary-light mb-24'>
                  Edit Subscription Plan
                </h6>

                {error && (
                  <div className='alert alert-danger radius-8 mb-24' role='alert'>
                    <Icon icon='material-symbols:error-outline' className='icon me-2' />
                    {error}
                  </div>
                )}

                {success && (
                  <div className='alert alert-success radius-8 mb-24' role='alert'>
                    <Icon icon='material-symbols:check-circle-outline' className='icon me-2' />
                    Subscription plan updated successfully! Redirecting...
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  {!isReseller && (
                    <div className='mb-20'>
                      <label
                        htmlFor='reseller_id'
                        className='form-label fw-semibold text-primary-light text-sm mb-8'
                      >
                        Reseller <span className='text-danger-600'>*</span>
                      </label>
                      <select
                        className='form-select radius-8'
                        id='reseller_id'
                        name='reseller_id'
                        value={formData.reseller_id}
                        onChange={handleChange}
                        required={!isReseller}
                        disabled={loadingResellers}
                      >
                        <option value=''>Select Reseller</option>
                        {resellers.map((reseller) => (
                          <option key={reseller.id} value={reseller.id}>
                            {reseller.business_name || reseller.email} ({reseller.first_name} {reseller.last_name})
                          </option>
                        ))}
                      </select>
                      {loadingResellers && (
                        <small className='text-muted'>Loading resellers...</small>
                      )}
                    </div>
                  )}

                  <div className='mb-20'>
                    <label
                      htmlFor='plan_name'
                      className='form-label fw-semibold text-primary-light text-sm mb-8'
                    >
                      Plan Name <span className='text-danger-600'>*</span>
                    </label>
                    <input
                      type='text'
                      className='form-control radius-8'
                      id='plan_name'
                      name='plan_name'
                      placeholder='Enter plan name'
                      value={formData.plan_name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className='row'>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='amount'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          Amount <span className='text-danger-600'>*</span>
                        </label>
                        <input
                          type='number'
                          step='0.01'
                          min='0'
                          className='form-control radius-8'
                          id='amount'
                          name='amount'
                          placeholder='Enter amount'
                          value={formData.amount}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    </div>
                    <div className='col-sm-6'>
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
                        >
                          <option value='INR'>INR</option>
                          <option value='USD'>USD</option>
                          <option value='EUR'>EUR</option>
                          <option value='GBP'>GBP</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className='mb-20'>
                    <label
                      htmlFor='duration_days'
                      className='form-label fw-semibold text-primary-light text-sm mb-8'
                    >
                      Duration (Days) <span className='text-danger-600'>*</span>
                    </label>
                    <input
                      type='number'
                      min='1'
                      className='form-control radius-8'
                      id='duration_days'
                      name='duration_days'
                      placeholder='Enter duration in days (e.g., 30, 90, 365)'
                      value={formData.duration_days}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className='row'>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='razorpay_plan_id'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          Razorpay Plan ID
                        </label>
                        <input
                          type='text'
                          className='form-control radius-8'
                          id='razorpay_plan_id'
                          name='razorpay_plan_id'
                          placeholder='Enter Razorpay plan ID'
                          value={formData.razorpay_plan_id}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='razorpay_link_id'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          Razorpay Link ID
                        </label>
                        <input
                          type='text'
                          className='form-control radius-8'
                          id='razorpay_link_id'
                          name='razorpay_link_id'
                          placeholder='Enter Razorpay link ID'
                          value={formData.razorpay_link_id}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                  </div>

                  <div className='mb-20'>
                    <label
                      htmlFor='description'
                      className='form-label fw-semibold text-primary-light text-sm mb-8'
                    >
                      Description
                    </label>
                    <textarea
                      className='form-control radius-8'
                      id='description'
                      name='description'
                      rows='4'
                      placeholder='Enter plan description'
                      value={formData.description}
                      onChange={handleChange}
                    />
                  </div>

                  <div className='mb-24'>
                    <div className='form-check'>
                      <input
                        className='form-check-input'
                        type='checkbox'
                        id='is_active'
                        name='is_active'
                        checked={formData.is_active}
                        onChange={handleChange}
                      />
                      <label className='form-check-label text-sm' htmlFor='is_active'>
                        Active Status
                      </label>
                    </div>
                  </div>

                  <div className='d-flex align-items-center justify-content-center gap-3'>
                    <button
                      type='button'
                      className='border border-danger-600 bg-hover-danger-200 text-danger-600 text-md px-56 py-11 radius-8'
                      onClick={() => navigate("/subscription-plan-list")}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      type='submit'
                      className='btn btn-primary border border-primary-600 text-md px-56 py-12 radius-8'
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Updating...
                        </>
                      ) : (
                        "Update Plan"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditSubscriptionPlanLayer;
