import { Icon } from "@iconify/react/dist/iconify.js";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getCustomerWithTransactions } from "@/hasura/mutations/user";
import { updateMstCustomer } from "@/hasura/mutations/customer";
import { updateMstVirtualNumberPurchaseDate } from "@/hasura/mutations/virtualNumber";
import { getMaxVirtualNumbersForCustomer, upsertNumberLimits } from "@/hasura/mutations/numberLimits";

const toDateInput = (val) => {
  if (!val) return "";
  const d = typeof val === "string" ? val : (val && val.toString?.()) || "";
  return d.includes("T") ? d.split("T")[0] : d;
};

const EditUserApprovalLayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [form, setForm] = useState({
    email: "",
    phone: "",
    first_name: "",
    last_name: "",
    pan_number: "",
    pan_full_name: "",
    pan_dob: "",
    gender: "",
    gstin: "",
    gstin_status: "",
    max_virtual_numbers: "",
    approval_date: "",
  });

  const firstVirtualNumber = customer?.mst_virtual_numbers?.[0];

  useEffect(() => {
    fetchCustomer();
  }, [id]);

  useEffect(() => {
    if (!customer) return;
    setForm({
      email: customer.email || "",
      phone: customer.phone || "",
      first_name: customer.firstName ?? customer.first_name ?? "",
      last_name: customer.lastName ?? customer.last_name ?? "",
      pan_number: customer.pan_number || "",
      pan_full_name: customer.pan_full_name || "",
      pan_dob: toDateInput(customer.pan_dob),
      gender: customer.gender || "",
      gstin: customer.gstin || "",
      gstin_status: customer.gstin_status || "",
      max_virtual_numbers:
        getMaxVirtualNumbersForCustomer(customer) != null ? String(getMaxVirtualNumbersForCustomer(customer)) : "",
      approval_date: firstVirtualNumber?.purchase_date
        ? toDateInput(firstVirtualNumber.purchase_date)
        : "",
    });
  }, [customer, firstVirtualNumber?.purchase_date]);

  const fetchCustomer = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getCustomerWithTransactions(id);
      if (result.success) {
        setCustomer(result.data);
      } else {
        setError(result.message || "Failed to load customer");
      }
    } catch (err) {
      console.error("Error fetching customer:", err);
      setError("An error occurred while loading customer details");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const updateData = {
        phone: form.phone,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        pan_number: form.pan_number ? form.pan_number.toUpperCase().trim() : null,
        pan_full_name: form.pan_full_name || null,
        pan_dob: form.pan_dob || null,
        gender: form.gender || null,
        gstin: form.gstin || null,
        gstin_status: form.gstin_status || null,
      };

      const result = await updateMstCustomer(id, updateData);
      if (!result.success) {
        setError(result.message || "Failed to update profile");
        setSaving(false);
        return;
      }

      if (form.max_virtual_numbers !== "" && form.max_virtual_numbers != null && customer?.reseller_id) {
        const num = Number(form.max_virtual_numbers);
        if (!isNaN(num) && num >= 0) {
          const limitsResult = await upsertNumberLimits(customer.reseller_id, num);
          if (!limitsResult.success) {
            setError(limitsResult.message || "Profile updated but max virtual numbers update failed.");
            setSaving(false);
            return;
          }
        }
      }

      if (firstVirtualNumber && form.approval_date) {
        const approvalResult = await updateMstVirtualNumberPurchaseDate({
          id: firstVirtualNumber.id,
          purchase_date: form.approval_date,
        });
        if (!approvalResult.success) {
          setError(approvalResult.message || "Profile updated but approval date failed.");
          setSaving(false);
          return;
        }
      }

      setSuccessMessage("Profile updated successfully.");
      await fetchCustomer();
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      console.error("Error saving:", err);
      setError(err?.message || "An error occurred while saving");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card h-100 p-0 radius-12">
        <div className="card-body p-24">
          <div className="text-center py-40">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="text-muted mt-3">Loading customer...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !customer) {
    return (
      <div className="card h-100 p-0 radius-12">
        <div className="card-body p-24">
          <div className="alert alert-danger radius-8" role="alert">
            <Icon icon="material-symbols:error-outline" className="icon me-2" />
            {error}
          </div>
          <button
            type="button"
            className="btn btn-secondary mt-3"
            onClick={() => navigate("/users-list")}
          >
            Back to Users List
          </button>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="card h-100 p-0 radius-12">
        <div className="card-body p-24">
          <div className="text-center py-40">
            <Icon
              icon="mdi:account-off"
              className="icon text-6xl text-muted mb-3"
            />
            <p className="text-muted">Customer not found</p>
            <button
              type="button"
              className="btn btn-secondary mt-3"
              onClick={() => navigate("/users-list")}
            >
              Back to Users List
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card h-100 p-0 radius-12">
      <div className="card-header border-bottom bg-base py-16 px-24 d-flex align-items-center justify-content-between">
        <h5 className="text-md text-primary-light mb-0">Edit Customer Profile</h5>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => navigate(`/view-user/${id}`)}
            disabled={saving}
          >
            View Details
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm d-flex align-items-center gap-1"
            onClick={() => navigate("/users-list")}
          >
            <Icon icon="mdi:arrow-left" className="icon text-xl line-height-1" />
            Back to Users List
          </button>
        </div>
      </div>
      <div className="card-body p-24">
        {successMessage && (
          <div className="alert alert-success radius-8 mb-24" role="alert">
            <Icon icon="material-symbols:check-circle-outline" className="icon me-2" />
            {successMessage}
          </div>
        )}
        {error && (
          <div className="alert alert-danger radius-8 mb-24" role="alert">
            <Icon icon="material-symbols:error-outline" className="icon me-2" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <div className="row g-3 mb-24">
            <div className="col-12">
              <h6 className="text-sm text-secondary-light mb-12 border-bottom pb-8">
                Basic Information
              </h6>
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                Email
              </label>
              <input
                type="email"
                className="form-control radius-8 bg-light"
                value={form.email}
                readOnly
                disabled
              />
              <small className="text-muted">Email cannot be changed</small>
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                Phone <span className="text-danger-600">*</span>
              </label>
              <input
                type="tel"
                className="form-control radius-8"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="Phone number"
                disabled={saving}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                First Name
              </label>
              <input
                type="text"
                className="form-control radius-8"
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                placeholder="First name"
                disabled={saving}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                Last Name
              </label>
              <input
                type="text"
                className="form-control radius-8"
                name="last_name"
                value={form.last_name}
                onChange={handleChange}
                placeholder="Last name"
                disabled={saving}
              />
            </div>
          </div>

          {/* PAN Card Details */}
          <div className="row g-3 mb-24">
            <div className="col-12">
              <h6 className="text-sm text-secondary-light mb-12 border-bottom pb-8">
                PAN Card Details
              </h6>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                PAN Number
              </label>
              <input
                type="text"
                className="form-control radius-8 text-uppercase"
                name="pan_number"
                value={form.pan_number}
                onChange={handleChange}
                maxLength={10}
                placeholder="e.g. ABCDE1234F"
                disabled={saving}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                Full Name (as on PAN)
              </label>
              <input
                type="text"
                className="form-control radius-8"
                name="pan_full_name"
                value={form.pan_full_name}
                onChange={handleChange}
                placeholder="Full name"
                disabled={saving}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                Date of Birth
              </label>
              <input
                type="date"
                className="form-control radius-8"
                name="pan_dob"
                value={form.pan_dob}
                onChange={handleChange}
                disabled={saving}
              />
            </div>
          </div>

          {/* Aadhaar & GST */}
          <div className="row g-3 mb-24">
            <div className="col-12">
              <h6 className="text-sm text-secondary-light mb-12 border-bottom pb-8">
                Aadhaar & GST Details
              </h6>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                Aadhaar Number
              </label>
              <input
                type="text"
                className="form-control radius-8 bg-light"
                value={customer?.aadhaar_number || "—"}
                readOnly
                disabled
              />
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                Gender
              </label>
              <select
                className="form-select radius-8"
                name="gender"
                value={form.gender}
                onChange={handleChange}
                disabled={saving}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                GSTIN
              </label>
              <input
                type="text"
                className="form-control radius-8"
                name="gstin"
                value={form.gstin}
                onChange={handleChange}
                placeholder="GST number"
                disabled={saving}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                GST Status
              </label>
              <select
                className="form-select radius-8"
                name="gstin_status"
                value={form.gstin_status}
                onChange={handleChange}
                disabled={saving}
              >
                <option value="">— Select —</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Approval & Limits */}
          <div className="row g-3 mb-24">
            <div className="col-12">
              <h6 className="text-sm text-secondary-light mb-12 border-bottom pb-8">
                Approval & Limits
              </h6>
            </div>
            {firstVirtualNumber && (
              <div className="col-md-6">
                <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                  Approval Date
                </label>
                <input
                  type="date"
                  className="form-control radius-8"
                  name="approval_date"
                  value={form.approval_date}
                  onChange={handleChange}
                  disabled={saving}
                />
                <small className="text-muted">Purchase/approval date of first virtual number</small>
              </div>
            )}
            <div className="col-md-6">
              <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                Max Virtual Numbers
              </label>
              <input
                type="number"
                min={0}
                className="form-control radius-8"
                name="max_virtual_numbers"
                value={form.max_virtual_numbers}
                onChange={handleChange}
                placeholder="e.g. 5"
                disabled={saving}
              />
            </div>
          </div>

          <div className="d-flex gap-2 pt-2">
            <button
              type="submit"
              className="btn btn-primary radius-8"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  />
                  Saving...
                </>
              ) : (
                "Save Profile"
              )}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary radius-8"
              onClick={() => navigate("/users-list")}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserApprovalLayer;
