import { useState } from "react";

interface PanVerificationData {
  pan_number: string;
  full_name: string;
  category: string;
  dob: string;
  gender: string;
}

interface Step5Props {
  email: string;
  onBack: () => void;
  onSubmit: (data: PanVerificationData) => void;
}

const Step5 = ({ email, onBack, onSubmit }: Step5Props) => {
  const [panNumber, setPanNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [panData, setPanData] = useState<PanVerificationData | null>(null);
  const [isPanVerified, setIsPanVerified] = useState(false);

  const validatePanFormat = (pan: string) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);

  const handleVerifyPan = async () => {
    setError("");
    const trimmedPan = panNumber.trim().toUpperCase();

    if (!trimmedPan) return setError("Enter PAN number.");
    if (!validatePanFormat(trimmedPan))
      return setError("Invalid PAN format. Example: AAAAA1234A");

    setLoading(true);
    try {
      const response = await fetch(
        "https://virtualnumber.onrender.com/api/pan/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_number: trimmedPan }),
        }
      );

      const result = await response.json();

      if (result.success && result.data?.data) {
        const data = result.data.data;
        setPanData({
          pan_number: data.pan_number || trimmedPan,
          full_name: data.full_name || "",
          category: data.category || "",
          dob: data.dob || "",
          gender: data.gender || "",
        });
        setIsPanVerified(true);
      } else {
        setError("Invalid PAN number.");
      }
    } catch {
      setError("PAN verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!panData) return;
    onSubmit(panData);
  };

  return (
    <>
      <h4 className="mb-12">PAN Card Verification</h4>

      {error && <div className="alert alert-danger mb-12">{error}</div>}

      <div className="mb-16">
        <label className="form-label text-sm mb-8">
          PAN Card Number <span className="text-danger">*</span>
        </label>
        <input
          className="form-control h-56-px mb-16"
          placeholder="Enter PAN Number (e.g., AAAAA1234A)"
          value={panNumber}
          onChange={(e) => {
            const value = e.target.value.toUpperCase();
            if (value === "" || /^[A-Z0-9]*$/.test(value)) setPanNumber(value);
          }}
          disabled={isPanVerified}
        />
      </div>

      {!isPanVerified && (
        <button
          type="button"
          className="btn btn-outline-primary w-100 radius-12 mb-16"
          onClick={(e) => {
            e.preventDefault();
            handleVerifyPan();
          }}
          disabled={loading}
        >
          {loading ? "Verifying..." : "Verify PAN"}
        </button>
      )}

      {isPanVerified && panData && (
        <div className="alert alert-info mb-16">
          <div className="mb-12">
            <label className="form-label text-sm mb-8">Customer Name</label>
            <input
              className="form-control h-56-px"
              value={panData.full_name}
              disabled
            />
          </div>
          <p className="text-sm mb-0">
            <strong>PAN:</strong> {panData.pan_number}
          </p>
          <p className="text-sm mb-0">
            <strong>DOB:</strong> {panData.dob || "N/A"}
          </p>
        </div>
      )}

      <button
        type="button"
        className="btn btn-outline-secondary w-100 radius-12 mb-12"
        onClick={onBack}
      >
        Back
      </button>

      <button
        type="button"
        className="btn btn-primary w-100 radius-12"
        onClick={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        disabled={!isPanVerified || loading}
      >
        {loading ? "Please wait..." : "Submit & Continue"}
      </button>
    </>
  );
};

export default Step5;

