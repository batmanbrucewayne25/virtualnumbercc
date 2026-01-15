import { updatePanStep } from "@/hasura/mutations";
import { Step3Props } from "@/types/auth/signup";
import { useState } from "react";

interface PanVerificationData {
  pan_number: string;
  full_name: string;
  category: string;
  dob: string;
  gender: string;
}

const Step3 = ({ email, onBack, onSubmit }: Step3Props) => {
  const [panNumber, setPanNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [panData, setPanData] = useState<PanVerificationData | null>(null);
  const [isPanVerified, setIsPanVerified] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const validatePanFormat = (pan: string) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);

  const handleVerifyPan = async () => {
    setError("");
    const trimmedPan = panNumber.trim();

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

    setLoading(true);
    try {
      await updatePanStep({
        email,
        pan_number: panData.pan_number,
        pan_dob: panData.dob || null,
        pan_full_name: panData.full_name,
      });
      onSubmit();
    } catch {
      setError("Failed to submit PAN details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h4 className="mb-12">PAN Verification</h4>

      {error && <div className="alert alert-danger mb-12">{error}</div>}

      <input
        className="form-control h-56-px mb-16"
        placeholder="Enter PAN Number"
        value={panNumber}
        onChange={(e) => {
          const value = e.target.value.toUpperCase();
          if (value === "" || /^[A-Z0-9]*$/.test(value)) setPanNumber(value);
        }}
        disabled={isPanVerified}
      />

      {/* VERIFY BUTTON */}
      {!isPanVerified && (
        <button
          className="btn btn-outline-primary w-100 radius-12 mb-16"
          onClick={handleVerifyPan}
          disabled={loading}
        >
          {loading ? "Verifying..." : "Verify PAN"}
        </button>
      )}

      {/* SHOW DETAILS BUTTON */}
      {isPanVerified && !showDetails && (
        <button
          className="btn btn-outline-info w-100 radius-12 mb-16"
          onClick={() => setShowDetails(true)}
        >
          Show Details
        </button>
      )}

      {/* PAN DETAILS */}
      {showDetails && panData && (
        <div className="alert alert-info ">
          <p className="mb-0"><strong>Name:</strong> {panData.full_name || "N/A"}</p>
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
        className="btn btn-primary w-100 radius-12"
        onClick={handleSubmit}
        disabled={!showDetails || loading}
      >
        {loading ? "Please wait..." : "Submit & Continue"}
      </button>
    </>
  );
};

export default Step3;
