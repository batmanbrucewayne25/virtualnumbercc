import getMstResellerByEmail, { completeSignupStep } from "@/hasura/mutations";
import { Step6Props } from "@/types/auth/signup";
import { useEffect, useRef, useState } from "react";

interface UserData {
  address?: string;
  business_address?: string;
  is_aadhaar_verified?: boolean;
  is_email_verified?: boolean;
  is_gst_verified?: boolean;
  is_pan_verified?: boolean;
  is_phone_verified?: boolean;
  signup_completed?: boolean;
  status?: string;
  current_step?: number;
  aadhaar_number?: string;
  business_name?: string;
  constitution_of_business?: string;
  dob?: string;
  email?: string;
  first_name?: string;
  gender?: string;
  gst_pan_number?: string;
  gstin?: string;
  gstin_status?: string;
  last_name?: string;
  legal_name?: string;
  nature_bus_activities?: string;
  pan_dob?: string;
  pan_full_name?: string;
  pan_number?: string;
  phone?: string;
  profile_image?: string;
  id?: string;
}

const Step6 = ({ email, onBack, onSubmit }: Step6Props) => {
  const [profileImage, setProfileImage] = useState<string>("");
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [addressLines, setAddressLines] = useState<string[]>(["", "", ""]);
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [signature, setSignature] = useState<string>("");
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
    // Handle signature upload
    const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (!file.type.startsWith("image/")) {
          setError("Please upload a valid signature image file.");
          return;
        }
        if (file.size > 2 * 1024 * 1024) {
          setError("Signature image size should be less than 2MB.");
          return;
        }
        setSignatureFile(file);
        const reader = new FileReader();
        reader.onload = (event) => {
          setSignature(event.target?.result as string);
        };
        reader.readAsDataURL(file);
        setError("");
      }
    };
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const result = await getMstResellerByEmail({ email });
        if (result?.mst_reseller?.[0]) {
          setUserData(result.mst_reseller[0]);
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      } finally {
        setLoadingData(false);
      }
    };

    if (email) {
      fetchUserData();
    }
  }, [email]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please upload a valid image file.");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size should be less than 5MB.");
        return;
      }

      setProfileImageFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setProfileImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
      setError("");
    }
  };

  const handleAddressChange = (index: number, value: string) => {
    const updatedAddress = [...addressLines];
    updatedAddress[index] = value;
    setAddressLines(updatedAddress);
  };

  const getFullAddress = (): string => {
    return addressLines.filter((line) => line.trim()).join(", ");
  };

  const handleSubmit = async () => {
    setError("");
    if (!profileImage) {
      setError("Please upload a profile image.");
      return;
    }
    if (!signature) {
      setError("Please upload your signature.");
      return;
    }
    if (!getFullAddress()) {
      setError("Please enter your full address.");
      return;
    }
    if (!acceptedTerms) {
      setError("Please accept Terms & Conditions.");
      return;
    }
    setLoading(true);
    try {
      // You may need to update the mutation to accept signature and status
      await completeSignupStep({
        email,
        profile_image: profileImage,
        address: getFullAddress(),
        signature,
        status: false,
      });
      onSubmit();
    } catch (err) {
      console.error(err);
      setError("Failed to complete signup. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="text-center py-24">
        <p>Loading KYC details...</p>
      </div>
    );
  }

  return (
    <>
      <h4 className="mb-24 text-center">KYC Details Completion</h4>

      {error && <div className="alert alert-danger mb-12">{error}</div>}

      {/* KYC Summary */}
      {userData && (
        <div className="border radius-12 p-16 mb-24 bg-light">
          <h6 className="mb-16">KYC Summary</h6>
          {/* GST Details (if available) */}
          {userData.is_gst_verified && (
            <div className="mb-16">
              <strong className="d-block mb-8 text-success">✓ GST Verified</strong>
              <div className="ps-12">
                <p className="text-sm mb-4"><strong>Business Name:</strong> {userData.business_name || "N/A"}</p>
                <p className="text-sm mb-4"><strong>Business Type:</strong> {userData.constitution_of_business || "N/A"}</p>
                <p className="text-sm mb-4"><strong>Business PAN:</strong> {userData.gst_pan_number || "N/A"}</p>
                <p className="text-sm mb-4"><strong>Business Address:</strong> {userData.business_address || userData.address || "N/A"}</p>
                <p className="text-sm mb-4"><strong>GSTIN:</strong> {userData.gstin || "N/A"}</p>
                <p className="text-sm mb-4"><strong>Status:</strong> {userData.gstin_status || "N/A"}</p>
              </div>
            </div>
          )}
          {/* PAN Details */}
          {userData.is_pan_verified && (
            <div className="mb-16">
              <strong className="d-block mb-8 text-success">✓ PAN Verified</strong>
              <div className="ps-12">
                <p className="text-sm mb-4"><strong>Name:</strong> {userData.pan_full_name || "N/A"}</p>
                <p className="text-sm mb-4"><strong>PAN:</strong> {userData.pan_number || "N/A"}</p>
                <p className="text-sm"><strong>DOB:</strong> {userData.pan_dob || "N/A"}</p>
              </div>
            </div>
          )}
          {/* Aadhaar Details */}
          {userData.is_aadhaar_verified && (
            <div className="mb-16">
              <strong className="d-block mb-8 text-success">✓ Aadhaar Verified</strong>
              <div className="ps-12">
                <p className="text-sm mb-4"><strong>Aadhaar Number:</strong> {userData.aadhaar_number ? `XXXX-XXXX-${userData.aadhaar_number.slice(-4)}` : "N/A"}</p>
                <p className="text-sm mb-4"><strong>Gender:</strong> {userData.gender || "N/A"}</p>
                <p className="text-sm"><strong>DOB:</strong> {userData.dob || "N/A"}</p>
              </div>
            </div>
          )}
          {/* Name, Photo, Address */}
          <div className="mb-16">
            <strong className="d-block mb-8">Personal Details</strong>
            <div className="ps-12">
              <p className="text-sm mb-4"><strong>Name:</strong> {userData.first_name} {userData.last_name}</p>
              <p className="text-sm mb-4"><strong>Email:</strong> {userData.email}</p>
              <p className="text-sm mb-4"><strong>Phone:</strong> {userData.phone}</p>
              <p className="text-sm mb-4"><strong>Photo:</strong> {userData.profile_image ? <img src={userData.profile_image} alt="Profile" style={{height:32}} /> : "N/A"}</p>
              <p className="text-sm"><strong>Address:</strong> {userData.address || "N/A"}</p>
            </div>
          </div>
        </div>
      )}
      {/* Signature Upload */}
      <div className="mb-24">
        <strong className="d-block mb-12">Signature</strong>
        <div className="d-flex align-items-center gap-12">
          {signature ? (
            <div
              className="border radius-8 overflow-hidden"
              style={{ width: "100px", height: "40px", flexShrink: 0 }}
            >
              <img
                src={signature}
                alt="Signature Preview"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>
          ) : (
            <div
              className="border border-secondary-light radius-8 bg-light d-flex align-items-center justify-content-center"
              style={{ width: "100px", height: "40px", flexShrink: 0 }}
            >
              <span className="text-secondary-light text-xs">No signature</span>
            </div>
          )}
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => signatureInputRef.current?.click()}
          >
            {signature ? "Change" : "Upload"} Signature
          </button>
          <input
            ref={signatureInputRef}
            type="file"
            accept="image/*"
            onChange={handleSignatureUpload}
            style={{ display: "none" }}
          />
        </div>
      </div>

      {/* Profile Photo Upload */}
      <div className="mb-24">
        <strong className="d-block mb-12">Profile Photo</strong>
        <div className="d-flex align-items-center gap-12">
          {profileImage ? (
            <div
              className="border radius-8 overflow-hidden"
              style={{
                width: "100px",
                height: "100px",
                flexShrink: 0,
              }}
            >
              <img
                src={profileImage}
                alt="Profile Preview"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ) : (
            <div
              className="border border-secondary-light radius-8 bg-light d-flex align-items-center justify-content-center"
              style={{
                width: "100px",
                height: "100px",
                flexShrink: 0,
              }}
            >
              <span className="text-secondary-light text-xs">No image</span>
            </div>
          )}
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            {profileImage ? "Change" : "Upload"} Photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: "none" }}
          />
        </div>
      </div>

      {/* Address Input */}
      <div className="mb-24">
        <strong className="d-block mb-12">Full Address</strong>
        <p className="text-xs text-secondary-light mb-8">Enter your complete address across multiple lines</p>
        {addressLines.map((line, index) => (
          <input
            key={index}
            className="form-control h-40-px mb-8"
            placeholder={`Address Line ${index + 1}`}
            value={line}
            onChange={(e) => handleAddressChange(index, e.target.value)}
          />
        ))}
      </div>

      {getFullAddress() && (
        <div className="alert alert-info mb-24">
          <strong className="d-block mb-8">Address Preview:</strong>
          <p className="text-sm">{getFullAddress()}</p>
        </div>
      )}

      {/* Terms Checkbox */}
      <div className="form-check mb-24">
        <input
          className="form-check-input"
          id="termsCheckbox"
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
        />
        <label className="form-check-label" htmlFor="termsCheckbox">
          I agree to Terms & Conditions and confirm that all information provided is accurate.
        </label>
      </div>

      {/* Action Buttons */}
      <button
        type="button"
        className="btn btn-outline-secondary w-100 radius-12 mb-12"
        onClick={onBack}
      >
        Back
      </button>

      <button
        className="btn btn-success w-100 radius-12"
        disabled={!profileImage || !signature || !getFullAddress() || !acceptedTerms || loading}
        onClick={handleSubmit}
      >
        {loading ? "Submitting..." : "Confirm & Complete Signup"}
      </button>
    </>
  );
};

export default Step6;
