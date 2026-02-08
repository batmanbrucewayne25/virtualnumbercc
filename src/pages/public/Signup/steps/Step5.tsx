import { updateAadhaarStep } from "@/hasura/mutations";
import { Step4Props } from "@/types/auth/signup";
import { useState } from "react";
import { validateAadharFormat } from "@/utils/aadharValidation.js";

interface AadhaarVerificationData {
  full_name: string;
  aadhaar_number: string;
  dob: string;
  gender: string;
  address: any;
  zip: string;
  profile_image: string;
}

interface Step5PropsWithSkip extends Step4Props {
  skipOtpVerification?: any;
}

const Step5 = ({
  email,
  onBack,
  onSubmit,
  skipOtpVerification = false,
}: Step5PropsWithSkip) => {
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [aadhaarOtpSent, setAadhaarOtpSent] = useState(false);
  const [aadhaarOtp, setAadhaarOtp] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [aadhaarData, setAadhaarData] =
    useState<AadhaarVerificationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

    // If skipOtpVerification, allow manual entry without OTP
    if (skipOtpVerification) {
      // Validate Aadhar format (basic validation only) 
      // Validate Aadhar format (but not checksum for admin mode)
      const cleaned = aadhaarNumber.replace(/[\s-]/g, "");
      if (!/^\d{12}$/.test(cleaned)) {
        setError("Aadhaar must be exactly 12 digits.");
        return;
      }
      
      if (cleaned[0] === "0" || cleaned[0] === "1") {
        setError("Aadhaar number cannot start with 0 or 1.");
        return;
      }

      // Auto-proceed without OTP
      setLoading(true);
      try {
        await updateAadhaarStep({
          email,
          aadhaar_number: cleaned,
          dob: null,
          gender: null,
          aadhar_photo: null,
        });
        onSubmit();
      } catch (err) {
        console.error("Failed to update Aadhaar step:", err);
        setError("Failed to save Aadhaar details.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Validate Aadhar format (basic validation only - no checksum)
    const validation = validateAadharFormat(aadhaarNumber);
    if (!validation.valid) {
      console.error("[Step5] Frontend validation failed:", validation);
      setError(validation.message);
      return;
    }

    console.log("[Step5] Frontend validation passed, calling API for:", aadhaarNumber.replace(/(\d{4})\d{4}(\d{4})/, "$1****$2"));
    setLoading(true);
    try {
      const { generateAadhaarOTP } = await import("@/utils/api");
      const result = await generateAadhaarOTP(aadhaarNumber);
      console.log("[Step5] API Response:", result);

      // Check multiple possible response structures
      if (result.success) {
        // Check if status indicates success
        const status =
          result.data?.data?.status || result.data?.status || result.status;
        const requestId =
          result.data?.request_id ||
          result.data?.data?.request_id ||
          result.request_id;

        if (
          status === "generate_otp_success" ||
          status === "success" ||
          requestId
        ) {
          if (requestId) {
            setRequestId(requestId);
            setAadhaarOtpSent(true);
            setError(""); // Clear any previous errors
          } else {
            setError("OTP sent but request ID missing. Please try again.");
          }
        } else {
          const errorMsg =
            result.data?.data?.message ||
            result.data?.message ||
            result.message ||
            "Failed to send OTP. Please try again.";
          setError(errorMsg);
        }
      } else {
        const errorMsg =
          result.data?.data?.message ||
          result.data?.message ||
          result.message ||
          "Failed to send OTP. Please try again.";
        setError(errorMsg);
      }
    } catch (err: any) {
      console.error("OTP generation error:", err);
      setError(
        err.message ||
          "OTP generation failed. Please check your connection and try again."
      );
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
      const { submitAadhaarOTP } = await import("@/utils/api");
      const result = await submitAadhaarOTP(requestId, aadhaarOtp);

      // Check multiple possible response structures
      const data = result.data?.data || result.data || result;
      const status = data?.status || result.status;

      if (
        result.success &&
        (status === "success_aadhaar" || status === "success")
      ) {
        // Verify required fields are present
        if (!data.dob || !data.gender) {
          setError(
            "Aadhaar verification incomplete. Missing required information."
          );
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
            aadhar_photo: data.profile_image || null,
          });

          onSubmit();
        } catch (updateErr) {
          console.error("Failed to update Aadhaar step:", updateErr);
          setError(
            "Verification successful but failed to save. Please try again."
          );
        }
      } else {
        const errorMsg =
          data?.message ||
          result.data?.message ||
          result.message ||
          "Invalid or incomplete Aadhaar verification.";
        setError(errorMsg);
      }
    } catch (err: any) {
      console.error("OTP verification error:", err);
      setError(
        err.message ||
          "OTP verification failed. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h4 className="mb-12">Aadhaar Verification</h4>

      {error && <div className="alert alert-danger mb-12">{error}</div>}

      {skipOtpVerification && (
        <div className="alert alert-info mb-16">
          <p className="mb-0">
            Aadhaar OTP verification skipped (Admin mode). Enter Aadhaar number
            manually.
          </p>
        </div>
      )}

      {/* AADHAAR INPUT */}
      <input
        className="form-control h-56-px mb-16"
        placeholder="Enter Aadhaar Number"
        value={aadhaarNumber}
        disabled={(aadhaarOtpSent && !skipOtpVerification) || loading}
        onChange={(e) =>
          setAadhaarNumber(e.target.value.replace(/\D/g, "").slice(0, 12))
        }
      />

      {/* OTP INPUT (only show if not skipping verification) */}
      {aadhaarOtpSent && !skipOtpVerification && (
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
        onClick={
          skipOtpVerification
            ? handleGetOtp
            : aadhaarOtpSent
            ? handleSubmitOtp
            : handleGetOtp
        }
      >
        {loading
          ? skipOtpVerification
            ? "Saving..."
            : aadhaarOtpSent
            ? "Verifying OTP..."
            : "Sending OTP..."
          : skipOtpVerification
          ? "Continue"
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
