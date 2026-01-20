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
  const [aadhaarData, setAadhaarData] = useState<AadhaarVerificationData | null>(null);
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
      const status = result.data?.data?.status || result.data?.status || result.status;
      const requestId = result.data?.request_id || result.data?.data?.request_id || result.request_id;

      if (result.success && (status === "generate_otp_success" || status === "success" || requestId)) {
        if (requestId) {
          setRequestId(requestId);
          setAadhaarOtpSent(true);
          setError("");
        } else {
          setError("OTP sent but request ID missing. Please try again.");
        }
      } else {
        const errorMsg = result.data?.data?.message || result.data?.message || result.message || "Failed to send OTP.";
        setError(errorMsg);
      }
    } catch (err: any) {
      console.error("OTP generation error:", err);
      setError(err.message || "OTP generation failed.");
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
      const data = result.data?.data || result.data || result;
      const status = data?.status || result.status;

      if (result.success && (status === "success_aadhaar" || status === "success")) {
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

        onSubmit({
          full_name: data.full_name || "",
          aadhaar_number: data.aadhaar_number || aadhaarNumber,
          dob: data.dob,
          gender: data.gender,
          address: data.address || null,
          zip: data.zip || "",
          profile_image: data.profile_image || "",
        });
      } else {
        const errorMsg = data?.message || result.data?.message || result.message || "Invalid OTP.";
        setError(errorMsg);
      }
    } catch (err: any) {
      console.error("OTP verification error:", err);
      setError(err.message || "OTP verification failed.");
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

