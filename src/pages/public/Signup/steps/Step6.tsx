import { updateGstStep } from "@/hasura/mutations";
import { Step5Props } from "@/types/auth/signup";
import { useState } from "react";

interface GstVerificationData {
  gstin: string;
  pan_number: string;
  business_name: string;
  legal_name: string;
  constitution_of_business: string;
  gstin_status: string;
  date_of_registration: string;
  state_jurisdiction: string;
  address: string;
  nature_bus_activities: string[];
  mobile_no?: number;
  email_id?: string;
}

const Step5 = ({ email, onBack, onContinue }: Step5Props) => {
  const [gstNumber, setGstNumber] = useState("");
  const [gstVerified, setGstVerified] = useState(false);
  const [gstData, setGstData] = useState<GstVerificationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validateGst = (gst: string) =>
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gst);

  /* =====================
     VERIFY GST
     ===================== */
  const handleVerifyGst = async () => {
    setError("");
    const gst = gstNumber.trim().toUpperCase();

    if (!validateGst(gst)) {
      setError("Invalid GST format (e.g. 33AAVFN1205D1ZM)");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        "https://virtualnumber.onrender.com/api/gst/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_number: gst,
            filing_status_get: true,
          }),
        }
      );

      const result = await res.json();
      const data = result.data?.data;

      if (result.success && data?.gstin) {
        setGstData({
          gstin: data.gstin,
          pan_number: data.pan_number,
          business_name: data.business_name,
          legal_name: data.legal_name,
          constitution_of_business: data.constitution_of_business,
          gstin_status: data.gstin_status,
          date_of_registration: data.date_of_registration,
          state_jurisdiction: data.state_jurisdiction,
          address: data.address,
          nature_bus_activities: data.nature_bus_activities || [],
          mobile_no: data.mobile_no,
          email_id: data.email_id,
        });

        setGstVerified(true);

        await updateGstStep({
          email,
          gstin: data.gstin,
          gst_pan_number: data.pan_number || null,
          business_name: data.business_name || null,
          legal_name: data.legal_name || null,
          gstin_status: data.gstin_status || null,
          constitution_of_business: data.constitution_of_business || null,
          nature_bus_activities: data.nature_bus_activities?.join(", ") || null,
        });
      } else {
        setError("GST not found or inactive.");
      }
    } catch (err) {
      console.error(err);
      setError("GST verification failed.");
    } finally {
      setLoading(false);
    }
  };

  /* =====================
     SKIP GST
     ===================== */
  const handleSkipGst = async () => {
    try {
      await updateGstStep({
        email,
        gstin: null,
        gst_pan_number: null,
        business_name: null,
        legal_name: null,
        gstin_status: null,
        constitution_of_business: null,
        nature_bus_activities: null,
      });
      onContinue();
    } catch (err) {
      console.error(err);
      setError("Unable to skip GST.");
    }
  };

  return (
    <>
      <h4 className="mb-12">GST Details (Optional)</h4>

      {error && <div className="alert alert-danger mb-12">{error}</div>}

      <input
        className="form-control h-56-px mb-16"
        placeholder="Enter GST Number"
        value={gstNumber}
        disabled={gstVerified}
        onChange={(e) =>
          setGstNumber(e.target.value.toUpperCase().slice(0, 15))
        }
      />

      {/* VERIFY BUTTON – hidden after success */}
      {!gstVerified && (
        <button
          className="btn btn-outline-primary w-100 mb-16"
          onClick={handleVerifyGst}
          disabled={loading}
        >
          {loading ? "Verifying..." : "Verify GST"}
        </button>
      )}

      {/* VERIFIED DATA */}
      {gstVerified && gstData && (
        <div className="alert alert-success mb-16">
          <p><strong>GSTIN:</strong> {gstData.gstin}</p>
          <p><strong>Business:</strong> {gstData.business_name}</p>
          <p><strong>Status:</strong> {gstData.gstin_status}</p>
          <p><strong>Constitution:</strong> {gstData.constitution_of_business}</p>
          <p><strong>State:</strong> {gstData.state_jurisdiction.split(",")[0]}</p>
        </div>
      )}

      <button className="btn btn-outline-secondary w-100 mb-12" onClick={onBack}>
        Back
      </button>

      {!gstVerified && (
        <button className="btn btn-light w-100 mb-12" onClick={handleSkipGst}>
          Skip GST Verification
        </button>
      )}

      <button
        className="btn btn-primary w-100"
        onClick={onContinue}
        disabled={!gstVerified && gstNumber.trim() !== ""}
      >
        Continue
      </button>
    </>
  );
};

export default Step5;
