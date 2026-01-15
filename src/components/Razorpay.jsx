import { useState } from "react";

const RazorpayPlanAdminStatic = () => {
  const [plan, setPlan] = useState({
    planName: "",
    amount: "",
    interval: "monthly",
    description: "",
    status: "active",
  });

  return (
    <div className="row gy-4">
      <div className="col-lg-8 mx-auto">
        <div className="card radius-12 p-24 h-100">
          <h5 className="mb-24">Create Subscription Plan</h5>

          {/* Plan Name */}
          <div className="mb-20">
            <label className="form-label fw-semibold">
              Plan Name <span className="text-danger">*</span>
            </label>
            <input
              className="form-control radius-8"
              placeholder="Pro Plan"
              value={plan.planName}
              onChange={(e) =>
                setPlan({ ...plan, planName: e.target.value })
              }
            />
          </div>

          {/* Amount */}
          <div className="mb-20">
            <label className="form-label fw-semibold">
              Amount (INR) <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              className="form-control radius-8"
              placeholder="999"
              value={plan.amount}
              onChange={(e) =>
                setPlan({ ...plan, amount: e.target.value })
              }
            />
          </div>

          {/* Billing Interval */}
          <div className="mb-20">
            <label className="form-label fw-semibold">
              Billing Interval <span className="text-danger">*</span>
            </label>
            <select
              className="form-control radius-8 form-select"
              value={plan.interval}
              onChange={(e) =>
                setPlan({ ...plan, interval: e.target.value })
              }
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {/* Description */}
          <div className="mb-20">
            <label className="form-label fw-semibold">
              Plan Description
            </label>
            <textarea
              className="form-control radius-8"
              rows="4"
              placeholder="Unlimited access to premium features"
              value={plan.description}
              onChange={(e) =>
                setPlan({ ...plan, description: e.target.value })
              }
            />
          </div>

          {/* Status */}
          <div className="mb-24">
            <label className="form-label fw-semibold">
              Plan Status
            </label>
            <select
              className="form-control radius-8 form-select"
              value={plan.status}
              onChange={(e) =>
                setPlan({ ...plan, status: e.target.value })
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Action */}
          <button className="btn btn-primary w-100">
            Save Plan (Static)
          </button>
        </div>
      </div>
    </div>
  );
};

export default RazorpayPlanAdminStatic;
