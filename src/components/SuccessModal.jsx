import { Icon } from "@iconify/react/dist/iconify.js";
import React from "react";

const SuccessModal = ({ isOpen, onClose, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
      <div className="modal-dialog modal-sm modal-dialog-centered">
        <div className="modal-content radius-16 bg-base">
          <div className="modal-body p-24 text-center">
            <span className="mb-16 fs-1 line-height-1 text-success-600">
              <Icon icon='material-symbols:check-circle-outline' className='menu-icon' />
            </span>
            <h6 className='text-lg fw-semibold text-primary-light mb-0'>
              {title || "Success"}
            </h6>
            <p className="text-sm text-secondary-light mb-0 mt-8">
              {message}
            </p>
            <div className='d-flex align-items-center justify-content-center mt-24'>
              <button
                type='button'
                className='btn btn-success border border-success-600 text-md px-40 py-11 radius-8'
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

export default SuccessModal;

