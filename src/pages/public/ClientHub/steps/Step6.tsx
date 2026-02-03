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

interface Step6Props {
  email: string;
  onBack: () => void;
  onSubmit: (data: AadhaarVerificationData) => void;
}

const Step6 = ({ email, onBack, onSubmit }: Step6Props) => {
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
      const { generateAadhaarOTP } = await import("@/utils/api");
      const result = await generateAadhaarOTP(aadhaarNumber);

      console.log("[Step6] Generate OTP Result:", result);

      // Handle different response structures
      const statusCode = result.data?.status_code || result.status_code;
      const status =
        result.status || result.data?.status || result.data?.data?.status;
      const requestId =
        result.request_id ||
        result.data?.request_id ||
        result.data?.data?.request_id;
      const responseData = result.data || result;

      // Check for error status first (API may return 200 OK but with error in body)
      if (
        !result.success ||
        statusCode === 500 ||
        status === "error" ||
        (statusCode && statusCode >= 400) ||
        (responseData?.message &&
          (responseData.message.toLowerCase().includes("error") ||
            responseData.message.toLowerCase().includes("went wrong") ||
            responseData.message.toLowerCase().includes("failed")))
      ) {
        const errorMsg =
          result.message ||
          responseData?.message ||
          responseData?.data?.message ||
          "Failed to send OTP. Please check your Aadhaar number and try again.";
        console.error("[Step6] OTP generation failed:", errorMsg, result);
        setError(errorMsg);
        return;
      }

      // Check if the response indicates success
      if (
        status === "generate_otp_success" ||
        status === "success" ||
        requestId
      ) {
        if (requestId) {
          setRequestId(requestId);
          setAadhaarOtpSent(true);
          setError("");
          console.log("[Step6] OTP sent successfully, request_id:", requestId);
        } else {
          console.error("[Step6] Request ID missing in response:", result);
          setError("OTP sent but request ID missing. Please try again.");
        }
      } else {
        const errorMsg =
          responseData?.message ||
          responseData?.data?.message ||
          result.message ||
          "Failed to send OTP.";
        console.error("[Step6] OTP generation failed:", errorMsg, result);
        setError(errorMsg);
      }
    } catch (err: any) {
      console.error("[Step6] OTP generation error:", err);
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        "OTP generation failed. Please check your Aadhaar number and try again.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

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

      console.log("[Step6] Submit OTP Result:", result);

      // Handle different response structures
      const responseData = result.data || result;
      const data = responseData?.data || responseData;
      const status = data?.status || responseData?.status || result.status;

      if (
        result.success &&
        (status === "success_aadhaar" ||
          status === "success" ||
          data?.aadhaar_number)
      ) {
        // Check for required fields
        if (!data.dob || !data.gender) {
          console.error("[Step6] Missing required fields:", {
            dob: data.dob,
            gender: data.gender,
            data,
          });
          setError(
            "Aadhaar verification incomplete. Missing required information (DOB or Gender)."
          );
          return;
        }

        const aadhaarData = {
          full_name: data.full_name || data.name || "",
          aadhaar_number: data.aadhaar_number || aadhaarNumber,
          dob: data.dob,
          gender: data.gender,
          address: data.address || data.full_address || null,
          zip: data.zip || data.pincode || "",
          profile_image: data.profile_image || data.photo || "",
        };

        console.log("[Step6] Aadhaar verification successful:", aadhaarData);

        setAadhaarData(aadhaarData);
        onSubmit(aadhaarData);
      } else {
        const errorMsg =
          data?.message ||
          responseData?.message ||
          result.message ||
          "Invalid OTP. Please check and try again.";
        console.error("[Step6] OTP verification failed:", errorMsg, result);
        setError(errorMsg);
      }
    } catch (err: any) {
      console.error("[Step6] OTP verification error:", err);
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        "OTP verification failed. Please check the OTP and try again.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h4 className="mb-12">Aadhaar Card Verification</h4>

      {error && <div className="alert alert-danger mb-12">{error}</div>}

      <div className="mb-16">
        <label className="form-label text-sm mb-8">
          Aadhaar Number <span className="text-danger">*</span>
        </label>
        <input
          className="form-control h-56-px mb-16"
          placeholder="Enter 12-digit Aadhaar Number"
          value={aadhaarNumber}
          disabled={aadhaarOtpSent || loading}
          onChange={(e) =>
            setAadhaarNumber(e.target.value.replace(/\D/g, "").slice(0, 12))
          }
        />
      </div>

      {aadhaarOtpSent && (
        <div className="mb-16">
          <label className="form-label text-sm mb-8">Enter 6-digit OTP</label>
          <input
            className="form-control h-56-px mb-16"
            placeholder="Enter OTP"
            value={aadhaarOtp}
            disabled={loading}
            maxLength={6}
            onChange={(e) =>
              setAadhaarOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
          />
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary w-100 mb-16"
        disabled={loading}
        onClick={(e) => {
          e.preventDefault();
          if (aadhaarOtpSent) {
            handleSubmitOtp();
          } else {
            handleGetOtp();
          }
        }}
      >
        {loading
          ? aadhaarOtpSent
            ? "Verifying OTP..."
            : "Sending OTP..."
          : aadhaarOtpSent
          ? "Verify OTP"
          : "Get OTP"}
      </button>

      {aadhaarOtpSent && !loading && (
        <button
          type="button"
          className="btn btn-link mb-8"
          onClick={(e) => {
            e.preventDefault();
            setAadhaarOtp("");
            setAadhaarOtpSent(false);
            setRequestId(null);
          }}
        >
          Resend OTP
        </button>
      )}

      {aadhaarData && (
        <div className="alert alert-info mb-16">
          <div className="mb-12">
            <label className="form-label text-sm mb-8">Customer Name</label>
            <input
              className="form-control h-56-px"
              value={aadhaarData.full_name}
              disabled
            />
          </div>
          <p className="text-sm mb-0">
            <strong>DOB:</strong> {aadhaarData.dob || "N/A"}
          </p>
        </div>
      )}

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

export default Step6;
