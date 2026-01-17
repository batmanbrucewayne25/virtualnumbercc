import { Icon } from "@iconify/react/dist/iconify.js";
import { useState } from "react";

const ApproveResellerModal = ({ isOpen, onClose, reseller, onApprove, loading }) => {
  const [formData, setFormData] = useState({
    wallet_balance: "",
    grace_period_days: "",
    virtual_numbers_count: "",
    price_per_number: "",
  });
  const [error, setError] = useState("");

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
    if (!formData.wallet_balance || !formData.grace_period_days) {
      setError("Please fill all required fields (Wallet Balance and Grace Period Days)");
      return;
    }

    const walletBalance = parseFloat(formData.wallet_balance);
    const gracePeriodDays = parseInt(formData.grace_period_days);
    const virtualNumbersCount = formData.virtual_numbers_count ? parseInt(formData.virtual_numbers_count) : null;
    const pricePerNumber = formData.price_per_number ? parseFloat(formData.price_per_number) : null;

    if (isNaN(walletBalance) || walletBalance < 0) {
      setError("Wallet balance must be a valid positive number");
      return;
    }

    if (isNaN(gracePeriodDays) || gracePeriodDays < 0) {
      setError("Grace period days must be a valid positive number");
      return;
    }

    if (virtualNumbersCount !== null && (isNaN(virtualNumbersCount) || virtualNumbersCount < 0)) {
      setError("Virtual numbers count must be a valid positive number");
      return;
    }

    if (pricePerNumber !== null && (isNaN(pricePerNumber) || pricePerNumber < 0)) {
      setError("Price per number must be a valid positive number");
      return;
    }

    onApprove({
      wallet_balance: walletBalance,
      grace_period_days: gracePeriodDays,
      virtual_numbers_count: virtualNumbersCount,
      price_per_number: pricePerNumber,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content radius-12">
          <div className="modal-header border-bottom">
            <h5 className="modal-title text-md text-primary-light">Approve Reseller</h5>
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
                  Approve reseller: <strong>{reseller?.first_name} {reseller?.last_name}</strong> ({reseller?.email})
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
                  htmlFor='wallet_balance'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  Wallet Balance (₹) <span className='text-danger-600'>*</span>
                </label>
                <input
                  type='number'
                  step='0.01'
                  min='0'
                  className='form-control radius-8'
                  id='wallet_balance'
                  name='wallet_balance'
                  placeholder='Enter wallet balance'
                  value={formData.wallet_balance}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>

              <div className="mb-20">
                <label
                  htmlFor='grace_period_days'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  Grace Period (Days) <span className='text-danger-600'>*</span>
                </label>
                <input
                  type='number'
                  min='0'
                  className='form-control radius-8'
                  id='grace_period_days'
                  name='grace_period_days'
                  placeholder='Enter grace period in days'
                  value={formData.grace_period_days}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>

              <div className="mb-20">
                <label
                  htmlFor='virtual_numbers_count'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  Number of Virtual Numbers
                </label>
                <input
                  type='number'
                  min='0'
                  className='form-control radius-8'
                  id='virtual_numbers_count'
                  name='virtual_numbers_count'
                  placeholder='Enter number of virtual numbers (optional)'
                  value={formData.virtual_numbers_count}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>

              <div className="mb-20">
                <label
                  htmlFor='price_per_number'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  Price Per Number (₹)
                </label>
                <input
                  type='number'
                  step='0.01'
                  min='0'
                  className='form-control radius-8'
                  id='price_per_number'
                  name='price_per_number'
                  placeholder='Enter price per number (optional)'
                  value={formData.price_per_number}
                  onChange={handleChange}
                  disabled={loading}
                />
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
                    Approving...
                  </>
                ) : (
                  "Approve Reseller"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ApproveResellerModal;
