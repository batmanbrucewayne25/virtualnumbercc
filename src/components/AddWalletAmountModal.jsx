import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect } from "react";
import { creditWallet } from "@/hasura/mutations/wallet";
import { getMstResellers } from "@/hasura/mutations/reseller";

/**
 * Reusable "Add Wallet Amount" modal.
 * Props:
 * - isOpen, onClose
 * - onSuccess: () => void - called after wallet is credited successfully
 * - initialValues: { resellerId, resellerDisplayName?, amount?, reference?, description?, validityDate?, paymentType? } - when set, reseller is read-only and form is prefilled
 */
const PAYMENT_TYPE_OPTIONS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
];

const AddWalletAmountModal = ({ isOpen, onClose, onSuccess, initialValues }) => {
  const [formData, setFormData] = useState({
    reseller_id: "",
    amount: "",
    description: "",
    reference: "",
    validity_date: "",
    payment_type: "bank_transfer",
  });
  const [resellers, setResellers] = useState([]);
  const [loadingResellers, setLoadingResellers] = useState(false);
  const [resellerSearchTerm, setResellerSearchTerm] = useState("");
  const [resellerDropdownOpen, setResellerDropdownOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isPrepopulated = initialValues?.resellerId;

  useEffect(() => {
    if (isOpen) {
      setError("");
      setSuccess("");
      if (initialValues) {
        const paymentType = initialValues.paymentType ?? initialValues.payment_type ?? "bank_transfer";
        const normalizedPayment = paymentType === "upi" ? "upi" : "bank_transfer";
        setFormData({
          reseller_id: initialValues.resellerId || "",
          amount: initialValues.amount != null ? String(initialValues.amount) : "",
          description: initialValues.description || "",
          reference: initialValues.reference || "",
          validity_date: initialValues.validityDate || "",
          payment_type: normalizedPayment,
        });
      } else {
        setFormData({
          reseller_id: "",
          amount: "",
          description: "",
          reference: "",
          validity_date: "",
          payment_type: "bank_transfer",
        });
      }
      setResellerSearchTerm("");
      setResellerDropdownOpen(false);
      if (!isPrepopulated) {
        fetchResellers();
      }
    }
  }, [isOpen, initialValues, isPrepopulated]);

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
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleResellerSelect = (resellerId) => {
    setFormData((prev) => ({ ...prev, reseller_id: resellerId }));
    setResellerDropdownOpen(false);
    setResellerSearchTerm("");
    setError("");
  };

  const filteredResellers = resellers.filter((reseller) => {
    if (!resellerSearchTerm) return true;
    const searchLower = resellerSearchTerm.toLowerCase();
    return (
      reseller.business_name?.toLowerCase().includes(searchLower) ||
      reseller.email?.toLowerCase().includes(searchLower) ||
      reseller.first_name?.toLowerCase().includes(searchLower) ||
      reseller.last_name?.toLowerCase().includes(searchLower) ||
      `${reseller.first_name || ""} ${reseller.last_name || ""}`.trim().toLowerCase().includes(searchLower) ||
      (reseller.phone && reseller.phone.includes(resellerSearchTerm))
    );
  });

  const selectedReseller = resellers.find((r) => r.id === formData.reseller_id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.reseller_id) {
      setError("Please select a reseller");
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setActionLoading(true);
    try {
      const result = await creditWallet(
        formData.reseller_id,
        amount,
        formData.description || "Wallet credit",
        formData.reference || null,
        formData.validity_date || null
      );

      if (result.success) {
        setSuccess("Wallet credited successfully!");
        setTimeout(() => {
          setSuccess("");
          onClose();
          onSuccess?.();
        }, 1500);
      } else {
        setError(result.message || "Failed to credit wallet");
      }
    } catch (err) {
      console.error("Error crediting wallet:", err);
      setError(err?.message || "An error occurred while crediting wallet");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ reseller_id: "", amount: "", description: "", reference: "", validity_date: "", payment_type: "bank_transfer" });
    setResellerSearchTerm("");
    setResellerDropdownOpen(false);
    setError("");
    setSuccess("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content radius-12">
          <div className="modal-header border-bottom">
            <h5 className="modal-title text-md text-primary-light">Add Wallet Amount</h5>
            <button type="button" className="btn-close" onClick={handleClose} disabled={actionLoading} aria-label="Close" />
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
                  {success}
                </div>
              )}

              <div className="mb-20">
                <label className="form-label fw-semibold text-primary-light text-sm mb-8">
                  Reseller <span className="text-danger-600">*</span>
                </label>
                {isPrepopulated ? (
                  <div className="form-control radius-8 bg-light">
                    {initialValues.resellerDisplayName || formData.reseller_id || "Reseller"}
                  </div>
                ) : (
                  <div className="position-relative">
                    <div
                      className={`form-control radius-8 d-flex align-items-center justify-content-between ${loadingResellers || actionLoading ? "opacity-50" : ""}`}
                      style={{
                        cursor: loadingResellers || actionLoading ? "not-allowed" : "pointer",
                        minHeight: "38px",
                      }}
                      onClick={() => {
                        if (!loadingResellers && !actionLoading) setResellerDropdownOpen(!resellerDropdownOpen);
                      }}
                    >
                      <span className={formData.reseller_id ? "text-primary-light" : "text-muted"}>
                        {selectedReseller
                          ? `${selectedReseller.business_name || selectedReseller.email} (${selectedReseller.first_name || ""} ${selectedReseller.last_name || ""})`.trim()
                          : "Select Reseller"}
                      </span>
                      <Icon icon={resellerDropdownOpen ? "ep:arrow-up" : "ep:arrow-down"} className="icon text-secondary-light" />
                    </div>
                    {resellerDropdownOpen && (
                      <div
                        className="position-absolute w-100 bg-base border border-secondary-200 radius-8 shadow-lg mt-2"
                        style={{ zIndex: 1050, maxHeight: "300px", overflow: "hidden", display: "flex", flexDirection: "column" }}
                      >
                        <div className="p-12 border-bottom">
                          <input
                            type="text"
                            className="form-control form-control-sm radius-8"
                            placeholder="Search reseller..."
                            value={resellerSearchTerm}
                            onChange={(e) => { e.stopPropagation(); setResellerSearchTerm(e.target.value); }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="overflow-y-auto" style={{ maxHeight: "250px" }}>
                          {loadingResellers ? (
                            <div className="p-16 text-center">
                              <div className="spinner-border spinner-border-sm text-primary" role="status" />
                            </div>
                          ) : filteredResellers.length === 0 ? (
                            <div className="p-16 text-center text-muted small">No resellers found</div>
                          ) : (
                            filteredResellers.map((reseller) => (
                              <div
                                key={reseller.id}
                                className={`px-16 py-12 hover-bg-primary-50 cursor-pointer ${formData.reseller_id === reseller.id ? "bg-primary-50" : ""}`}
                                onClick={(e) => { e.stopPropagation(); handleResellerSelect(reseller.id); }}
                              >
                                <div className="text-sm fw-medium text-primary-light">
                                  {reseller.business_name || reseller.email}
                                </div>
                                <div className="text-xs text-secondary-light">
                                  {[reseller.first_name, reseller.last_name].filter(Boolean).join(" ")} • {reseller.email}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                    {formData.reseller_id && !selectedReseller && (
                      <small className="text-danger">Selected reseller not found</small>
                    )}
                  </div>
                )}
              </div>

              <div className="mb-20">
                <label htmlFor="payment_type" className="form-label fw-semibold text-primary-light text-sm mb-8">
                  Payment Type
                </label>
                <select
                  id="payment_type"
                  name="payment_type"
                  className="form-select radius-8"
                  value={formData.payment_type}
                  onChange={handleChange}
                  disabled={actionLoading}
                >
                  {PAYMENT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-20">
                <label htmlFor="amount" className="form-label fw-semibold text-primary-light text-sm mb-8">
                  Amount (₹) <span className="text-danger-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control radius-8"
                  id="amount"
                  name="amount"
                  placeholder="Enter amount to add"
                  value={formData.amount}
                  onChange={handleChange}
                  required
                  disabled={actionLoading}
                />
              </div>

              <div className="mb-20">
                <label htmlFor="description" className="form-label fw-semibold text-primary-light text-sm mb-8">
                  Description
                </label>
                <textarea
                  className="form-control radius-8"
                  id="description"
                  name="description"
                  rows="3"
                  placeholder="Enter transaction description (optional)"
                  value={formData.description}
                  onChange={handleChange}
                  disabled={actionLoading}
                />
              </div>

              <div className="mb-20">
                <label htmlFor="reference" className="form-label fw-semibold text-primary-light text-sm mb-8">
                  Reference
                </label>
                <input
                  type="text"
                  className="form-control radius-8"
                  id="reference"
                  name="reference"
                  placeholder="Enter reference (optional)"
                  value={formData.reference}
                  onChange={handleChange}
                  disabled={actionLoading}
                />
              </div>

              <div className="mb-20">
                <label htmlFor="validity_date" className="form-label fw-semibold text-primary-light text-sm mb-8">
                  Validity Date (Optional)
                </label>
                <input
                  type="date"
                  className="form-control radius-8"
                  id="validity_date"
                  name="validity_date"
                  value={formData.validity_date}
                  onChange={handleChange}
                  disabled={actionLoading}
                  min={new Date().toISOString().split("T")[0]}
                />
                <small className="text-xs text-secondary-light mt-4 d-block">
                  Set the validity end date for the reseller. If not set, validity will be calculated based on default (365 days).
                </small>
              </div>
            </div>
            <div className="modal-footer border-top">
              <button type="button" className="btn btn-secondary radius-8" onClick={handleClose} disabled={actionLoading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary radius-8" disabled={actionLoading}>
                {actionLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    Processing...
                  </>
                ) : (
                  "Add Amount"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddWalletAmountModal;
