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
  id?: string;
}

const Step6 = ({ email, onBack, onSubmit }: Step6Props) => {
  // Validate step access
  const { isValid, loading: validatingStep } = useStepValidation({ email, currentStep: 7 });
  const [profileImage, setProfileImage] = useState<string>("");
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImageUploaded, setProfileImageUploaded] = useState<boolean>(false);
  const [uploadingProfileImage, setUploadingProfileImage] = useState<boolean>(false);
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
          // Check if profile image and signature are already uploaded
          // Store just the filename (database stores filename, not full URL)
          if (result.mst_reseller[0].profile_image) {
            setProfileImageUploaded(true);
            // Extract filename if it's a full URL, otherwise use as is (it's already a filename)
            const profileImageValue = result.mst_reseller[0].profile_image;
            const profileImageFilename = profileImageValue.includes('/') 
              ? profileImageValue.split('/').pop() || profileImageValue
              : profileImageValue;
            setProfileImage(profileImageFilename);
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
      setProfileImageUploaded(false); // Reset upload status when file changes

      // Create preview (temporary data URL, will be replaced with filename after upload)
      const reader = new FileReader();
      reader.onload = (event) => {
        // Temporarily set preview URL, will be replaced with filename after upload
        setProfileImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
      setError("");
    }
  };

  // Upload profile image function
  const handleUploadProfileImage = async () => {
    console.log("handleUploadProfileImage called");
    if (!profileImageFile) {
      setError("Please select a profile image first.");
      console.error("No profile image file selected");
      return;
    }

    setError("");
    setUploadingProfileImage(true);
    console.log("Starting profile image upload...");

    try {
      const token = getAuthToken();
      const { getApiBaseUrl } = await import("@/utils/apiUrl");
      const API_BASE_URL = getApiBaseUrl();
      const IMAGE_UPLOAD_PATH = (import.meta as any).env?.VITE_IMAGE_UPLOAD_PATH || 'http://localhost:3001/uploads';

      // Create FormData
      const uploadFormData = new FormData();
      uploadFormData.append('profile_image', profileImageFile);

      // Prepare headers
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const uploadUrl = `${API_BASE_URL}/upload/profile-image`;
      console.log("=== PROFILE IMAGE UPLOAD START ===");
      console.log("Upload URL:", uploadUrl);
      console.log("File:", {
        name: profileImageFile.name,
        size: profileImageFile.size,
        type: profileImageFile.type
      });
      console.log("Headers:", headers);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: headers,
        body: uploadFormData,
      });

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      if (response.ok) {
        const result = await response.json();
        console.log("Response data:", result);
        
        if (result.success && result.data?.filename) {
          // Store only the filename (not the full URL) to send to GraphQL
          const filename = result.data.filename;
          const imageUrl = `${IMAGE_UPLOAD_PATH}/profile-images/${filename}`;
          console.log("✅ Profile image uploaded successfully");
          console.log("Filename from server:", filename);
          console.log("Full image URL (for preview):", imageUrl);
          // Store filename for GraphQL, but use full URL for preview
          setProfileImage(filename);
          setProfileImageUploaded(true);
          setError("");
        } else {
          console.error("❌ Upload response missing filename:", result);
          setError(result.message || "Failed to upload profile image - no filename returned");
        }
      } else {
        const errorText = await response.text();
        console.error("❌ Upload failed - Status:", response.status);
        console.error("Error response:", errorText);
        setError(`Failed to upload profile image: ${response.status} - ${errorText}`);
      }
      
      console.log("=== PROFILE IMAGE UPLOAD END ===");
    } catch (uploadErr: any) {
      console.error("Profile image upload error:", uploadErr);
      setError(uploadErr.message || "Failed to upload profile image");
    } finally {
      setUploadingProfileImage(false);
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
    
    // Check if both are uploaded
    if (!profileImageUploaded) {
      setError("Please upload your profile image first.");
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
      
      // profileImage and signature now contain just the filename (stored after upload)
      // Use them directly for GraphQL
      const profileImageFilename = profileImage || null;
      const signatureFilename = signature || null;
      
      console.log("Submitting signup with data:", {
        email,
        profile_image: profileImageFilename,
        signatureImage: signatureFilename,
        aadhaar_number: latestUserData?.aadhaar_number,
        dob: dobToSave,
        aadhar_photo: latestUserData?.aadhar_photo ? "present" : "missing",
      });
      
      await completeSignupStep({
        email,
        profile_image: profileImageFilename,
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
                src={
                  // If it's a data URL (preview before upload), use as is
                  // Otherwise, construct full URL from filename
                  profileImage.startsWith('data:') 
                    ? profileImage 
                    : `${(import.meta as any).env?.VITE_IMAGE_UPLOAD_PATH || 'http://localhost:3001/uploads'}/profile-images/${profileImage}`
                }
                alt="Profile Preview"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => {
                  // Fallback if image fails to load
                  e.currentTarget.src = 'assets/images/user.png';
                }}
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
          <div className="flex-grow-1">
            <button
              type="button"
              className="btn btn-outline-primary mb-8"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingProfileImage}
            >
              {profileImage ? "Change" : "Select"} Photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: "none" }}
            />
            {profileImageFile && (
              <div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("Upload Profile Image button clicked");
                    handleUploadProfileImage();
                  }}
                  disabled={uploadingProfileImage || profileImageUploaded}
                >
                  {uploadingProfileImage ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Uploading...
                    </>
                  ) : profileImageUploaded ? (
                    <>
                      <span className="text-success me-2">✓</span>
                      Uploaded
                    </>
                  ) : (
                    "Upload Profile Image"
                  )}
                </button>
                {profileImageUploaded && (
                  <small className="text-success ms-2 d-block mt-4">Profile image uploaded successfully</small>
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
        disabled={!profileImageUploaded || !signatureUploaded || !acceptedTerms || loading}
        onClick={handleSubmit}
      >
        {loading ? "Submitting..." : "Confirm & Complete Signup"}
      </button>
      {(!profileImageUploaded || !signatureUploaded) && (
        <div className="mt-8">
          <small className="text-warning d-block">
            {!profileImageUploaded && !signatureUploaded && "Please upload both profile image and signature to continue"}
            {!profileImageUploaded && signatureUploaded && "Please upload profile image to continue"}
            {profileImageUploaded && !signatureUploaded && "Please upload signature to continue"}
          </small>
        </div>
      )}
    </>
  );
};

export default Step6;
