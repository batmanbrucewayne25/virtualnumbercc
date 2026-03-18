import { useState } from "react";

interface Step10Props {
  formData: {
    email: string;
    phone: string;
    password: string;
    panData: {
      pan_number: string;
      full_name: string;
      dob: string;
      category: string;
      gender: string;
    } | null;
    aadhaarData: {
      full_name: string;
      aadhaar_number: string;
      dob: string;
      gender: string;
      address: any;
      zip: string;
      profile_image: string;
    } | null;
    gstData: {
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
    } | null;
    signature: {
      signatureHash: string;
      signatureMetadata: any;
      signatureFilename?: string;
    } | null;
  };
  resellerId: string;
  onBack: () => void;
  onSubmit: () => void;
}

/** Mask PAN number: first 4 + **** + last 2 (e.g. CHWPJ2392B → CHWP****2B) */
const maskPanNumber = (pan: string): string => {
  if (!pan || pan.length < 6) return "****";
  return `${pan.slice(0, 4)}****${pan.slice(-2)}`;
};

/** Format date from YYYY-MM-DD to DD-MM-YYYY */
const formatDobToDDMMYYYY = (dateStr: string): string => {
  if (!dateStr) return "N/A";
  const trimmed = dateStr.trim();
  if (!trimmed) return "N/A";
  // Already DD-MM-YYYY format (has - and first part is 1-2 digits)
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(trimmed)) return trimmed;
  // YYYY-MM-DD format
  const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const [, y, m, d] = match;
    return `${d.padStart(2, "0")}-${m.padStart(2, "0")}-${y}`;
  }
  return trimmed;
};

const Step10 = ({ formData, resellerId, onBack, onSubmit }: Step10Props) => {
  const [loading, setLoading] = useState(false);

  // All details already saved in previous steps; this step only reviews and completes
  const handleComplete = async () => {
    setLoading(true);
    try {
      // Save profile_name and business_name derived from KYC data
      if (formData.email) {
        const { updateCustomerProfileName } = await import("@/hasura/mutations/customer");
        const derivedProfileName = formData.aadhaarData?.full_name || formData.panData?.full_name || null;
        const derivedBusinessName = formData.gstData?.business_name || null;
        await updateCustomerProfileName({
          email: formData.email,
          profile_name: derivedProfileName,
          business_name: derivedBusinessName,
        });
      }
    } catch (err) {
      console.error("Failed to save profile name:", err);
    }
    onSubmit();
    setLoading(false);
  };

  const profileName =
    (formData.firstName && formData.lastName
      ? `${formData.firstName} ${formData.lastName}`.trim()
      : "") ||
    formData.gstData?.business_name ||
    formData.aadhaarData?.full_name ||
    "N/A";

  return (
    <>
      <h4 className="mb-12">Review Your Details</h4>

      <div className="alert alert-success mb-16">
        All your details have been saved. Please review below and click <strong>Complete</strong> to finish registration.
      </div>

      <div className="card border mb-16">
        <div className="card-body p-16">
          <h6 className="mb-16 fw-semibold">Account Information</h6>
          {(formData.firstName || formData.lastName) && (
            <>
              <div className="mb-8">
                <span className="text-secondary-light text-sm">First Name:</span>
                <span className="ms-8 fw-medium">{formData.firstName || "—"}</span>
              </div>
              <div className="mb-8">
                <span className="text-secondary-light text-sm">Last Name:</span>
                <span className="ms-8 fw-medium">{formData.lastName || "—"}</span>
              </div>
            </>
          )}
          <div className="mb-8">
            <span className="text-secondary-light text-sm">Email:</span>
            <span className="ms-8 fw-medium">{formData.email || "N/A"}</span>
          </div>
          <div className="mb-8">
            <span className="text-secondary-light text-sm">Phone:</span>
            <span className="ms-8 fw-medium">{formData.phone || "N/A"}</span>
          </div>
          <div>
            <span className="text-secondary-light text-sm">Profile Name:</span>
            <span className="ms-8 fw-medium">{profileName}</span>
          </div>
        </div>
      </div>

      <div className="card border mb-16">
        <div className="card-body p-16">
          <h6 className="mb-16 fw-semibold">PAN Card Details</h6>
          {formData.panData ? (
            <>
              <div className="mb-8">
                <span className="text-secondary-light text-sm">PAN Number:</span>
                <span className="ms-8 fw-medium">
                  {formData.panData.pan_number ? maskPanNumber(formData.panData.pan_number) : "N/A"}
                </span>
              </div>
              <div className="mb-8">
                <span className="text-secondary-light text-sm">Name:</span>
                <span className="ms-8 fw-medium">{formData.panData.full_name}</span>
              </div>
              <div className="mb-8">
                <span className="text-secondary-light text-sm">DOB:</span>
                <span className="ms-8 fw-medium">{formatDobToDDMMYYYY(formData.panData.dob)}</span>
              </div>
              <div>
                <span className="text-secondary-light text-sm">Category:</span>
                <span className="ms-8 fw-medium">{formData.panData.category}</span>
              </div>
            </>
          ) : (
            <p className="text-secondary-light text-sm mb-0">No PAN data</p>
          )}
        </div>
      </div>

      <div className="card border mb-16">
        <div className="card-body p-16">
          <h6 className="mb-16 fw-semibold">Aadhaar Card Details</h6>
          {formData.aadhaarData ? (
            <>
              <div className="mb-8">
                <span className="text-secondary-light text-sm">Aadhaar Number:</span>
                <span className="ms-8 fw-medium">
                  {formData.aadhaarData.aadhaar_number
                    ? `${formData.aadhaarData.aadhaar_number.slice(0, 4)}****${formData.aadhaarData.aadhaar_number.slice(-4)}`
                    : "N/A"}
                </span>
              </div>
              <div className="mb-8">
                <span className="text-secondary-light text-sm">Name:</span>
                <span className="ms-8 fw-medium">{formData.aadhaarData.full_name}</span>
              </div>
              <div>
                <span className="text-secondary-light text-sm">DOB:</span>
                <span className="ms-8 fw-medium">{formatDobToDDMMYYYY(formData.aadhaarData.dob)}</span>
              </div>
            </>
          ) : (
            <p className="text-secondary-light text-sm mb-0">No Aadhaar data</p>
          )}
        </div>
      </div>

      {formData.gstData && (
        <div className="card border mb-16">
          <div className="card-body p-16">
            <h6 className="mb-16 fw-semibold">GST Details</h6>
            <div className="mb-8">
              <span className="text-secondary-light text-sm">GSTIN:</span>
              <span className="ms-8 fw-medium">{formData.gstData.gstin}</span>
            </div>
            <div className="mb-8">
              <span className="text-secondary-light text-sm">Business Name:</span>
              <span className="ms-8 fw-medium">{formData.gstData.business_name}</span>
            </div>
            <div className="mb-8">
              <span className="text-secondary-light text-sm">Legal Name:</span>
              <span className="ms-8 fw-medium">{formData.gstData.legal_name}</span>
            </div>
            <div>
              <span className="text-secondary-light text-sm">Status:</span>
              <span className="ms-8 fw-medium">{formData.gstData.gstin_status}</span>
            </div>
          </div>
        </div>
      )}

      <div className="card border mb-16">
        <div className="card-body p-16">
          <h6 className="mb-16 fw-semibold">Digital Signature</h6>
          {formData.signature ? (
            <div>
              <span className="text-secondary-light text-sm">Signature Status:</span>
              <span className="ms-8 fw-medium text-success">Uploaded</span>
              {formData.signature.signatureFilename ? (
                <div className="mt-12">
                  <img
                    src={`${(import.meta as any).env?.VITE_IMAGE_UPLOAD_PATH || "http://localhost:3001/uploads"}/signatures/${formData.signature.signatureFilename}`}
                    alt="Signature preview"
                    className="rounded border bg-white"
                    style={{ maxWidth: "100%", maxHeight: "120px", objectFit: "contain" }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              ) : null}
              {formData.signature.signatureHash ? (
                <div className="mt-8">
                  <small className="text-secondary-light">
                    Hash: {formData.signature.signatureHash.substring(0, 16)}...
                  </small>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-secondary-light text-sm mb-0">No signature uploaded</p>
          )}
        </div>
      </div>

      <button
        type="button"
        className="btn btn-outline-secondary w-100 radius-12 mb-12"
        onClick={(e) => {
          e.preventDefault();
          onBack();
        }}
        disabled={loading}
      >
        Back
      </button>

      <button
        type="button"
        className="btn btn-primary w-100 radius-12"
        onClick={(e) => {
          e.preventDefault();
          handleComplete();
        }}
        disabled={loading}
      >
        {loading ? "Completing..." : "Complete"}
      </button>
    </>
  );
};

export default Step10;

