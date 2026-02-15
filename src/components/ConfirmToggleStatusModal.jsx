import { Icon } from "@iconify/react/dist/iconify.js";

const ConfirmToggleStatusModal = ({ isOpen, onClose, reseller, action, onConfirm, loading }) => {
  if (!isOpen) return null;

  const actionText = action === "activate" ? "activate" : "deactivate";
  const actionTitle = action === "activate" ? "Activate Reseller" : "Deactivate Reseller";
  const icon = action === "activate" ? "material-symbols:check-circle-outline" : "material-symbols:cancel-outline";
  const iconColor = action === "activate" ? "text-success-600" : "text-danger-600";

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content radius-12">
          <div className="modal-header border-bottom">
            <h5 className="modal-title text-md text-primary-light">{actionTitle}</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={loading}
              aria-label="Close"
            />
          </div>
          <div className="modal-body p-24 text-center">
            <div className="mb-20">
              <Icon icon={icon} className={`icon text-5xl ${iconColor} mb-3`} />
            </div>
            <h6 className="text-lg fw-semibold text-primary-light mb-12">
              Are you sure you want to {actionText} this reseller?
            </h6>
            <p className="text-sm text-secondary-light mb-0">
              Reseller: <strong>{reseller?.first_name} {reseller?.last_name}</strong> ({reseller?.email})
            </p>
            {action === "deactivate" && (
              <p className="text-xs text-warning-600 mt-12 mb-0">
                This will make the reseller inactive. They will not be able to access their account.
              </p>
            )}
            {action === "activate" && (
              <p className="text-xs text-success-600 mt-12 mb-0">
                This will activate the reseller and grant them access to their account.
              </p>
            )}
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
              type="button"
              className={`btn radius-8 ${action === "activate" ? "btn-success" : "btn-danger"}`}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Processing...
                </>
              ) : (
                `${actionTitle}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmToggleStatusModal;

