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
}

interface Step8Props {
  email: string;
  onBack: () => void;
  onContinue: (data: GstVerificationData | null) => void;
}

const Step8 = ({ email, onBack, onContinue }: Step8Props) => {
  const [gstNumber, setGstNumber] = useState("");
  const [gstVerified, setGstVerified] = useState(false);
  const [gstData, setGstData] = useState<GstVerificationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validateGst = (gst: string) =>
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gst);

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
        });

        setGstVerified(true);
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

  const handleSkip = () => {
    onContinue(null);
  };

  const handleContinue = () => {
    onContinue(gstData);
  };

  return (
    <>
      <h4 className="mb-12">GST Details (Optional)</h4>

      {error && <div className="alert alert-danger mb-12">{error}</div>}

      <div className="mb-16">
        <label className="form-label text-sm mb-8">GST Number</label>
        <input
          className="form-control h-56-px mb-16"
          placeholder="Enter GST Number (e.g. 33AAVFN1205D1ZM)"
          value={gstNumber}
          disabled={gstVerified}
          onChange={(e) =>
            setGstNumber(e.target.value.toUpperCase().slice(0, 15))
          }
        />
      </div>

      {!gstVerified && (
        <div className="d-flex gap-12 mb-16">
          <button
            type="button"
            className="btn btn-outline-primary flex-1"
            onClick={(e) => {
              e.preventDefault();
              handleVerifyGst();
            }}
            disabled={loading}
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
          <button
            type="button"
            className="btn btn-light flex-1"
            onClick={(e) => {
              e.preventDefault();
              handleSkip();
            }}
            disabled={loading}
          >
            Skip
          </button>
        </div>
      )}

      {gstVerified && gstData && (
        <div className="alert alert-success mb-16">
          <div className="mb-12">
            <label className="form-label text-sm mb-8">Business Name</label>
            <input
              className="form-control h-56-px"
              value={gstData.business_name}
              disabled
            />
          </div>
          <p className="text-sm mb-4"><strong>GSTIN:</strong> {gstData.gstin}</p>
          <p className="text-sm mb-4"><strong>Status:</strong> {gstData.gstin_status}</p>
          <p className="text-sm mb-0"><strong>Constitution:</strong> {gstData.constitution_of_business}</p>
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
          handleContinue();
        }}
        disabled={gstNumber.trim() !== "" && !gstVerified}
      >
        Continue
      </button>
    </>
  );
};

export default Step8;

