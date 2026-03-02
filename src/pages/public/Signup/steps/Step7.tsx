import { getMstResellerByEmail, completeSignupStep } from "@/hasura/mutations";
import { Step6Props } from "@/types/auth/signup";
import { useEffect, useRef, useState } from "react";
import SignaturePad from "@/components/SignaturePad";
import { getAuthToken } from "@/utils/auth";
import { useStepValidation } from "@/hooks/useStepValidation";

interface UserData {
  address?: string | string[];
  business_address?: string;
  business_email?: string;
  is_aadhaar_verified?: boolean;
  is_email_verified?: boolean;
  is_gst_verified?: boolean;
  is_pan_verified?: boolean;
  is_phone_verified?: boolean;
  signup_completed?: boolean;
  status?: string;
  current_step?: number;
  aadhaar_number?: string;
  aadhar_photo?: string;
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
  logo?: string;
  id?: string;
}

const Step6 = ({ email, onBack, onSubmit }: Step6Props) => {
  // Validate step access
  const { isValid, loading: validatingStep } = useStepValidation({ email, currentStep: 7 });
  const [logo, setLogo] = useState<string>("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUploaded, setLogoUploaded] = useState<boolean>(false);
  const [uploadingLogo, setUploadingLogo] = useState<boolean>(false);
  const [brandName, setBrandName] = useState<string>("");
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [signature, setSignature] = useState<string>("");
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signatureUploaded, setSignatureUploaded] = useState<boolean>(false);
  const [uploadingSignature, setUploadingSignature] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    console.log("Step7 useEffect called");
    const fetchUserData = async () => {
      try {
        const result = await getMstResellerByEmail({ email });
        if (result?.mst_reseller?.[0]) {
          setUserData(result.mst_reseller[0]);
          // Check if logo and signature are already uploaded
          // Store just the filename (database stores filename, not full URL)
          if (result.mst_reseller[0].logo) {
            setLogoUploaded(true);
            const logoValue = result.mst_reseller[0].logo;
            const logoFilename = logoValue.includes('/') ? logoValue.split('/').pop() || logoValue : logoValue;
            setLogo(logoFilename);
          }
          if (result.mst_reseller[0].signatureImage) {
            setSignatureUploaded(true);
            // Extract filename if it's a full URL, otherwise use as is (it's already a filename)
            const signatureValue = result.mst_reseller[0].signatureImage;
            const signatureFilename = signatureValue.includes('/') 
              ? signatureValue.split('/').pop() || signatureValue
              : signatureValue;
            setSignature(signatureFilename);
          }
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

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please upload a valid image file (e.g. JPEG, PNG).");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Logo size should be less than 5MB.");
        return;
      }

      setLogoFile(file);
      setLogoUploaded(false);

      const reader = new FileReader();
      reader.onload = (event) => {
        setLogo(event.target?.result as string);
      };
      reader.readAsDataURL(file);
      setError("");
    }
  };

  const handleUploadLogo = async () => {
    if (!logoFile) {
      setError("Please select a logo first.");
      return;
    }

    setError("");
    setUploadingLogo(true);

    try {
      const token = getAuthToken();
      const { getApiBaseUrl } = await import("@/utils/apiUrl");
      const API_BASE_URL = getApiBaseUrl();
      const IMAGE_UPLOAD_PATH = (import.meta as any).env?.VITE_IMAGE_UPLOAD_PATH || "http://localhost:3001/uploads";

      const uploadFormData = new FormData();
      uploadFormData.append("logo", logoFile);

      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/upload/logo`, {
        method: "POST",
        headers,
        body: uploadFormData,
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.filename) {
          const filename = result.data.filename;
          setLogo(filename);
          setLogoUploaded(true);
          setError("");
        } else {
          setError(result.message || "Failed to upload logo.");
        }
      } else {
        const errorText = await response.text();
        setError(`Failed to upload logo: ${response.status}`);
        console.error("Upload failed:", errorText);
      }
    } catch (uploadErr: any) {
      console.error("Logo upload error:", uploadErr);
      setError(uploadErr.message || "Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  // Upload signature function
  const handleUploadSignature = async () => {
    console.log("handleUploadSignature called");
    if (!signatureFile) {
      setError("Please draw your signature first.");
      console.error("No signature file available");
      return;
    }

    setError("");
    setUploadingSignature(true);
    console.log("Starting signature upload...");

    try {
      const token = getAuthToken();
      const { getApiBaseUrl } = await import("@/utils/apiUrl");
      const API_BASE_URL = getApiBaseUrl();
      const IMAGE_UPLOAD_PATH = (import.meta as any).env?.VITE_IMAGE_UPLOAD_PATH || 'http://localhost:3001/uploads';

      // Create FormData
      const signatureFormData = new FormData();
      signatureFormData.append('signature', signatureFile);

      // Prepare headers
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const uploadUrl = `${API_BASE_URL}/upload/signature`;
      console.log("Uploading signature:", uploadUrl);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: headers,
        body: signatureFormData,
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.filename) {
          // Store only the filename (not the full URL) to send to GraphQL
          const filename = result.data.filename;
          const signatureUrl = `${IMAGE_UPLOAD_PATH}/signatures/${filename}`;
          console.log("✅ Signature uploaded successfully");
          console.log("Filename from server:", filename);
          console.log("Full signature URL (for preview):", signatureUrl);
          // Store filename for GraphQL, but use full URL for preview
          setSignature(filename);
          setSignatureUploaded(true);
          setError("");
        } else {
          setError(result.message || "Failed to upload signature");
        }
      } else {
        const errorText = await response.text();
        setError(`Failed to upload signature: ${response.status}`);
        console.error("Upload failed:", errorText);
      }
    } catch (uploadErr: any) {
      console.error("Signature upload error:", uploadErr);
      setError(uploadErr.message || "Failed to upload signature");
    } finally {
      setUploadingSignature(false);
    }
  };

  // Get address from Aadhaar, GST, or PAN (in priority order)
  const getAddressFromKYC = (): string => {
    if (!userData) return "";
    
    // Priority: Aadhaar address > GST business address > PAN address (if available)
    if (userData.address) {
      // If address is an array, join it
      if (Array.isArray(userData.address)) {
        return userData.address.filter((line: string) => line?.trim()).join(", ");
      }
      return userData.address;
    }
    
    if (userData.business_address) {
      return userData.business_address;
    }
    
    return "";
  };

  const handleSubmit = async () => {
    setError("");
    
    if (!logoUploaded) {
      setError("Please upload your logo first.");
      return;
    }
    if (!signatureUploaded) {
      setError("Please upload your signature first.");
      return;
    }
    
    if (!acceptedTerms) {
      setError("Please accept Terms & Conditions.");
      return;
    }
    
    setLoading(true);
    try {
      // Fetch latest userData to ensure we have all fields
      let latestUserData = userData;
      if (email) {
        try {
          const fetchedData = await getMstResellerByEmail({ email });
          if (fetchedData?.mst_reseller?.[0]) {
            latestUserData = fetchedData.mst_reseller[0];
          }
        } catch (err) {
          console.warn("Failed to fetch reseller data:", err);
        }
      }
      
      // Get address from KYC data (Aadhaar/GST/PAN) - optional
      const address = getAddressFromKYC();
      
      // Prepare address - convert string to array if needed
      let addressArray: string[] = [];
      if (typeof address === 'string') {
        addressArray = address.split(',').map(a => a.trim()).filter(a => a);
      } else if (Array.isArray(address)) {
        addressArray = address;
      }

      // Determine DOB - prioritize Aadhaar DOB, fallback to PAN DOB
      let dobToSave = latestUserData?.dob || latestUserData?.pan_dob || null;
      
      const signatureFilename = signature || null;

      await completeSignupStep({
        email,
        address: addressArray.length > 0 ? addressArray : null,
        signatureImage: signatureFilename,
        brand_name: brandName || null,
        // Preserve existing data from latestUserData
        aadhaar_number: latestUserData?.aadhaar_number || null,
        dob: dobToSave, // Use Aadhaar DOB if available, otherwise PAN DOB
        pan_number: latestUserData?.pan_number || null,
        pan_dob: latestUserData?.pan_dob || null,
        pan_full_name: latestUserData?.pan_full_name || null,
        is_pan_verified: latestUserData?.is_pan_verified !== undefined ? latestUserData.is_pan_verified : true,
        is_aadhaar_verified: latestUserData?.is_aadhaar_verified !== undefined ? latestUserData.is_aadhaar_verified : true,
        business_address: latestUserData?.business_address || null,
        business_email: latestUserData?.business_email || null,
        aadhar_photo: latestUserData?.aadhar_photo || null,
      });
      onSubmit();
    } catch (err) {
      console.error(err);
      setError("Failed to complete signup. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Show loading while validating step access
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
          {/* Name, Logo, Address */}
          <div className="mb-16">
            <strong className="d-block mb-8">Personal Details</strong>
            <div className="ps-12">
              <p className="text-sm mb-4"><strong>Name:</strong> {userData.first_name} {userData.last_name}</p>
              <p className="text-sm mb-4"><strong>Email:</strong> {userData.email}</p>
              <p className="text-sm mb-4"><strong>Phone:</strong> {userData.phone}</p>
              <p className="text-sm mb-4"><strong>Logo:</strong> {userData.logo ? (
                <img
                  src={userData.logo.startsWith("data:") || userData.logo.startsWith("http") ? userData.logo : `${(import.meta as any).env?.VITE_IMAGE_UPLOAD_PATH || "http://localhost:3001/uploads"}/logos/${userData.logo}`}
                  alt="Logo"
                  style={{ height: 32, objectFit: "contain" }}
                />
              ) : "N/A"}</p>
              <p className="text-sm"><strong>Address:</strong> {userData.address || "N/A"}</p>
            </div>
          </div>
        </div>
      )}
      {/* Brand Name */}
      <div className="mb-24">
        <label className="form-label fw-semibold text-primary-light text-sm mb-8">
          Brand Name 
        </label>
        <input
          className="form-control h-56-px"
          placeholder="Enter your brand name"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
        />
      </div>

      {/* Digital Signature Pad */}
      <div className="mb-24">
        <strong className="d-block mb-12">Digital Signature</strong>
        <p className="text-sm text-secondary-light mb-12">
          Please sign in the box below using your mouse or touch screen
        </p>
        <SignaturePad
          onSignatureChange={(signatureDataUrl, signatureFile) => {
            setSignature(signatureDataUrl || "");
            setSignatureFile(signatureFile || null);
            setSignatureUploaded(false); // Reset upload status when signature changes
            setError("");
          }}
          width={600}
          height={200}
          penColor="#000000"
          backgroundColor="#ffffff"
        />
        {signature && (
          <div className="mt-12">
            {signatureUploaded ? (
              <small className="text-success d-block mb-8">✓ Signature uploaded successfully</small>
            ) : (
              <>
                <small className="text-info d-block mb-8">✓ Signature captured - Please upload it</small>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("Upload Signature button clicked");
                    handleUploadSignature();
                  }}
                  disabled={uploadingSignature || signatureUploaded}
                >
                  {uploadingSignature ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Uploading...
                    </>
                  ) : signatureUploaded ? (
                    <>
                      <span className="text-success me-2">✓</span>
                      Uploaded
                    </>
                  ) : (
                    "Upload Signature"
                  )}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Logo Upload */}
      <div className="mb-24">
        <strong className="d-block mb-12">Business Logo</strong>
        <p className="text-sm text-secondary-light mb-12">
          Upload your business logo (JPEG, PNG, GIF or WebP, max 5MB).
        </p>
        <div className="d-flex align-items-center gap-12">
          {logo ? (
            <div
              className="border radius-8 overflow-hidden bg-light d-flex align-items-center justify-content-center"
              style={{ width: "100px", height: "100px", flexShrink: 0 }}
            >
              <img
                src={
                  logo.startsWith("data:")
                    ? logo
                    : `${(import.meta as any).env?.VITE_IMAGE_UPLOAD_PATH || "http://localhost:3001/uploads"}/logos/${logo}`
                }
                alt="Logo preview"
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                onError={(e) => {
                  e.currentTarget.src = "assets/images/logo-icon.png";
                }}
              />
            </div>
          ) : (
            <div
              className="border border-secondary-light radius-8 bg-light d-flex align-items-center justify-content-center"
              style={{ width: "100px", height: "100px", flexShrink: 0 }}
            >
              <span className="text-secondary-light text-xs">No logo</span>
            </div>
          )}
          <div className="flex-grow-1">
            <button
              type="button"
              className="btn btn-outline-primary mb-8"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
            >
              {logo ? "Change" : "Select"} Logo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoSelect}
              style={{ display: "none" }}
            />
            {logoFile && (
              <div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleUploadLogo();
                  }}
                  disabled={uploadingLogo || logoUploaded}
                >
                  {uploadingLogo ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                      Uploading...
                    </>
                  ) : logoUploaded ? (
                    <>
                      <span className="text-success me-2">✓</span>
                      Uploaded
                    </>
                  ) : (
                    "Upload Logo"
                  )}
                </button>
                {logoUploaded && (
                  <small className="text-success ms-2 d-block mt-4">Logo uploaded successfully</small>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Address Display (from KYC) */}
      {getAddressFromKYC() && (
        <div className="alert alert-info mb-24">
          <strong className="d-block mb-8">Address (from KYC verification):</strong>
          <p className="text-sm mb-0">{getAddressFromKYC()}</p>
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
        disabled={!logoUploaded || !signatureUploaded || !acceptedTerms || loading}
        onClick={handleSubmit}
      >
        {loading ? "Submitting..." : "Confirm & Complete Signup"}
      </button>
      {(!logoUploaded || !signatureUploaded) && (
        <div className="mt-8">
          <small className="text-warning d-block">
            {!logoUploaded && !signatureUploaded && "Please upload both logo and signature to continue"}
            {!logoUploaded && signatureUploaded && "Please upload logo to continue"}
            {logoUploaded && !signatureUploaded && "Please upload signature to continue"}
          </small>
        </div>
      )}
    </>
  );
};

export default Step6;
