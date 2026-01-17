import { Icon } from "@iconify/react/dist/iconify.js";
import { useState } from "react";

const RejectResellerModal = ({ isOpen, onClose, reseller, onReject, loading }) => {
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!rejectionReason.trim()) {
      setError("Rejection reason is required");
      return;
    }

    if (rejectionReason.trim().length < 10) {
      setError("Rejection reason must be at least 10 characters long");
      return;
    }

    onReject(rejectionReason.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content radius-12">
          <div className="modal-header border-bottom">
            <h5 className="modal-title text-md text-primary-light">Reject Reseller</h5>
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
                  Reject reseller: <strong>{reseller?.first_name} {reseller?.last_name}</strong> ({reseller?.email})
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
                  htmlFor='rejection_reason'
                  className='form-label fw-semibold text-primary-light text-sm mb-8'
                >
                  Rejection Reason <span className='text-danger-600'>*</span>
                </label>
                <textarea
                  className='form-control radius-8'
                  id='rejection_reason'
                  name='rejection_reason'
                  rows='4'
                  placeholder='Enter reason for rejection (minimum 10 characters)'
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value);
                    setError("");
                  }}
                  required
                  disabled={loading}
                />
                <small className="text-muted mt-2 d-block">
                  This reason will be sent to the reseller via email.
                </small>
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
                className="btn btn-danger radius-8"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Rejecting...
                  </>
                ) : (
                  "Reject Reseller"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RejectResellerModal;
