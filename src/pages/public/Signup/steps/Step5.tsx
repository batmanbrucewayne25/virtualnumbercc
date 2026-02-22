import { updateAadhaarStep, getMstResellerByEmail } from "@/hasura/mutations";
import { Step4Props } from "@/types/auth/signup";
import { useState, useEffect } from "react";
import { validateAadharFormat } from "@/utils/aadharValidation.js";
import { useStepValidation } from "@/hooks/useStepValidation";
import { getConstraintViolationMessage, extractGraphQLError } from "@/utils/graphqlErrorHandler";
import { compareDates } from "@/utils/dateComparison";

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
  // Validate step access
  const { isValid, loading: validatingStep } = useStepValidation({ email, currentStep: 5 });

  // All hooks must be called unconditionally at the top level
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [aadhaarOtpSent, setAadhaarOtpSent] = useState(false);
  const [aadhaarOtp, setAadhaarOtp] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [aadhaarData, setAadhaarData] =
    useState<AadhaarVerificationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  // Countdown timer effect - MUST be called before any early returns
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Show loading while validating
  if (validatingStep) {
    return (
      <div className="text-center py-24">
        <p>Validating access...</p>
      </div>
    );
  }

  // If step is not valid, the hook will handle redirect
  if (!isValid) {
    return null;
  }

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
      // Note: In skipOtpVerification mode, DOB validation is skipped as we don't have Aadhaar DOB
      setLoading(true);
      try {
        const result = await updateAadhaarStep({
          email,
          aadhaar_number: cleaned,
          dob: null,
          gender: null,
          aadhar_photo: null,
          address: null,
        });
        
        // Check for GraphQL errors in response
        if (result?.errors && Array.isArray(result.errors) && result.errors.length > 0) {
          setError(getConstraintViolationMessage(result));
          setLoading(false);
          return;
        }
        
        onSubmit();
      } catch (err: any) {
        console.error("Failed to update Aadhaar step:", err);
        const errorMessage = extractGraphQLError(err);
        if (errorMessage.includes("unique") || errorMessage.includes("duplicate") || errorMessage.includes("constraint")) {
          setError(getConstraintViolationMessage(err));
        } else {
          setError("Failed to save Aadhaar details. Please try again.");
        }
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
            setCountdown(60); // Start 60-second countdown timer
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
      // Response structure: { success: true, data: { data: {...}, status: "success" } }
      const data = result.data?.data || result.data || result;
      const status = result.data?.status || data?.status || result.status;

      console.log("Aadhaar OTP Submit Response:", result);
      console.log("Extracted data:", data);
      console.log("Status:", status);
      console.log("Result success:", result.success);

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

        // Format profile_image as base64 data URL if it's a base64 string
        let profileImageBase64 = data.profile_image || "";
        if (profileImageBase64 && !profileImageBase64.startsWith('data:')) {
          // If it starts with /9j/ it's a JPEG base64, add the prefix
          if (profileImageBase64.startsWith('/9j/')) {
            profileImageBase64 = `data:image/jpeg;base64,${profileImageBase64}`;
          } else if (profileImageBase64.startsWith('iVBORw0KGgo')) {
            // PNG base64
            profileImageBase64 = `data:image/png;base64,${profileImageBase64}`;
          }
        }

        setAadhaarData({
          full_name: data.full_name || "",
          aadhaar_number: data.aadhaar_number || aadhaarNumber,
          dob: data.dob,
          gender: data.gender,
          address: data.address || null,
          zip: data.zip || "",
          profile_image: profileImageBase64,
        });

        try {
          // Handle address - convert object to array or keep as is
          let addressToSave = data.address || null;
          if (addressToSave && typeof addressToSave === 'object' && !Array.isArray(addressToSave)) {
            // Convert address object to array of strings
            addressToSave = Object.values(addressToSave).filter(v => v && typeof v === 'string');
          }

          // Clean aadhaar number - remove spaces and dashes
          const cleanedAadhaar = (data.aadhaar_number || aadhaarNumber).replace(/[\s-]/g, "");

          // Validate DOB match between PAN and Aadhaar
          if (data.dob) {
            try {
              // Fetch user data to get PAN DOB
              const userResult = await getMstResellerByEmail({ email });
              
              if (userResult?.mst_reseller && userResult.mst_reseller.length > 0) {
                const user = userResult.mst_reseller[0];
                const panDob = user.pan_dob;
                
                if (panDob) {
                  // Compare PAN DOB with Aadhaar DOB
                  if (!compareDates(panDob, data.dob)) {
                    setError(
                      "Date of birth mismatch! The date of birth in your PAN card does not match your Aadhaar card. Please verify that both documents have the same date of birth and try again."
                    );
                    setLoading(false);
                    return;
                  }
                } else {
                  // PAN DOB not found - this shouldn't happen if user completed Step 4, but handle gracefully
                  console.warn("PAN DOB not found for user, skipping DOB validation");
                }
              }
            } catch (fetchErr: any) {
              console.error("Error fetching user data for DOB validation:", fetchErr);
              // Continue with save even if we can't validate DOB (don't block user)
              // But log the error for debugging
            }
          }

          console.log("Saving Aadhaar data:", {
            email,
            aadhaar_number: cleanedAadhaar,
            dob: data.dob,
            gender: data.gender,
            aadhar_photo: profileImageBase64 ? "present" : "missing",
            address: addressToSave,
          });

          const result = await updateAadhaarStep({
            email,
            aadhaar_number: cleanedAadhaar,
            dob: data.dob,
            gender: data.gender,
            aadhar_photo: profileImageBase64 || null,
            address: addressToSave,
          });

          // Check for GraphQL errors in response
          if (result?.errors && Array.isArray(result.errors) && result.errors.length > 0) {
            setError(getConstraintViolationMessage(result));
            setLoading(false);
            return;
          }

          onSubmit();
        } catch (updateErr: any) {
          console.error("Failed to update Aadhaar step:", updateErr);
          const errorMessage = extractGraphQLError(updateErr);
          if (errorMessage.includes("unique") || errorMessage.includes("duplicate") || errorMessage.includes("constraint")) {
            setError(getConstraintViolationMessage(updateErr));
          } else {
            setError("Verification successful but failed to save. Please try again.");
          }
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
      {aadhaarOtpSent && !loading && !skipOtpVerification && (
        <div className="mb-8">
          {countdown > 0 ? (
            <p className="text-sm text-secondary-light mb-0">
              Resend OTP in {countdown} seconds
            </p>
          ) : (
            <button
              className="btn btn-link p-0"
              onClick={() => {
                setAadhaarOtp("");
                setAadhaarOtpSent(false);
                setRequestId(null);
                setCountdown(0);
                // Trigger resend by calling handleGetOtp again
                handleGetOtp();
              }}
            >
              Resend OTP
            </button>
          )}
        </div>
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
