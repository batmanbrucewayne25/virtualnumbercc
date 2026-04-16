import { Icon } from "@iconify/react/dist/iconify.js";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { getMstResellerById, updateMstReseller } from "@/hasura/mutations/reseller";
import {
  formatAddressDisplayMultiline,
  parseAddressInputToStorageArray,
} from "@/utils/addressDisplay.js";
import { getResellerValidity } from "@/hasura/mutations/resellerValidity";
import { getMstResellerDomainByResellerId, upsertMstResellerDomain } from "@/hasura/mutations/resellerDomain";
import { getNumberLimitsByResellerId, upsertNumberLimits } from "@/hasura/mutations/numberLimits";
import { getAuthToken, getUserData } from "@/utils/auth";
import { getApiBaseUrl } from "@/utils/apiUrl";
import SuccessModal from "./SuccessModal";

const EditResellerLayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    business_name: "",
    brand_name: "",
    business_email: "",
    gstin: "",
    status: true,
    address: "",
    dob: "",
    gender: "",
    pan_number: "",
    pan_dob: "",
    aadhaar_number: "",
    business_address: "",
    legal_name: "",
    gst_pan_number: "",
    gstin_status: "",
    validity_date: "",
    custom_domain: "",
    profile_image: "",
    logo: "",
    grace_period_days: "",
    max_virtual_numbers: "",
    price_per_number: "",
  });

  const [domainData, setDomainData] = useState(null);

  // Image/Logo upload state
  const IMAGE_UPLOAD_PATH = (import.meta.env.VITE_IMAGE_UPLOAD_PATH || 'http://localhost:3001/uploads').replace(/\/+$/, '');
  const [imagePreview, setImagePreview] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedLogoFile, setSelectedLogoFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);
  const logoInputRef = useRef(null);

  useEffect(() => {
    // Check if user is admin
    const token = getAuthToken();
    const userData = getUserData();
    
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const role = payload.role || userData?.role;
        if (role === "admin" || role === "super_admin") {
          setIsAdmin(true);
        } else {
          setError("Access denied.You don’t have permission to edit this profile. Contact support for assistance.");
          setFetching(false);
          setTimeout(() => {
            navigate("/reseller-list");
          }, 2000);
          return;
        }
      } catch (err) {
        console.error("Error decoding token:", err);
        setError("Failed to authenticate user");
        setFetching(false);
        return;
      }
    } else {
      setError("Please login to access this page");
      setFetching(false);
      setTimeout(() => {
        navigate("/sign-in");
      }, 2000);
      return;
    }

    const currentId = id;
    console.log("useParams id:", currentId, typeof currentId);
    
    if (!currentId || typeof currentId !== 'string' || currentId.trim() === '') {
      setError("Reseller ID is missing");
      setFetching(false);
      return;
    }

    const resellerId = currentId.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(resellerId)) {
      setError(`Invalid reseller ID format: ${currentId}`);
      setFetching(false);
      return;
    }

    // Only fetch if admin
    if (!isAdmin) {
      return;
    }

    const fetchReseller = async () => {
      setFetching(true);
      setError("");
      try {
        console.log("Fetching reseller with ID:", resellerId);
        const result = await getMstResellerById(resellerId);
        console.log("GraphQL result:", result);
        if (result.success && result.data) {
          // Match KYC / profile display order (specific → broad), not raw DB array order
          const addressValue =
            result.data.address == null || result.data.address === ""
              ? ""
              : formatAddressDisplayMultiline(result.data.address);

          // Fetch validity data
          let validityDate = "";
          try {
            const validityResult = await getResellerValidity(resellerId);
            if (validityResult.success && validityResult.data && validityResult.data.validity_end_date) {
              // Convert validity_end_date to YYYY-MM-DD format for date input
              const endDate = new Date(validityResult.data.validity_end_date);
              validityDate = endDate.toISOString().split('T')[0];
            }
          } catch (validityErr) {
            console.warn("Error fetching validity:", validityErr);
            // Continue without validity date if fetch fails
          }

          // Fetch domain data
          try {
            const domainResult = await getMstResellerDomainByResellerId(resellerId);
            if (domainResult.success && domainResult.data) {
              setDomainData(domainResult.data);
              setFormData((prev) => ({
                ...prev,
                custom_domain: domainResult.data.domain || "",
              }));
            }
          } catch (domainErr) {
            console.warn("Error fetching domain:", domainErr);
            // Continue without domain if fetch fails
          }

          setFormData((prev) => ({
            ...prev,
            first_name: result.data.first_name || "",
            last_name: result.data.last_name || "",
            email: result.data.email || "",
            phone: result.data.phone || "",
            business_name: result.data.business_name || "",
            brand_name: result.data.brand_name || "",
            business_email: result.data.business_email || "",
            gstin: result.data.gstin || "",
            status: result.data.status !== undefined ? result.data.status : true,
            address: addressValue,
            dob: result.data.dob || "",
            gender: result.data.gender || "",
            pan_number: result.data.pan_number || "",
            pan_dob: result.data.pan_dob || "",
            aadhaar_number: result.data.aadhaar_number || "",
            business_address: result.data.business_address || "",
            legal_name: result.data.legal_name || "",
            gst_pan_number: result.data.gst_pan_number || "",
            gstin_status: result.data.gstin_status || "",
            validity_date: validityDate,
            profile_image: result.data.profile_image || "",
            logo: result.data.logo || "",
            grace_period_days: result.data.grace_period_days != null ? String(result.data.grace_period_days) : "",
            price_per_number: result.data.price_per_number != null && result.data.price_per_number !== "" ? String(result.data.price_per_number) : "",
          }));

          // Fetch number limits
          try {
            const limitsResult = await getNumberLimitsByResellerId(resellerId);
            if (limitsResult.success && limitsResult.data?.max_virtual_numbers != null) {
              setFormData((prev) => ({ ...prev, max_virtual_numbers: String(limitsResult.data.max_virtual_numbers) }));
            }
          } catch (limitsErr) {
            console.warn("Error fetching number limits:", limitsErr);
          }

          // Set image/logo previews from existing data
          if (result.data.profile_image) {
            setImagePreview(`${IMAGE_UPLOAD_PATH}/profile-images/${result.data.profile_image}`);
          }
          if (result.data.logo) {
            setLogoPreview(`${IMAGE_UPLOAD_PATH}/logos/${result.data.logo}`);
          }
        } else {
          setError(result.message || "Reseller not found");
        }
      } catch (err) {
        console.error("Error fetching reseller:", err);
        setError("An error occurred while loading reseller details");
      } finally {
        setFetching(false);
      }
    };

    if (isAdmin) {
      fetchReseller();
    }
  }, [id, isAdmin, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError("");
  };

  const validateForm = () => {
    const requiredFields = [
      { key: "first_name", label: "First Name" },
      { key: "last_name", label: "Last Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "business_name", label: "Business Name" },
      { key: "business_address", label: "Business Address" },
    ];
    const missing = requiredFields.filter((f) => !formData[f.key] || String(formData[f.key]).trim() === "");
    if (missing.length > 0) {
      const missingLabels = missing.map((f) => f.label).join(", ");
      setError(`Please fill the following required fields: ${missingLabels}.`);
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address.");
      return false;
    }

    if (formData.business_email && !emailRegex.test(formData.business_email)) {
      setError("Please enter a valid business email address.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!validateForm()) {
      return;
    }

    const currentId = id;
    console.log("Update - useParams id:", currentId, typeof currentId);
    
    if (!currentId || typeof currentId !== 'string' || currentId.trim() === '') {
      setError("Reseller ID is missing");
      return;
    }

    const resellerId = currentId.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(resellerId)) {
      setError(`Invalid reseller ID format: ${currentId}`);
      return;
    }

    setLoading(true);
    try {
      // Build update payload - only include fields that have values
      const updatePayload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        business_name: formData.business_name,
        brand_name: formData.brand_name || null,
        business_email: formData.business_email,
        gstin: formData.gstin || null,
        status: formData.status,
        address: parseAddressInputToStorageArray(formData.address),
        dob: formData.dob || null,
        gender: formData.gender || null,
        pan_number: formData.pan_number || null,
        pan_dob: formData.pan_dob || null,
        aadhaar_number: formData.aadhaar_number || null,
        business_address: formData.business_address,
        legal_name: formData.legal_name || null,
        gst_pan_number: formData.gst_pan_number || null,
        gstin_status: formData.gstin_status || null,
        validity_date: formData.validity_date || null,
        // Only include profile_image and logo if they have values (to preserve existing values if not changed)
        ...(formData.profile_image ? { profile_image: formData.profile_image } : {}),
        ...(formData.logo ? { logo: formData.logo } : {}),
        ...(formData.grace_period_days !== "" && !isNaN(parseInt(formData.grace_period_days, 10)) ? { grace_period_days: parseInt(formData.grace_period_days, 10) } : {}),
        ...(formData.price_per_number !== "" && !isNaN(parseFloat(formData.price_per_number)) ? { price_per_number: parseFloat(formData.price_per_number) } : {}),
      };
      console.log('[EditReseller] Saving payload:', JSON.stringify(updatePayload, null, 2));

      // Update reseller data
      const result = await updateMstReseller(resellerId, updatePayload);
      console.log('[EditReseller] Save result:', JSON.stringify(result, null, 2));

      if (!result.success) {
        setError(result.message || "Failed to update reseller. Please try again.");
        setLoading(false);
        return;
      }

      // Handle domain update
      const newDomain = (formData.custom_domain || "").trim();
      const currentDomain = domainData?.domain || "";
      
      // Process domain if it's provided and different from current
      if (newDomain !== "" && newDomain !== currentDomain) {
        console.log("=== EDIT RESELLER: SAVING DOMAIN ===");
        console.log("Current domain:", currentDomain);
        console.log("New domain:", newDomain);
        console.log("Reseller ID:", resellerId);
        console.log("Has existing domain:", !!domainData);
        console.log("Existing domain data:", domainData);
        
        const domainResult = await upsertMstResellerDomain(resellerId, newDomain);
        
        console.log("=== DOMAIN SAVE RESULT ===");
        console.log("Success:", domainResult.success);
        console.log("Message:", domainResult.message);
        console.log("Data:", domainResult.data);
        console.log("Errors:", domainResult.errors);
        
        if (!domainResult.success) {
          console.error("Domain save failed:", domainResult);
          setError(`Failed to save domain: ${domainResult.message || "Unknown error"}`);
          setLoading(false);
          return;
        }
        
        // Check if approval is needed
        if (domainResult.data && !domainResult.data.approved) {
          // Domain change requires approval
          setSuccess(true);
          setError("");
          setSuccessMessage("Domain change submitted successfully. It will be active after admin approval.");
          setTimeout(() => {
            setShowSuccessModal(true);
          }, 1000);
          return;
        }
        
        // Domain was saved successfully (either auto-approved or same domain)
        console.log("Domain saved successfully:", domainResult.data);
      } else if (newDomain === "" && currentDomain !== "") {
        // Domain field was cleared - keep existing record
        console.log("Domain field cleared, keeping existing domain record");
      }

      // Update number limits (virtual number limit) if provided
      const maxVn = formData.max_virtual_numbers.trim() === "" ? null : parseInt(formData.max_virtual_numbers, 10);
      if (maxVn !== null && !isNaN(maxVn) && maxVn >= 0) {
        const limitsResult = await upsertNumberLimits(resellerId, maxVn);
        if (!limitsResult.success) {
          setError(limitsResult.message || "Reseller updated but failed to update Virtual Number limit.");
          setLoading(false);
          return;
        }
      }

      setSuccess(true);
      setTimeout(() => {
        navigate("/reseller-list");
      }, 2000);
    } catch (err) {
      console.error("Error updating reseller:", err);
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // --- Profile Image Handlers ---
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size should be less than 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => setImagePreview(event.target?.result);
    reader.readAsDataURL(file);
    setSelectedImageFile(file);
    setError("");
  };

  const handleImageUpload = async () => {
    const file = selectedImageFile;
    if (!file) {
      setError("Please select an image file");
      return;
    }
    const resellerId = id;
    if (!resellerId) {
      setError("Reseller ID is missing.");
      return;
    }
    setUploadingImage(true);
    setError("");
    try {
      const token = getAuthToken();
      const apiBase = getApiBaseUrl().replace(/\/+$/, '');
      const uploadData = new FormData();
      uploadData.append('profile_image', file);

      const response = await fetch(`${apiBase}/upload/profile-image?resellerId=${resellerId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: uploadData,
      });
      const result = await response.json();
      if (result.success) {
        const filename = result.data.filename;
        setImagePreview(`${IMAGE_UPLOAD_PATH}/profile-images/${filename}`);
        setFormData((prev) => ({ ...prev, profile_image: filename }));
        setSelectedImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setSuccess(true);
        setError("");
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.message || "Failed to upload profile image");
      }
    } catch (err) {
      console.error("Error uploading image:", err);
      setError(err.message || "An error occurred while uploading image");
    } finally {
      setUploadingImage(false);
    }
  };

  // --- Logo Handlers ---
  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Logo size should be less than 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => setLogoPreview(event.target?.result);
    reader.readAsDataURL(file);
    setSelectedLogoFile(file);
    setError("");
  };

  const handleLogoUpload = async () => {
    const file = selectedLogoFile;
    if (!file) {
      setError("Please select a logo file");
      return;
    }
    const resellerId = id;
    if (!resellerId) {
      setError("Reseller ID is missing.");
      return;
    }
    setUploadingLogo(true);
    setError("");
    try {
      const token = getAuthToken();
      const apiBase = getApiBaseUrl().replace(/\/+$/, '');
      const uploadData = new FormData();
      uploadData.append('logo', file);

      const response = await fetch(`${apiBase}/upload/logo?resellerId=${resellerId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: uploadData,
      });
      const result = await response.json();
      if (result.success) {
        const filename = result.data.filename;
        setLogoPreview(`${IMAGE_UPLOAD_PATH}/logos/${filename}`);
        setFormData((prev) => ({ ...prev, logo: filename }));
        setSelectedLogoFile(null);
        if (logoInputRef.current) logoInputRef.current.value = "";
        setSuccess(true);
        setError("");
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.message || "Failed to upload logo");
      }
    } catch (err) {
      console.error("Error uploading logo:", err);
      setError(err.message || "An error occurred while uploading logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  // Check access before rendering
  if (!isAdmin && !fetching) {
    return (
      <div className='card h-100 p-0 radius-12'>
        <div className='card-body p-24'>
          <div className='alert alert-danger' role='alert'>
            <Icon icon='material-symbols:error-outline' className='icon me-2' />
            {error || "Access denied. You don’t have permission to edit this profile. Contact support for assistance."}
          </div>
        </div>
      </div>
    );
  }

  if (fetching) {
    return (
      <div className='card h-100 p-0 radius-12'>
        <div className='card-body p-24'>
          <div className='text-center py-40'>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className='text-muted mt-3'>Loading reseller details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='card h-100 p-0 radius-12'>
      <div className='card-body p-24'>
        <div className='row justify-content-center'>
          <div className='col-xxl-8 col-xl-10 col-lg-12'>
            <div className='card border'>
              <div className='card-body p-40'>
                <h6 className='text-md text-primary-light mb-24'>
                  Edit Reseller
                </h6>

                {error && (
                  <div className='alert alert-danger radius-8 mb-24' role='alert'>
                    <Icon icon='material-symbols:error-outline' className='icon me-2' />
                    {error}
                  </div>
                )}

                {success && (
                  <div className='alert alert-success radius-8 mb-24' role='alert'>
                    <Icon icon='material-symbols:check-circle-outline' className='icon me-2' />
                    Reseller updated successfully! Redirecting...
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <h6 className='text-sm text-primary-light mb-16 mt-24'>Personal Information</h6>
                  <div className='row'>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='first_name'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          First Name <span className='text-danger-600'>*</span>
                        </label>
                        <input
                          type='text'
                          className='form-control radius-8'
                          id='first_name'
                          name='first_name'
                          placeholder='Enter first name'
                          value={formData.first_name}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    </div>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='last_name'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          Last Name <span className='text-danger-600'>*</span>
                        </label>
                        <input
                          type='text'
                          className='form-control radius-8'
                          id='last_name'
                          name='last_name'
                          placeholder='Enter last name'
                          value={formData.last_name}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className='row'>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='email'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          Email <span className='text-danger-600'>*</span>
                        </label>
                        <input
                          type='email'
                          className='form-control radius-8'
                          id='email'
                          name='email'
                          placeholder='Enter email address'
                          value={formData.email}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    </div>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='phone'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          Phone Number <span className='text-danger-600'>*</span>
                        </label>
                        <input
                          type='tel'
                          className='form-control radius-8'
                          id='phone'
                          name='phone'
                          placeholder='Enter phone number'
                          value={formData.phone}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className='row'>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='dob'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          Date of Birth
                        </label>
                        <input
                          type='date'
                          className='form-control radius-8'
                          id='dob'
                          name='dob'
                          value={formData.dob}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                    {/* <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='gender'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          Gender
                        </label>
                        <select
                          className='form-select radius-8'
                          id='gender'
                          name='gender'
                          value={formData.gender}
                          onChange={handleChange}
                        >
                          <option value=''>Select gender</option>
                          <option value='M'>Male</option>
                          <option value='F'>Female</option>
                          <option value='O'>Other</option>
                        </select>
                      </div>
                    </div> */}
                  </div>

                  <div className='mb-20'>
                    <label
                      htmlFor='address'
                      className='form-label fw-semibold text-primary-light text-sm mb-8'
                    >
                      Address
                    </label>
                    <textarea
                      className='form-control radius-8'
                      id='address'
                      name='address'
                      rows='3'
                      placeholder='Enter address (one line per address or comma-separated)'
                      value={formData.address}
                      onChange={handleChange}
                    />
                    <small className="text-muted mt-2 d-block">
                      Enter multiple addresses on separate lines or separated by commas
                    </small>
                  </div>

                  <div className='row'>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='pan_number'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          PAN Number
                        </label>
                        <input
                          type='text'
                          className='form-control radius-8'
                          id='pan_number'
                          name='pan_number'
                          placeholder='Enter PAN number'
                          value={formData.pan_number}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='aadhaar_number'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          Aadhaar Number
                        </label>
                        <input
                          type='text'
                          className='form-control radius-8'
                          id='aadhaar_number'
                          name='aadhaar_number'
                          placeholder='Enter Aadhaar number'
                          value={formData.aadhaar_number}
                          onChange={handleChange}
                        />
                      </div>
                    </div>   
                  </div>

                  
                  <hr className='my-24' />
                  <h6 className='text-sm text-primary-light mb-16 mt-24'>Business Information</h6>
                  <div className='mb-20'>
                    <label
                      htmlFor='business_name'
                      className='form-label fw-semibold text-primary-light text-sm mb-8'
                    >
                      Business Name <span className='text-danger-600'>*</span>
                    </label>
                    <input
                      type='text'
                      className='form-control radius-8'
                      id='business_name'
                      name='business_name'
                      placeholder='Enter business name'
                      value={formData.business_name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className='mb-20'>
                    <label
                      htmlFor='brand_name'
                      className='form-label fw-semibold text-primary-light text-sm mb-8'
                    >
                      Brand Name
                    </label>
                    <input
                      type='text'
                      className='form-control radius-8'
                      id='brand_name'
                      name='brand_name'
                      placeholder='Enter brand name (displayed to customers)'
                      value={formData.brand_name}
                      onChange={handleChange}
                    />
                  </div>

                  {/* <div className='mb-20'>
                    <label
                      htmlFor='legal_name'
                      className='form-label fw-semibold text-primary-light text-sm mb-8'
                    >
                      Legal Name
                    </label>
                    <input
                      type='text'
                      className='form-control radius-8'
                      id='legal_name'
                      name='legal_name'
                      placeholder='Enter legal name'
                      value={formData.legal_name}
                      onChange={handleChange}
                    />
                  </div> */}

                  <div className='row'>
                    {/* <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='business_email'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          Business Email <span className='text-danger-600'>*</span>
                        </label>
                        <input
                          type='email'
                          className='form-control radius-8'
                          id='business_email'
                          name='business_email'
                          placeholder='Enter business email'
                          value={formData.business_email}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    </div> */}
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='gstin'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          GSTIN
                        </label>
                        <input
                          type='text'
                          className='form-control radius-8'
                          id='gstin'
                          name='gstin'
                          placeholder='Enter GSTIN'
                          value={formData.gstin}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                  </div>

                  <div className='row'>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='gst_pan_number'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          GST PAN Number
                        </label>
                        <input
                          type='text'
                          className='form-control radius-8'
                          id='gst_pan_number'
                          name='gst_pan_number'
                          placeholder='Enter GST PAN number'
                          value={formData.gst_pan_number}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='gstin_status'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          GSTIN Status
                        </label>
                        <input
                          type='text'
                          className='form-control radius-8'
                          id='gstin_status'
                          name='gstin_status'
                          placeholder='Enter GSTIN status'
                          value={formData.gstin_status}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                  </div>

                  <div className='mb-20'>
                    <label
                      htmlFor='business_address'
                      className='form-label fw-semibold text-primary-light text-sm mb-8'
                    >
                      Business Address <span className='text-danger-600'>*</span>
                    </label>
                    <textarea
                      className='form-control radius-8'
                      id='business_address'
                      name='business_address'
                      rows='3'
                      placeholder='Enter business address'
                      value={formData.business_address}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <hr className='my-24' />
                  <h6 className='text-sm text-primary-light mb-16'>Profile Image & Logo</h6>

                  <div className='row'>
                    {/* Profile Image */}
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                          Profile Image
                        </label>
                        <div className='d-flex align-items-center gap-3 mb-12'>
                          <div
                            style={{
                              width: 80,
                              height: 80,
                              borderRadius: '50%',
                              overflow: 'hidden',
                              border: '2px solid #e0e0e0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#f5f5f5',
                            }}
                          >
                            {imagePreview ? (
                              <img
                                src={imagePreview}
                                alt='Profile'
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = '/assets/images/user.png';
                                }}
                              />
                            ) : (
                              <Icon icon='solar:user-circle-bold' className='text-secondary-light' style={{ fontSize: 48 }} />
                            )}
                          </div>
                          <div className='flex-grow-1'>
                            <input
                              type='file'
                              ref={fileInputRef}
                              className='form-control radius-8'
                              accept='image/*'
                              onChange={handleImageChange}
                              disabled={uploadingImage}
                            />
                            <small className='text-muted d-block mt-1'>Max 5MB. JPG, PNG, GIF.</small>
                          </div>
                        </div>
                        {selectedImageFile && (
                          <button
                            type='button'
                            className='btn btn-sm btn-outline-primary radius-8'
                            onClick={handleImageUpload}
                            disabled={uploadingImage}
                          >
                            {uploadingImage ? (
                              <>
                                <span className='spinner-border spinner-border-sm me-1' role='status' aria-hidden='true'></span>
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Icon icon='solar:upload-linear' className='me-1' />
                                Upload Profile Image
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Business Logo */}
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                          Business Logo
                        </label>
                        <div className='d-flex align-items-center gap-3 mb-12'>
                          <div
                            style={{
                              width: 80,
                              height: 80,
                              borderRadius: 8,
                              overflow: 'hidden',
                              border: '2px solid #e0e0e0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#f5f5f5',
                            }}
                          >
                            {logoPreview ? (
                              <img
                                src={logoPreview}
                                alt='Logo'
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = '/assets/images/logo-icon.png';
                              }}
                              />
                            ) : (
                              <Icon icon='solar:gallery-bold' className='text-secondary-light' style={{ fontSize: 48 }} />
                            )}
                          </div>
                          <div className='flex-grow-1'>
                            <input
                              type='file'
                              ref={logoInputRef}
                              className='form-control radius-8'
                              accept='image/*'
                              onChange={handleLogoChange}
                              disabled={uploadingLogo}
                            />
                            <small className='text-muted d-block mt-1'>Max 5MB. JPG, PNG, GIF.</small>
                          </div>
                        </div>
                        {selectedLogoFile && (
                          <button
                            type='button'
                            className='btn btn-sm btn-outline-primary radius-8'
                            onClick={handleLogoUpload}
                            disabled={uploadingLogo}
                          >
                            {uploadingLogo ? (
                              <>
                                <span className='spinner-border spinner-border-sm me-1' role='status' aria-hidden='true'></span>
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Icon icon='solar:upload-linear' className='me-1' />
                                Upload Logo
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className='mb-24'>
                    <div className='form-check'>
                      <input
                        className='form-check-input'
                        type='checkbox'
                        id='status'
                        name='status'
                        checked={formData.status}
                        onChange={handleChange}
                      />
                      <label className='form-check-label text-sm' htmlFor='status'>
                        Active Status
                      </label>
                    </div>
                  </div>
<hr className='my-24' />
                   <div className='mb-20'>
                    <label
                      htmlFor='validity_date'
                      className='form-label fw-semibold text-primary-light text-sm mb-8'
                    >
                      Expiry Date (Validity End Date)
                    </label>
                    <input
                      type='date'
                      className='form-control radius-8'
                      id='validity_date'
                      name='validity_date'
                      value={formData.validity_date}
                      onChange={handleChange}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    <small className='text-xs text-secondary-light mt-4 d-block'>
                      Update the reseller's validity expiry date. This will update the validity record and create a history entry.
                    </small>
                  </div>

                  <div className='row'>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='max_virtual_numbers'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          Virtual Number Limit
                        </label>
                        <input
                          type='number'
                          className='form-control radius-8'
                          id='max_virtual_numbers'
                          name='max_virtual_numbers'
                          placeholder='e.g. 100'
                          min={0}
                          value={formData.max_virtual_numbers}
                          onChange={handleChange}
                        />
                        <small className="text-xs text-secondary-light mt-4 d-block">
                          Maximum virtual numbers this reseller can assign to customers.
                        </small>
                      </div>
                    </div>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='grace_period_days'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          Grace Period (Days)
                        </label>
                        <input
                          type='number'
                          className='form-control radius-8'
                          id='grace_period_days'
                          name='grace_period_days'
                          placeholder='e.g. 30'
                          min={0}
                          value={formData.grace_period_days}
                          onChange={handleChange}
                        />
                        <small className="text-xs text-secondary-light mt-4 d-block">
                          Grace period in days after expiry.
                        </small>
                      </div>
                    </div>
                  </div>

                  <div className='row'>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='price_per_number'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          Price Per Number (₹)
                        </label>
                        <input
                          type='number'
                          step='0.01'
                          min={0}
                          className='form-control radius-8'
                          id='price_per_number'
                          name='price_per_number'
                          placeholder='e.g. 99.00'
                          value={formData.price_per_number}
                          onChange={handleChange}
                        />
                        <small className="text-xs text-secondary-light mt-4 d-block">
                          Price per virtual number for customers.
                        </small>
                      </div>
                    </div>
                  </div>

                  <hr className='my-24' />
                   <div className='mb-20'>
                    <label
                      htmlFor='custom_domain'
                      className='form-label fw-semibold text-primary-light text-sm mb-8'
                    >
                      Custom Domain
                    </label>
                    <input
                      type='text'
                      className='form-control radius-8'
                      id='custom_domain'
                      name='custom_domain'
                      placeholder='example.com'
                      value={formData.custom_domain}
                      onChange={handleChange}
                      disabled={loading}
                    />
                    <small className="text-muted mt-2 d-block">
                      Enter your custom domain (e.g., www.reseller.com). Domain changes require admin approval before becoming active.
                    </small>
                    {domainData && (
                      <div className="mt-2">
                        {domainData.approved ? (
                          <span className="badge bg-success">Domain Approved</span>
                        ) : (
                          <span className="badge bg-warning">Pending Approval</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className='d-flex align-items-center justify-content-center gap-3'>
                    <button
                      type='button'
                      className='border border-danger-600 bg-hover-danger-200 text-danger-600 text-md px-56 py-11 radius-8'
                      onClick={() => navigate("/reseller-list")}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      type='submit'
                      className='btn btn-primary border border-primary-600 text-md px-56 py-12 radius-8'
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Updating...
                        </>
                      ) : (
                        "Update Reseller"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          navigate("/reseller-list");
        }}
        title="Domain Change Submitted"
        message={successMessage}
      />
    </div>
  );
};

export default EditResellerLayer;
