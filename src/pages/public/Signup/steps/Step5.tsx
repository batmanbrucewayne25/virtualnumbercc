import { updateAadhaarStep } from "@/hasura/mutations";
import { Step4Props } from "@/types/auth/signup";
import { useState } from "react";

interface AadhaarVerificationData {
  full_name: string;
  aadhaar_number: string;
  dob: string;
  gender: string;
  address: any;
  zip: string;
  profile_image: string;
}

const Step5 = ({ email, onBack, onSubmit }: Step4Props) => {
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [aadhaarOtpSent, setAadhaarOtpSent] = useState(false);
  const [aadhaarOtp, setAadhaarOtp] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [aadhaarData, setAadhaarData] =
    useState<AadhaarVerificationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validateAadhaar = (value: string) => /^\d{12}$/.test(value);
  const validateOtp = (value: string) => /^\d{6}$/.test(value);

  /* =======================
     GENERATE OTP
     ======================= */
  const handleGetOtp = async () => {
    setError("");

    if (!aadhaarNumber.trim()) {
      setError("Please enter your Aadhaar number.");
      return;
    }

    if (!validateAadhaar(aadhaarNumber)) {
      setError("Aadhaar must be exactly 12 digits.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        "https://virtualnumber.onrender.com/api/aadhaar/generate-otp",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_number: aadhaarNumber }),
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const result = await res.json();

      // Check multiple possible response structures
      if (result.success) {
        // Check if status indicates success
        const status = result.data?.data?.status || result.data?.status || result.status;
        const requestId = result.data?.request_id || result.data?.data?.request_id || result.request_id;
        
        if (status === "generate_otp_success" || status === "success" || requestId) {
          if (requestId) {
            setRequestId(requestId);
            setAadhaarOtpSent(true);
            setError(""); // Clear any previous errors
          } else {
            setError("OTP sent but request ID missing. Please try again.");
          }
        } else {
          const errorMsg = result.data?.data?.message || result.data?.message || result.message || "Failed to send OTP. Please try again.";
          setError(errorMsg);
        }
      } else {
        const errorMsg = result.data?.data?.message || result.data?.message || result.message || "Failed to send OTP. Please try again.";
        setError(errorMsg);
      }
    } catch (err: any) {
      console.error("OTP generation error:", err);
      setError(err.message || "OTP generation failed. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  /* =======================
     SUBMIT OTP
     ======================= */
  const handleSubmitOtp = async () => {
    setError("");

    if (!aadhaarOtp.trim()) {
      setError("Please enter the OTP.");
      return;
    }

    if (!validateOtp(aadhaarOtp)) {
      setError("OTP must be exactly 6 digits.");
      return;
    }

    if (!requestId) {
      setError("Request ID missing. Please request a new OTP.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        "https://virtualnumber.onrender.com/api/aadhaar/submit-otp",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request_id: requestId,
            otp: aadhaarOtp,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const result = await res.json();
      
      // Check multiple possible response structures
      const data = result.data?.data || result.data || result;
      const status = data?.status || result.status;

      if (result.success && (status === "success_aadhaar" || status === "success")) {
        // Verify required fields are present
        if (!data.dob || !data.gender) {
          setError("Aadhaar verification incomplete. Missing required information.");
          return;
        }

        setAadhaarData({
          full_name: data.full_name || "",
          aadhaar_number: data.aadhaar_number || aadhaarNumber,
          dob: data.dob,
          gender: data.gender,
          address: data.address || null,
          zip: data.zip || "",
          profile_image: data.profile_image || "",
        });

        try {
          await updateAadhaarStep({
            email,
            aadhaar_number: aadhaarNumber,
            dob: data.dob,
            gender: data.gender,
          });

          onSubmit();
        } catch (updateErr) {
          console.error("Failed to update Aadhaar step:", updateErr);
          setError("Verification successful but failed to save. Please try again.");
        }
      } else {
        const errorMsg = data?.message || result.data?.message || result.message || "Invalid or incomplete Aadhaar verification.";
        setError(errorMsg);
      }
    } catch (err: any) {
      console.error("OTP verification error:", err);
      setError(err.message || "OTP verification failed. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h4 className="mb-12">Aadhaar Verification</h4>

      {error && <div className="alert alert-danger mb-12">{error}</div>}

      {/* AADHAAR INPUT */}
      <input
        className="form-control h-56-px mb-16"
        placeholder="Enter Aadhaar Number"
        value={aadhaarNumber}
        disabled={aadhaarOtpSent || loading}
        onChange={(e) =>
          setAadhaarNumber(e.target.value.replace(/\D/g, "").slice(0, 12))
        }
      />

      {/* OTP INPUT (appears but never removes buttons) */}
      {aadhaarOtpSent && (
        <input
          className="form-control h-56-px mb-16"
          placeholder="Enter 6-digit OTP"
          value={aadhaarOtp}
          disabled={loading}
          maxLength={6}
          onChange={(e) =>
            setAadhaarOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
        />
      )}

      {/* MAIN ACTION BUTTON (NEVER DISAPPEARS) */}
      <button
        className="btn btn-primary w-100 mb-16"
        disabled={loading}
        onClick={aadhaarOtpSent ? handleSubmitOtp : handleGetOtp}
      >
        {loading
          ? aadhaarOtpSent
            ? "Verifying OTP..."
            : "Sending OTP..."
          : aadhaarOtpSent
            ? "Verify OTP"
            : "Get OTP"}
      </button>

      {/* RESEND OTP */}
      {aadhaarOtpSent && !loading && (
        <button
          className="btn btn-link mb-8"
          onClick={() => {
            setAadhaarOtp("");
            setAadhaarOtpSent(false);
            setRequestId(null);
          }}
        >
          Resend OTP
        </button>
      )}

      {/* BACK */}
      <button
        type="button"
        className="btn btn-outline-secondary w-100 mt-12"
        onClick={onBack}
        disabled={loading}
      >
        Back
      </button>
    </>
  );
};

export default Step5;
