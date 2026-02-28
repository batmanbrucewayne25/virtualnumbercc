import { useState } from "react";
import { updateCustomerPanStep } from "@/hasura/mutations/customer";
import { getConstraintViolationMessage, extractGraphQLError } from "@/utils/graphqlErrorHandler";

interface PanVerificationData {
  pan_number: string;
  full_name: string;
  category: string;
  dob: string;
  gender: string;
  address?: string;
  photo?: string;
}

interface Step5Props {
  email: string;
  skipOtpVerification?: boolean;
  onBack: () => void;
  onSubmit: (data: PanVerificationData) => void;
}

const Step5 = ({ email, skipOtpVerification = false, onBack, onSubmit }: Step5Props) => {
  const [panNumber, setPanNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [panData, setPanData] = useState<PanVerificationData | null>(null);
  const [isPanVerified, setIsPanVerified] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const validatePanFormat = (pan: string) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);

  const handleVerifyPan = async () => {
    setError("");
    const trimmedPan = panNumber.trim().toUpperCase();

    if (!trimmedPan) return setError("Enter PAN number.");
    if (!validatePanFormat(trimmedPan))
      return setError("Invalid PAN format. Example: AAAAA1234A");

    setLoading(true);
    try {
      const { verifyPAN } = await import("@/utils/api");
      const result = await verifyPAN(trimmedPan);

      if (result.success && result.data?.data) {
        const data = result.data.data;
        setPanData({
          pan_number: data.pan_number || trimmedPan,
          full_name: data.full_name || "",
          category: data.category || "",
          dob: data.dob || "",
          gender: data.gender || "",
          address: data.address || data.full_address || "",
          photo: data.photo || data.profile_image || "",
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
    // If skipOtpVerification, allow manual entry without verification
    if (skipOtpVerification) {
      if (!panNumber.trim()) {
        setError("Please enter PAN number.");
        return;
      }
      if (!validatePanFormat(panNumber.trim())) {
        setError("Invalid PAN format. Example: AAAAA1234A");
        return;
      }
      
      setLoading(true);
      try {
        const result = await updateCustomerPanStep({
          email,
          pan_number: panNumber.trim(),
          pan_dob: null,
          pan_full_name: null,
        });
        
        // Check for GraphQL errors in response
        if (result?.errors && Array.isArray(result.errors) && result.errors.length > 0) {
          setError(getConstraintViolationMessage(result));
          setLoading(false);
          return;
        }
        
        onSubmit({
          pan_number: panNumber.trim(),
          full_name: "",
          category: "",
          dob: "",
          gender: "",
        });
      } catch (err: any) {
        console.error("Error updating PAN step:", err);
        const errorMessage = extractGraphQLError(err);
        if (errorMessage.includes("unique") || errorMessage.includes("duplicate") || errorMessage.includes("constraint")) {
          setError(getConstraintViolationMessage(err));
        } else {
          setError("Failed to submit PAN details. Please try again.");
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // Original flow with verification
    if (!panData) return;

    setLoading(true);
    try {
      const result = await updateCustomerPanStep({
        email,
        pan_number: panData.pan_number,
        pan_dob: panData.dob || null,
        pan_full_name: panData.full_name,
      });
      
      // Check for GraphQL errors in response
      if (result?.errors && Array.isArray(result.errors) && result.errors.length > 0) {
        setError(getConstraintViolationMessage(result));
        setLoading(false);
        return;
      }
      
      onSubmit(panData);
    } catch (err: any) {
      console.error("Error updating PAN step:", err);
      const errorMessage = extractGraphQLError(err);
      if (errorMessage.includes("unique") || errorMessage.includes("duplicate") || errorMessage.includes("constraint")) {
        setError(getConstraintViolationMessage(err));
      } else {
        setError("Failed to submit PAN details. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h4 className="mb-12">PAN Card Verification</h4>

      {error && <div className="alert alert-danger mb-12">{error}</div>}

      {skipOtpVerification && (
        <div className="alert alert-info mb-16">
          <p className="mb-0">PAN verification skipped (Admin mode). Enter PAN number manually.</p>
        </div>
      )}

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
          disabled={isPanVerified && !skipOtpVerification}
        />
      </div>

      {!isPanVerified && !skipOtpVerification && (
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
        <div className="card border radius-8 p-16 mb-16">
          <h6 className="mb-12 fw-semibold">PAN Card Details</h6>
          <div className="d-flex flex-column gap-12">
            {/* Photo if available */}
            {panData.photo && (
              <div>
                <label className="form-label text-sm mb-8 fw-medium">Photo</label>
                <div className="border radius-8 overflow-hidden" style={{ width: "120px", height: "120px" }}>
                  <img
                    src={panData.photo}
                    alt="PAN Photo"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              </div>
            )}
            
            {/* Name */}
            <div>
              <label className="form-label text-sm mb-8 fw-medium">Name</label>
              <p className="text-sm mb-0">{panData.full_name || "N/A"}</p>
            </div>

            {/* DOB */}
            <div>
              <label className="form-label text-sm mb-8 fw-medium">Date of Birth</label>
              <p className="text-sm mb-0">{panData.dob || "N/A"}</p>
            </div>

            {/* Address */}
            {panData.address && (
              <div>
                <label className="form-label text-sm mb-8 fw-medium">Address</label>
                <p className="text-sm mb-0">{panData.address}</p>
              </div>
            )}

            {/* Category */}
            {panData.category && (
              <div>
                <label className="form-label text-sm mb-8 fw-medium">Category</label>
                <p className="text-sm mb-0">{panData.category}</p>
              </div>
            )}

            {/* Gender */}
            {panData.gender && (
              <div>
                <label className="form-label text-sm mb-8 fw-medium">Gender</label>
                <p className="text-sm mb-0">{panData.gender}</p>
              </div>
            )}

            {/* PAN Number */}
            <div>
              <label className="form-label text-sm mb-8 fw-medium">PAN Number</label>
              <p className="text-sm mb-0">{panData.pan_number}</p>
            </div>
          </div>
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
        disabled={(skipOtpVerification ? false : !showDetails) || loading}
      >
        {loading ? "Please wait..." : "Submit & Continue"}
      </button>
    </>
  );
};

export default Step5;

