import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect, useRef } from "react";
import { getMstResellerById, updateMstResellerProfileImage, updateMstResellerLogo, updateMstReseller } from "@/hasura/mutations/reseller";
import { getUserData, getAuthToken } from "@/utils/auth";
import { getMstResellerDomainByResellerId } from "@/hasura/mutations/resellerDomain";
import { getApiBaseUrl } from "@/utils/apiUrl";
const IMAGE_UPLOAD_PATH = (import.meta.env.VITE_IMAGE_UPLOAD_PATH || 'http://localhost:3001/uploads').replace(/\/+$/, '');

const ViewProfileLayer = () => {
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [imagePreview, setImagePreview] = useState("assets/images/user-grid/user-grid-img13.png");
  const [resellerId, setResellerId] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [originalImageUrl, setOriginalImageUrl] = useState("assets/images/user-grid/user-grid-img13.png");
  const fileInputRef = useRef(null);
  
  // Logo states
  const [logoPreview, setLogoPreview] = useState("assets/images/logo-icon.png");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [selectedLogoFile, setSelectedLogoFile] = useState(null);
  const [originalLogoUrl, setOriginalLogoUrl] = useState("assets/images/logo-icon.png");
  const logoInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    business_name: "",
    brand_name: "",
    business_email: "",
    gstin: "",
    address: "",
    dob: "",
    gender: "",
    pan_number: "",
    pan_dob: "",
    aadhaar_number: "",
    business_address: "",
    constitution_of_business: "",
    nature_bus_activities: "",
    legal_name: "",
    gst_pan_number: "",
    gstin_status: "",
    custom_domain: "",
  });

  const [domainData, setDomainData] = useState(null);

  useEffect(() => {
    // Get logged-in reseller ID
    const userData = getUserData();
    const token = getAuthToken();
    
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role === 'reseller' && userData?.id) {
          setResellerId(userData.id);
          fetchResellerData(userData.id);
        } else {
          setError("Only resellers can view their profile");
          setFetching(false);
        }
      } catch (err) {
        console.error("Error decoding token:", err);
        setError("Failed to authenticate user");
        setFetching(false);
      }
    } else {
      setError("Please login to view your profile");
      setFetching(false);
    }
  }, []);

  const fetchResellerData = async (id) => {
    setFetching(true);
    setError("");
    try {
      const result = await getMstResellerById(id);
      if (result.success && result.data) {
        // Handle address as array - convert to string for form input
        const addressValue = Array.isArray(result.data.address) 
          ? result.data.address.join('\n')
          : (result.data.address || "");

        setFormData({
          first_name: result.data.first_name || "",
          last_name: result.data.last_name || "",
          email: result.data.email || "",
          phone: result.data.phone || "",
          business_name: result.data.business_name || "",
          brand_name: result.data.brand_name || "",
          business_email: result.data.business_email || "",
          gstin: result.data.gstin || "",
          address: addressValue,
          dob: result.data.dob || "",
          gender: result.data.gender || "",
          pan_number: result.data.pan_number || "",
          pan_dob: result.data.pan_dob || "",
          aadhaar_number: result.data.aadhaar_number || "",
          business_address: result.data.business_address || "",
          constitution_of_business: result.data.constitution_of_business || "",
          nature_bus_activities: result.data.nature_bus_activities || "",
          legal_name: result.data.legal_name || "",
          gst_pan_number: result.data.gst_pan_number || "",
          gstin_status: result.data.gstin_status || "",
          custom_domain: "",
        });

        // Set profile image if available
        if (result.data.profile_image) {
          const imageUrl = result.data.profile_image.startsWith('http')
            ? result.data.profile_image
            : `${IMAGE_UPLOAD_PATH}/profile-images/${result.data.profile_image}`;
          setImagePreview(imageUrl);
          setOriginalImageUrl(imageUrl);
        } else {
          setOriginalImageUrl("assets/images/user-grid/user-grid-img13.png");
        }

        // Set logo if available
        if (result.data.logo) {
          const logoUrl = result.data.logo.startsWith('http')
            ? result.data.logo
            : `${IMAGE_UPLOAD_PATH}/logos/${result.data.logo}`;
          setLogoPreview(logoUrl);
          setOriginalLogoUrl(logoUrl);
        } else {
          setLogoPreview("assets/images/logo-icon.png");
          setOriginalLogoUrl("assets/images/logo-icon.png");
        }

        // Fetch domain data
        try {
          const domainResult = await getMstResellerDomainByResellerId(id);
          if (domainResult.success && domainResult.data) {
            setDomainData(domainResult.data);
            setFormData((prev) => ({
              ...prev,
              custom_domain: domainResult.data.domain || "",
            }));
          }
        } catch (domainErr) {
          console.warn("Error fetching domain:", domainErr);
        }
      } else {
        setError(result.message || "Failed to fetch profile data");
      }
    } catch (err) {
      console.error("Error fetching reseller:", err);
      setError("An error occurred while loading profile");
    } finally {
      setFetching(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result);
    };
    reader.readAsDataURL(file);
    setSelectedFile(file);
    setError("");
  };

  const handleImageUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Please select an image file");
      return;
    }

    if (!resellerId) {
      setError("Unable to determine reseller ID. Please log in again.");
      return;
    }

    setUploadingImage(true);
    setError("");
    setSuccess(false);

    try {
      const token = getAuthToken();
      const apiBase = getApiBaseUrl().replace(/\/+$/, '');

      const uploadFormData = new FormData();
      uploadFormData.append('profile_image', file);

      const response = await fetch(`${apiBase}/upload/profile-image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: uploadFormData,
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        setSuccessMessage("Profile image updated successfully!");
        setError("");
        const imageUrl = `${IMAGE_UPLOAD_PATH}/profile-images/${result.data.filename}`;
        setImagePreview(imageUrl);
        setOriginalImageUrl(imageUrl);

        await fetchResellerData(resellerId);

        setTimeout(() => {
          setSuccess(false);
          setSuccessMessage("");
        }, 3000);
      } else {
        setError(result.message || "Failed to upload profile image");
      }
    } catch (err) {
      console.error("Error uploading image:", err);
      setError(err.message || "An error occurred while uploading image");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSelectedFile(null);
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Logo size should be less than 5MB.");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setLogoPreview(event.target?.result);
    };
    reader.readAsDataURL(file);
    setSelectedLogoFile(file);
    setError("");
  };

  const handleLogoUpload = async () => {
    const file = logoInputRef.current?.files?.[0];
    if (!file) {
      setError("Please select a logo file");
      return;
    }

    if (!resellerId) {
      setError("Unable to determine reseller ID. Please log in again.");
      return;
    }

    setUploadingLogo(true);
    setError("");
    setSuccess(false);

    try {
      const token = getAuthToken();
      const apiBase = getApiBaseUrl().replace(/\/+$/, '');

      const uploadFormData = new FormData();
      uploadFormData.append('logo', file);

      const response = await fetch(`${apiBase}/upload/logo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: uploadFormData,
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        setSuccessMessage("Logo updated successfully!");
        setError("");
        const logoUrl = `${IMAGE_UPLOAD_PATH}/logos/${result.data.filename}`;
        setLogoPreview(logoUrl);
        setOriginalLogoUrl(logoUrl);

        await fetchResellerData(resellerId);

        setTimeout(() => {
          setSuccess(false);
          setSuccessMessage("");
        }, 3000);
      } else {
        setError(result.message || "Failed to upload logo");
      }
    } catch (err) {
      console.error("Error uploading logo:", err);
      setError(err.message || "An error occurred while uploading logo");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
      setSelectedLogoFile(null);
    }
  };

  if (fetching) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted mt-3">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error && !resellerId) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }

  const fullName = `${formData.first_name || ''} ${formData.last_name || ''}`.trim() || 'N/A';
  const displayEmail = formData.email || 'N/A';
  const displayPhone = formData.phone || 'N/A';

  return (
    <div className='row gy-4'>
      <div className='col-lg-4'>
        <div className='user-grid-card position-relative border radius-16 overflow-hidden bg-base h-100'>
          
          <div className='pb-24 ms-16 mb-24 me-16 '>
            <div className='text-center border border-top-0 border-start-0 border-end-0'>
              {/* <div className='position-relative d-inline-block mb-16'>
                <img
                  src={imagePreview}
                  alt='Profile'
                  className='border br-white border-width-2-px w-200-px h-200-px rounded-circle object-fit-cover'
                  onError={(e) => {
                    e.target.src = 'assets/images/user-grid/user-grid-img14.png';
                  }}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-primary position-absolute bottom-0 end-0 rounded-circle p-0 d-flex align-items-center justify-content-center"
                  style={{ width: '36px', height: '36px', zIndex: 10 }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  title="Change Profile Image"
                >
                  <Icon icon="solar:camera-outline" className="icon" style={{ fontSize: '18px' }} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageChange}
                />
              </div> */}
              <h6 className='mb-0 mt-16'>{fullName}</h6>
              <span className='text-secondary-light mb-16'>
                {displayEmail}
              </span>
            </div>

            {/* Image Upload Section */}
            {selectedFile && (
              <div className='card bg-base border mb-24 p-16 radius-8'>
                <div className='d-flex align-items-center justify-content-between'>
                  <div>
                    <h6 className='text-sm fw-semibold text-primary-light mb-2'>New Image Selected</h6>
                    <p className='text-xs text-secondary-light mb-0'>
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                    </p>
                  </div>
                  <div className='d-flex gap-2'>
                    <button
                      type='button'
                      className='btn btn-secondary btn-sm'
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                          setSelectedFile(null);
                          // Reset to original image
                          setImagePreview(originalImageUrl);
                        }
                      }}
                      disabled={uploadingImage}
                    >
                      Cancel
                    </button>
                    <button
                      type='button'
                      className='btn btn-primary btn-sm'
                      onClick={handleImageUpload}
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Icon icon="material-symbols:upload" className="icon me-2" />
                          Upload Image
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error and Success Messages */}
            {error && (
              <div className='alert alert-danger alert-dismissible fade show mb-24' role='alert'>
                {error}
                <button
                  type='button'
                  className='btn-close'
                  onClick={() => setError("")}
                  aria-label='Close'
                ></button>
              </div>
            )}

            {success && successMessage && (
              <div className='alert alert-success alert-dismissible fade show mb-24' role='alert'>
                {successMessage}
                <button
                  type='button'
                  className='btn-close'
                  onClick={() => {
                    setSuccess(false);
                    setSuccessMessage("");
                  }}
                  aria-label='Close'
                ></button>
              </div>
            )}

            {/* Logo Section */}
            <div className='mt-24 mb-24'>
              <h6 className='text-xl mb-16'>Business Logo</h6>
              <div className='d-flex align-items-center gap-3'>
                <div className='position-relative'>
                  <img
                    src={logoPreview}
                    alt='Logo'
                    className='border br-white border-width-2-px w-150-px h-150-px object-fit-contain bg-light radius-8 p-2'
                    onError={(e) => {
                      e.target.src = 'assets/images/logo-icon.png';
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-primary position-absolute top-0 end-0 rounded-circle p-0 d-flex align-items-center justify-content-center"
                    style={{ width: '32px', height: '32px', transform: 'translate(50%, -50%)', zIndex: 10 }}
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    title="Change Logo"
                  >
                    <Icon icon="solar:camera-outline" className="icon" style={{ fontSize: '16px' }} />
                  </button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleLogoChange}
                  />
                </div>
                <div className='flex-grow-1'>
                  <p className='text-sm text-secondary-light mb-2'>
                    Upload your business logo. Supported formats: JPEG, PNG, GIF, WebP (Max 5MB)
                  </p>
                </div>
              </div>
            </div>

            {/* Logo Upload Section */}
            {selectedLogoFile && (
              <div className='card bg-base border mb-24 p-16 radius-8'>
                <div className='d-flex align-items-center justify-content-between'>
                  <div>
                    <h6 className='text-sm fw-semibold text-primary-light mb-2'>New Logo Selected</h6>
                    <p className='text-xs text-secondary-light mb-0'>
                      {selectedLogoFile.name} ({(selectedLogoFile.size / 1024).toFixed(2)} KB)
                    </p>
                  </div>
                  <div className='d-flex gap-2'>
                    <button
                      type='button'
                      className='btn btn-secondary btn-sm'
                      onClick={() => {
                        if (logoInputRef.current) {
                          logoInputRef.current.value = "";
                          setSelectedLogoFile(null);
                          // Reset to original logo
                          setLogoPreview(originalLogoUrl);
                        }
                      }}
                      disabled={uploadingLogo}
                    >
                      Cancel
                    </button>
                    <button
                      type='button'
                      className='btn btn-primary btn-sm'
                      onClick={handleLogoUpload}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Icon icon="material-symbols:upload" className="icon me-2" />
                          Upload Logo
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className='mt-24'>
              <h6 className='text-xl mb-16'>Personal Info</h6>
              <ul>
                <li className='d-flex align-items-center gap-1 mb-12'>
                  <span className='w-30 text-md fw-semibold text-primary-light'>
                    Full Name
                  </span>
                  <span className='w-70 text-secondary-light fw-medium'>
                    : {fullName}
                  </span>
                </li>
                <li className='d-flex align-items-center gap-1 mb-12'>
                  <span className='w-30 text-md fw-semibold text-primary-light'>
                    Email
                  </span>
                  <span className='w-70 text-secondary-light fw-medium'>
                    : {displayEmail}
                  </span>
                </li>
                <li className='d-flex align-items-center gap-1 mb-12'>
                  <span className='w-30 text-md fw-semibold text-primary-light'>
                    Phone Number
                  </span>
                  <span className='w-70 text-secondary-light fw-medium'>
                    : {displayPhone}
                  </span>
                </li>
                {formData.brand_name && (
                  <li className='d-flex align-items-center gap-1 mb-12'>
                    <span className='w-30 text-md fw-semibold text-primary-light'>
                      Brand Name
                    </span>
                    <span className='w-70 text-secondary-light fw-medium'>
                      : {formData.brand_name}
                    </span>
                  </li>
                )}
                {formData.business_name && (
                  <li className='d-flex align-items-center gap-1 mb-12'>
                    <span className='w-30 text-md fw-semibold text-primary-light'>
                      Business Name
                    </span>
                    <span className='w-70 text-secondary-light fw-medium'>
                      : {formData.business_name}
                    </span>
                  </li>
                )}
                {formData.gstin && (
                  <li className='d-flex align-items-center gap-1 mb-12'>
                    <span className='w-30 text-md fw-semibold text-primary-light'>
                      GSTIN
                    </span>
                    <span className='w-70 text-secondary-light fw-medium'>
                      : {formData.gstin}
                    </span>
                  </li>
                )}
                {formData.dob && (
                  <li className='d-flex align-items-center gap-1 mb-12'>
                    <span className='w-30 text-md fw-semibold text-primary-light'>
                      Date of Birth
                    </span>
                    <span className='w-70 text-secondary-light fw-medium'>
                      : {formData.dob}
                    </span>
                  </li>
                )}
                {formData.gender && (
                  <li className='d-flex align-items-center gap-1 mb-12'>
                    <span className='w-30 text-md fw-semibold text-primary-light'>
                      Gender
                    </span>
                    <span className='w-70 text-secondary-light fw-medium'>
                      : {formData.gender}
                    </span>
                  </li>
                )}
                {formData.address && (
                  <li className='d-flex align-items-center gap-1'>
                    <span className='w-30 text-md fw-semibold text-primary-light'>
                      Address
                    </span>
                    <span className='w-70 text-secondary-light fw-medium'>
                      : {Array.isArray(formData.address) ? formData.address.join(', ') : formData.address}
                    </span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
      <div className='col-lg-8'>
        <div className='card h-100'>
          <div className='card-body p-24'>
            <div className='d-flex justify-content-between align-items-center mb-20'>
              <h5 className='mb-0'>Business Information</h5>
              <div className='alert alert-info mb-0 py-8 px-16'>
                <Icon icon='solar:info-circle-outline' className='icon me-2' />
                <small>Only Super Admin can edit reseller profiles. Please contact admin for any changes.</small>
              </div>
            </div>

            {error && (
              <div className='alert alert-danger alert-dismissible fade show' role='alert'>
                {error}
                <button
                  type='button'
                  className='btn-close'
                  onClick={() => setError("")}
                  aria-label='Close'
                ></button>
              </div>
            )}

            {/* Business Information View */}
            <div>
                <div className='row'>
                  {formData.business_name && (
                    <div className='col-sm-6 mb-20'>
                      <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                        Business Name
                      </label>
                      <p className='text-secondary-light mb-0'>{formData.business_name}</p>
                    </div>
                  )}
                  {formData.legal_name && (
                    <div className='col-sm-6 mb-20'>
                      <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                        Legal Name
                      </label>
                      <p className='text-secondary-light mb-0'>{formData.legal_name}</p>
                    </div>
                  )}
                  {formData.brand_name && (
                    <div className='col-sm-6 mb-20'>
                      <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                        Brand Name
                      </label>
                      <p className='text-secondary-light mb-0'>{formData.brand_name}</p>
                    </div>
                  )}
                  {formData.business_email && (
                    <div className='col-sm-6 mb-20'>
                      <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                        Business Email
                      </label>
                      <p className='text-secondary-light mb-0'>{formData.business_email}</p>
                    </div>
                  )}
                  {formData.gstin && (
                    <div className='col-sm-6 mb-20'>
                      <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                        GSTIN
                      </label>
                      <p className='text-secondary-light mb-0'>{formData.gstin}</p>
                    </div>
                  )}
                  {formData.gstin_status && (
                    <div className='col-sm-6 mb-20'>
                      <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                        GSTIN Status
                      </label>
                      <p className='text-secondary-light mb-0'>
                        <span className={`badge ${formData.gstin_status === 'Active' ? 'bg-success' : 'bg-warning'}`}>
                          {formData.gstin_status}
                        </span>
                      </p>
                    </div>
                  )}
                  {formData.gst_pan_number && (
                    <div className='col-sm-6 mb-20'>
                      <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                        GST PAN Number
                      </label>
                      <p className='text-secondary-light mb-0'>{formData.gst_pan_number}</p>
                    </div>
                  )}
                  {formData.constitution_of_business && (
                    <div className='col-sm-6 mb-20'>
                      <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                        Constitution of Business
                      </label>
                      <p className='text-secondary-light mb-0'>{formData.constitution_of_business}</p>
                    </div>
                  )}
                  {formData.nature_bus_activities && (
                    <div className='col-sm-12 mb-20'>
                      <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                        Nature of Business Activities
                      </label>
                      <p className='text-secondary-light mb-0'>
                        {Array.isArray(formData.nature_bus_activities) 
                          ? formData.nature_bus_activities.join(', ') 
                          : formData.nature_bus_activities}
                      </p>
                    </div>
                  )}
                  {formData.business_address && (
                    <div className='col-sm-12 mb-20'>
                      <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                        Business Address
                      </label>
                      <p className='text-secondary-light mb-0'>{formData.business_address}</p>
                    </div>
                  )}
                  {formData.custom_domain && (
                    <div className='col-sm-12 mb-20'>
                      <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                        Custom Domain
                      </label>
                      <p className='text-secondary-light mb-0'>
                        <a href={`https://${formData.custom_domain}`} target='_blank' rel='noopener noreferrer' className='text-primary-600'>
                          {formData.custom_domain}
                          <Icon icon='solar:link-external-outline' className='icon ms-2' style={{ fontSize: '14px' }} />
                        </a>
                      </p>
                    </div>
                  )}
                  {!formData.business_name && !formData.gstin && !formData.business_email && (
                    <div className='col-sm-12'>
                      <div className='alert alert-info mb-0'>
                        <Icon icon='solar:info-circle-outline' className='icon me-2' />
                        <small>No business information available. Please complete your business verification.</small>
                      </div>
                    </div>
                  )}
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewProfileLayer;
