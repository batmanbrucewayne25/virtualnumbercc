import { Icon } from "@iconify/react/dist/iconify.js";

const DeleteResellerModal = ({ isOpen, onClose, reseller, onConfirm, loading }) => {
  if (!isOpen) return null;

  const resellerName = reseller ? `${reseller.first_name} ${reseller.last_name}` : "";

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content radius-12">
          <div className="modal-header border-bottom">
            <h5 className="modal-title text-md text-primary-light">Delete Reseller</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={loading}
              aria-label="Close"
            />
          </div>
          <div className="modal-body p-24 text-center">
             
            <h6 className="text-lg fw-semibold text-primary-light mb-12">
              Are you sure you want to delete reseller "{resellerName}"?
            </h6>
             
            <p className="text-xs text-danger-600 mt-12 mb-0">
              <strong>Warning:</strong> This will permanently delete the reseller's account and all associated data.
            </p>
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
              className="btn btn-danger radius-8"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Deleting...
                </>
              ) : (
                "Delete Reseller"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteResellerModal;

