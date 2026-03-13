import { Icon } from "@iconify/react/dist/iconify.js";

const GracePeriodConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  virtualNumber,
  loading,
  apiError,
}) => {
  if (!isOpen || !virtualNumber) return null;

  const customer = virtualNumber.mst_customer;
  const reseller = virtualNumber.mst_reseller;

  const resellerDisplayName =
    reseller?.brand_name ||
    reseller?.business_name ||
    [reseller?.first_name, reseller?.last_name].filter(Boolean).join(" ") ||
    reseller?.email ||
    "-";

  return (
    <div
      className="modal show d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      tabIndex="-1"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content radius-12">
          <div className="modal-header border-bottom">
            <h5 className="modal-title text-md text-primary-light d-flex align-items-center gap-2">
              <Icon icon="mdi:shield-clock-outline" style={{ fontSize: "1.25rem" }} />
              Enable Grace Period
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={loading}
              aria-label="Close"
            />
          </div>
          <div className="modal-body p-24">
            {apiError && (
              <div className="alert alert-danger radius-8 mb-16" role="alert">
                <Icon icon="material-symbols:error-outline" className="icon me-2" />
                {apiError}
              </div>
            )}

            <div className="alert alert-primary radius-8 mb-20 d-flex align-items-start gap-2">
              <Icon icon="mdi:information-outline" style={{ fontSize: "1.25rem", flexShrink: 0, marginTop: "2px" }} />
              <span>
                This will grant a <strong>24-hour grace period</strong> for the reseller to send
                a renewal payment link. The grace period starts now and expires exactly 24 hours later.
              </span>
            </div>

            <div className="bg-neutral-50 radius-8 p-16">
              <h6 className="text-sm fw-semibold text-primary-light mb-12">Details</h6>

              <div className="row mb-8">
                <div className="col-5 text-sm text-secondary-light">Virtual Number</div>
                <div className="col-7 text-sm fw-medium">{virtualNumber.virtual_number || "-"}</div>
              </div>

              <hr className="my-8" />

              <div className="row mb-8">
                <div className="col-5 text-sm text-secondary-light">Customer Email</div>
                <div className="col-7 text-sm fw-medium">
                  {customer?.email || "-"}
                </div>
              </div>
              <div className="row mb-8">
                <div className="col-5 text-sm text-secondary-light">Customer Phone</div>
                <div className="col-7 text-sm fw-medium">
                  {customer?.phone || "-"}
                </div>
              </div>

              <hr className="my-8" />

              <div className="row mb-0">
                <div className="col-5 text-sm text-secondary-light">Reseller</div>
                <div className="col-7 text-sm fw-medium">{resellerDisplayName}</div>
              </div>
            </div>
          </div>
          <div className="modal-footer border-top">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary d-inline-flex align-items-center gap-2"
              onClick={() => onConfirm(virtualNumber.id)}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm"
                    role="status"
                    aria-hidden="true"
                  />
                  Enabling...
                </>
              ) : (
                <>
                  <Icon icon="mdi:shield-clock-outline" className="icon" style={{ fontSize: "1rem" }} />
                  Enable Grace Period
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GracePeriodConfirmModal;
