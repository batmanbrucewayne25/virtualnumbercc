import { Icon } from "@iconify/react/dist/iconify.js";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getMstSubscriptionPlans, deleteMstSubscriptionPlan } from "@/hasura/mutations/subscriptionPlan";

const SubscriptionPlanListLayer = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getMstSubscriptionPlans();
      if (result.success) {
        setPlans(result.data || []);
      } else {
        setError("Failed to load subscription plans");
      }
    } catch (err) {
      console.error("Error fetching subscription plans:", err);
      setError("An error occurred while loading subscription plans");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete subscription plan "${name}"?`)) {
      return;
    }

    try {
      const result = await deleteMstSubscriptionPlan(id);
      if (result.success) {
        // Refresh the list
        fetchPlans();
      } else {
        alert(result.message || "Failed to delete subscription plan");
      }
    } catch (err) {
      console.error("Error deleting subscription plan:", err);
      alert("An error occurred while deleting subscription plan");
    }
  };

  // Filter plans based on search and status
  const filteredPlans = plans.filter((plan) => {
    const matchesSearch =
      searchTerm === "" ||
      plan.plan_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.mst_reseller?.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.mst_reseller?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.razorpay_plan_id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && plan.is_active) ||
      (statusFilter === "inactive" && !plan.is_active);

    return matchesSearch && matchesStatus;
  });

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

  return (
    <div className='card h-100 p-0 radius-12'>
      <div className='card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between'>
        <div className='d-flex align-items-center flex-wrap gap-3'>
          <form className='navbar-search'>
            <input
              type='text'
              className='bg-base h-40-px w-auto'
              name='search'
              placeholder='Search by plan name, reseller, or Razorpay ID'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Icon icon='ion:search-outline' className='icon' />
          </form>
          <select
            className='form-select form-select-sm w-auto ps-12 py-6 radius-12 h-40-px'
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value='all'>All Status</option>
            <option value='active'>Active</option>
            <option value='inactive'>Inactive</option>
          </select>
        </div>
        <Link
          to='/add-subscription-plan'
          className='btn btn-primary text-sm btn-sm px-12 py-12 radius-8 d-flex align-items-center gap-2'
        >
          <Icon
            icon='ic:baseline-plus'
            className='icon text-xl line-height-1'
          />
          Add New Plan
        </Link>
      </div>
      <div className='card-body p-24'>
        {error && (
          <div className='alert alert-danger radius-8 mb-24' role='alert'>
            <Icon icon='material-symbols:error-outline' className='icon me-2' />
            {error}
          </div>
        )}

        {loading ? (
          <div className='text-center py-40'>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className='text-muted mt-3'>Loading subscription plans...</p>
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className='text-center py-40'>
            <Icon icon='mdi:account-off' className='icon text-6xl text-muted mb-3' />
            <p className='text-muted'>No subscription plans found</p>
          </div>
        ) : (
          <>
            <div className='table-responsive scroll-sm'>
              <table className='table bordered-table sm-table mb-0'>
                <thead>
                  <tr>
                    <th scope='col'>S.L</th>
                    <th scope='col'>Date</th>
                    <th scope='col'>Plan Name</th>
                    <th scope='col'>Reseller</th>
                    <th scope='col'>Amount</th>
                    <th scope='col'>Currency</th>
                    <th scope='col'>Duration (Days)</th>
                    <th scope='col'>Razorpay Plan ID</th>
                    <th scope='col' className='text-center'>
                      Status
                    </th>
                    <th scope='col' className='text-center'>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlans.map((plan, index) => (
                    <tr key={plan.id}>
                      <td>{index + 1}</td>
                      <td>{formatDate(plan.created_at)}</td>
                      <td>
                        <div className='d-flex align-items-center'>
                          <div className='w-40-px h-40-px rounded-circle flex-shrink-0 me-12 overflow-hidden bg-primary-100 d-flex align-items-center justify-content-center'>
                            <Icon
                              icon='solar:tag-price-bold'
                              className='icon text-primary-600 text-xl'
                            />
                          </div>
                          <div className='flex-grow-1'>
                            <span className='text-md mb-0 fw-normal text-secondary-light'>
                              {plan.plan_name || "-"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>
                          <span className='text-md mb-0 fw-normal text-secondary-light d-block'>
                            {plan.mst_reseller?.business_name || plan.mst_reseller?.email || "-"}
                          </span>
                          {plan.mst_reseller?.email && plan.mst_reseller?.business_name && (
                            <span className='text-xs text-muted'>{plan.mst_reseller.email}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className='text-md mb-0 fw-medium text-success-600'>
                          {formatCurrency(plan.amount, plan.currency)}
                        </span>
                      </td>
                      <td>
                        <span className='text-md mb-0 fw-normal text-secondary-light'>
                          {plan.currency || "INR"}
                        </span>
                      </td>
                      <td>
                        <span className='text-md mb-0 fw-normal text-secondary-light'>
                          {plan.duration_days ? `${plan.duration_days} days` : "-"}
                        </span>
                      </td>
                      <td>
                        <span className='text-md mb-0 fw-normal text-secondary-light'>
                          {plan.razorpay_plan_id || "-"}
                        </span>
                      </td>
                      <td className='text-center'>
                        <span
                          className={`${
                            plan.is_active
                              ? "bg-success-focus text-success-600 border border-success-main"
                              : "bg-danger-focus text-danger-600 border border-danger-main"
                          } px-24 py-4 radius-4 fw-medium text-sm`}
                        >
                          {plan.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className='text-center'>
                        <div className='d-flex align-items-center gap-10 justify-content-center'>
                          <Link
                            to={`/view-subscription-plan/${plan.id}`}
                            className='bg-info-focus bg-hover-info-200 text-info-600 fw-medium w-40-px h-40-px d-flex justify-content-center align-items-center rounded-circle'
                            title='View'
                          >
                            <Icon
                              icon='majesticons:eye-line'
                              className='icon text-xl'
                            />
                          </Link>
                          <Link
                            to={`/edit-subscription-plan/${plan.id}`}
                            className='bg-success-focus text-success-600 bg-hover-success-200 fw-medium w-40-px h-40-px d-flex justify-content-center align-items-center rounded-circle'
                            title='Edit'
                          >
                            <Icon icon='lucide:edit' className='menu-icon' />
                          </Link>
                          <button
                            type='button'
                            onClick={() =>
                              handleDelete(
                                plan.id,
                                plan.plan_name
                              )
                            }
                            className='remove-item-btn bg-danger-focus bg-hover-danger-200 text-danger-600 fw-medium w-40-px h-40-px d-flex justify-content-center align-items-center rounded-circle border-0'
                            title='Delete'
                          >
                            <Icon
                              icon='fluent:delete-24-regular'
                              className='menu-icon'
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className='d-flex align-items-center justify-content-between flex-wrap gap-2 mt-24'>
              <span>
                Showing {filteredPlans.length} of {plans.length} plan(s)
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SubscriptionPlanListLayer;
