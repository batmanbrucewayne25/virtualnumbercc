import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createMstSubscriptionPlan } from "@/hasura/mutations/subscriptionPlan";
import { getMstResellers } from "@/hasura/mutations/reseller";
import { getUserData } from "@/utils/auth";

const AddSubscriptionPlanLayer = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingResellers, setLoadingResellers] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resellers, setResellers] = useState([]);
  const [isReseller, setIsReseller] = useState(false);
  const [loggedInResellerId, setLoggedInResellerId] = useState(null);
  
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
      // Try to decode JWT token to get role, or check userData structure
      // The backend JWT includes role: 'admin' or 'reseller'
      try {
        const token = localStorage.getItem('authToken');
        if (token) {
          // JWT tokens are base64 encoded and have format: header.payload.signature
          // Decode the payload (second part) to get user role
          const payload = JSON.parse(atob(token.split('.')[1]));
          const userRole = payload.role;
          
          if (userRole === 'reseller') {
            setIsReseller(true);
            setLoggedInResellerId(userData.id);
            // Automatically set reseller_id for reseller users
            setFormData(prev => ({
              ...prev,
              reseller_id: userData.id
            }));
            setLoadingResellers(false);
            return;
          }
        }
      } catch (err) {
        console.error("Error decoding token:", err);
        // If token decode fails, assume admin and fetch resellers
      }
      
      // If admin or unable to determine, fetch resellers for dropdown
      fetchResellers();
    } else {
      // If no user data, fetch resellers (for admin access)
      fetchResellers();
    }
  }, []);

  const fetchResellers = async () => {
    setLoadingResellers(true);
    try {
      const result = await getMstResellers();
      if (result.success) {
        setResellers(result.data || []);
      } else {
        setError("Failed to load resellers");
      }
    } catch (err) {
      console.error("Error fetching resellers:", err);
      setError("An error occurred while loading resellers");
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
    // For resellers, reseller_id is auto-set, so only check other required fields
    if (!formData.plan_name || !formData.amount || !formData.duration_days) {
      setError("Please fill all required fields.");
      return false;
    }

    // If admin, check reseller_id is selected
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

    setLoading(true);
    try {
      // Use logged-in reseller ID if reseller, otherwise use selected reseller_id
      const resellerId = isReseller ? loggedInResellerId : formData.reseller_id;
      
      const result = await createMstSubscriptionPlan({
        reseller_id: resellerId,
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
        setError(result.message || "Failed to create subscription plan. Please try again.");
      }
    } catch (err) {
      console.error("Error creating subscription plan:", err);
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='card h-100 p-0 radius-12'>
      <div className='card-body p-24'>
        <div className='row justify-content-center'>
          <div className='col-xxl-8 col-xl-10 col-lg-12'>
            <div className='card border'>
              <div className='card-body p-40'>
                <h6 className='text-md text-primary-light mb-24'>
                  Add New Subscription Plan
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
                    Subscription plan created successfully! Redirecting...
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
                          Creating...
                        </>
                      ) : (
                        "Create Plan"
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

export default AddSubscriptionPlanLayer;
