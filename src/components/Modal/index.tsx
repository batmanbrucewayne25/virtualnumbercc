import { useNavigate } from "react-router-dom";
import { SuccessPopupProps } from "./types";

const SuccessPopup = ({ show, onClose }: SuccessPopupProps) => {
  const navigate = useNavigate();

  if (!show) return null;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ background: "rgba(0,0,0,0.5)", zIndex: 9999 }}
    >
      <div className="bg-white radius-12 p-24 text-center" style={{ width: "320px" }}>
        <h5 className="mb-12 text-success">🎉 Success!</h5>
        <p className="mb-24">Your KYC details have been successfully submitted.</p>

        <button
          className="btn btn-primary w-100 radius-12"
          onClick={() => {
            onClose();
            navigate("/sign-in");
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default SuccessPopup;
