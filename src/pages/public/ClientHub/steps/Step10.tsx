import { useState } from "react";
import { createMstCustomer, checkMstCustomerExists } from "@/hasura/mutations/customer";

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
    } | null;
  };
  resellerId: string;
  onBack: () => void;
  onSubmit: () => void;
}

const Step10 = ({ formData, resellerId, onBack, onSubmit }: Step10Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Hash password on client side - Note: In production, this should be done on backend
  const hashPassword = async (password: string): Promise<string> => {
    // Using Web Crypto API for hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    // For production, use bcrypt on backend
    return hashHex; // This is a placeholder - backend should handle password hashing
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      // Check if customer already exists
      const existsCheck = await checkMstCustomerExists(formData.email, formData.phone);
      if (existsCheck.exists) {
        setError("A customer with this email or phone number already exists.");
        setLoading(false);
        return;
      }

      // Prepare date strings for DOB
      const formatDateForDB = (dateStr: string): string | null => {
        if (!dateStr) return null;
        try {
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return null;
          return date.toISOString().split("T")[0]; // YYYY-MM-DD format
        } catch {
          return null;
        }
      };

      // Determine profile name based on GST or Aadhaar
      const profileName =
        formData.gstData?.business_name || formData.aadhaarData?.full_name || null;

      // Note: Password should be hashed on backend with bcrypt
      // For now using SHA-256, but backend API should handle bcrypt hashing
      // TODO: Create backend API endpoint that receives plain password and hashes with bcrypt
      const passwordHash = await hashPassword(formData.password);

      // Prepare customer data
      const customerData = {
        reseller_id: resellerId,
        email: formData.email,
        password_hash: passwordHash,
        phone: formData.phone,
        business_email: formData.email, // Using email as business email
        profile_name: profileName,
        profile_image: formData.aadhaarData?.profile_image || null,
        signature_hash: formData.signature?.signatureHash || null,
        signature_metadata: formData.signature?.signatureMetadata || null,
        signature_storage_url: null, // Can be updated later if storing signature file
        address: formData.aadhaarData?.address || null,
        pan_number: formData.panData?.pan_number || null,
        pan_full_name: formData.panData?.full_name || null,
        pan_dob: formatDateForDB(formData.panData?.dob || ""),
        aadhaar_number: formData.aadhaarData?.aadhaar_number || null,
        aadhaar_dob: formatDateForDB(formData.aadhaarData?.dob || ""),
        dob_match_verified: formData.panData && formData.aadhaarData ? true : false,
        gender: formData.aadhaarData?.gender || formData.panData?.gender || null,
        gstin: formData.gstData?.gstin || null,
        business_name: formData.gstData?.business_name || null,
        max_virtual_numbers: 3, // Default value
      };

      // Create customer
      const result = await createMstCustomer(customerData);

      if (result.success) {
        onSubmit();
      } else {
        setError(result.message || "Failed to submit. Please try again.");
      }
    } catch (err: any) {
      console.error("Error submitting form:", err);
      setError(err.message || "Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Determine profile name based on GST or Aadhaar (for display only)
  const profileName = formData.gstData?.business_name || formData.aadhaarData?.full_name || "N/A";

  return (
    <>
      <h4 className="mb-12">Review Your Details</h4>

      {error && <div className="alert alert-danger mb-12">{error}</div>}

      <div className="card border mb-16">
        <div className="card-body p-16">
          <h6 className="mb-16 fw-semibold">Account Information</h6>
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
                <span className="ms-8 fw-medium">{formData.panData.pan_number}</span>
              </div>
              <div className="mb-8">
                <span className="text-secondary-light text-sm">Name:</span>
                <span className="ms-8 fw-medium">{formData.panData.full_name}</span>
              </div>
              <div className="mb-8">
                <span className="text-secondary-light text-sm">DOB:</span>
                <span className="ms-8 fw-medium">{formData.panData.dob}</span>
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
                <span className="ms-8 fw-medium">{formData.aadhaarData.dob}</span>
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
              <div className="mt-8">
                <small className="text-secondary-light">
                  Hash: {formData.signature.signatureHash.substring(0, 16)}...
                </small>
              </div>
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
          handleSubmit();
        }}
        disabled={loading}
      >
        {loading ? "Submitting..." : "Submit & Continue"}
      </button>
    </>
  );
};

export default Step10;

