import { Icon } from "@iconify/react/dist/iconify.js";
import React from "react";

const AlertModal = ({ isOpen, onClose, title, message, type = "info" }) => {
  if (!isOpen) return null;

  const getIconAndColor = () => {
    switch (type) {
      case "success":
        return {
          icon: "material-symbols:check-circle-outline",
          color: "text-success-600",
          buttonClass: "btn-success"
        };
      case "error":
      case "danger":
        return {
          icon: "material-symbols:error-outline",
          color: "text-danger-600",
          buttonClass: "btn-danger"
        };
      case "warning":
        return {
          icon: "material-symbols:warning-outline",
          color: "text-warning-600",
          buttonClass: "btn-warning"
        };
      default:
        return {
          icon: "material-symbols:info-outline",
          color: "text-info-600",
          buttonClass: "btn-info"
        };
    }
  };

  const { icon, color, buttonClass } = getIconAndColor();
  const defaultTitle = type === "success" ? "Success" : type === "error" || type === "danger" ? "Error" : type === "warning" ? "Warning" : "Information";

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
      <div className="modal-dialog modal-sm modal-dialog-centered">
        <div className="modal-content radius-16 bg-base">
          <div className="modal-body p-24 text-center">
            <span className={`mb-16 fs-1 line-height-1 ${color}`}>
              <Icon icon={icon} className='menu-icon' />
            </span>
            <h6 className='text-lg fw-semibold text-primary-light mb-0'>
              {title || defaultTitle}
            </h6>
            <p className="text-sm text-secondary-light mb-0 mt-8">
              {message}
            </p>
            <div className='d-flex align-items-center justify-content-center mt-24'>
              <button
                type='button'
                className={`btn ${buttonClass} border text-md px-40 py-11 radius-8`}
                onClick={onClose}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;

