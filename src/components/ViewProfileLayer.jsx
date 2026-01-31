import { Icon } from "@iconify/react/dist/iconify.js";
import { useState, useEffect } from "react";
import { getMstResellerById, updateMstReseller } from "@/hasura/mutations/reseller";
import { getUserData, getAuthToken } from "@/utils/auth";
import { getMstResellerDomainByResellerId, upsertMstResellerDomain } from "@/hasura/mutations/resellerDomain";

const ViewProfileLayer = () => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [imagePreview, setImagePreview] = useState("assets/images/user-grid/user-grid-img13.png");
  const [resellerId, setResellerId] = useState(null);
  
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    business_name: "",
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
          setImagePreview(result.data.profile_image);
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!resellerId) {
        setError("Reseller ID is missing");
        setLoading(false);
        return;
      }

      // Convert address string to array
      const addressArray = formData.address 
        ? formData.address.split('\n').filter(line => line.trim() !== '')
        : [];

      // Exclude custom_domain from updateData as it's handled separately
      const { custom_domain, ...resellerData } = formData;
      
      const updateData = {
        ...resellerData,
        address: addressArray.length > 0 ? addressArray : null,
      };

      const result = await updateMstReseller(resellerId, updateData);
      
      if (!result.success) {
        setError(result.message || "Failed to update profile");
        setLoading(false);
        return;
      }

      // Handle domain update
      const newDomain = (custom_domain || "").trim();
      const currentDomain = domainData?.domain || "";
      
      console.log("=== VIEW PROFILE: DOMAIN UPDATE CHECK ===");
      console.log("New domain:", newDomain);
      console.log("Current domain:", currentDomain);
      console.log("Reseller ID:", resellerId);
      console.log("Has existing domain data:", !!domainData);
      console.log("Domain data:", domainData);
      console.log("Will process domain:", newDomain !== "" && newDomain !== currentDomain);
      
      // Process domain if it's provided and different from current
      if (newDomain !== "" && newDomain !== currentDomain) {
        console.log("=== VIEW PROFILE: SAVING DOMAIN ===");
        console.log("Saving domain:", { currentDomain, newDomain, resellerId, hasExisting: !!domainData });
        
        const domainResult = await upsertMstResellerDomain(resellerId, newDomain);
        
        console.log("=== VIEW PROFILE: DOMAIN SAVE RESULT ===");
        console.log("Success:", domainResult.success);
        console.log("Message:", domainResult.message);
        console.log("Data:", domainResult.data);
        console.log("Errors:", domainResult.errors);
        console.log("Full result:", domainResult);
        
        if (!domainResult.success) {
          console.error("Domain save failed:", domainResult);
          setError(`Failed to save domain: ${domainResult.message || "Unknown error"}`);
          setLoading(false);
          return;
        }
        
        // Check if approval is needed
        if (domainResult.data && !domainResult.data.approved) {
          setSuccess("Profile updated! Domain change submitted for approval.");
        } else {
          setSuccess("Profile updated successfully! Domain saved and approved.");
        }
      } else if (newDomain === "" && currentDomain !== "") {
        console.log("Domain field was cleared, keeping existing domain record");
        setSuccess("Profile updated successfully!");
      } else {
        console.log("Domain unchanged or empty");
        setSuccess("Profile updated successfully!");
      }

      setIsEditMode(false);
      // Refresh data
      await fetchResellerData(resellerId);
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (err) {
      console.error("Error updating profile:", err);
      setError(err.message || "An error occurred while updating profile");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setError("");
    // Reload original data
    if (resellerId) {
      fetchResellerData(resellerId);
    }
  };

  const readURL = (input) => {
    if (input.target.files && input.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(input.target.files[0]);
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
          <img
            src='assets/images/user-grid/user-grid-bg1.png'
            alt='Profile Background'
            className='w-100 object-fit-cover'
          />
          <div className='pb-24 ms-16 mb-24 me-16 mt--100'>
            <div className='text-center border border-top-0 border-start-0 border-end-0'>
              <img
                src={imagePreview}
                alt='Profile'
                className='border br-white border-width-2-px w-200-px h-200-px rounded-circle object-fit-cover'
                onError={(e) => {
                  e.target.src = 'assets/images/user-grid/user-grid-img14.png';
                }}
              />
              <h6 className='mb-0 mt-16'>{fullName}</h6>
              <span className='text-secondary-light mb-16'>
                {displayEmail}
              </span>
            </div>
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
              <h5 className='mb-0'>Profile Information</h5>
              {!isEditMode && (
                <button
                  type='button'
                  onClick={() => setIsEditMode(true)}
                  className='btn btn-primary d-flex align-items-center gap-2'
                >
                  <Icon icon='solar:pen-outline' className='icon' />
                  Edit Profile
                </button>
              )}
            </div>

            {success && (
              <div className='alert alert-success alert-dismissible fade show' role='alert'>
                {success}
                <button
                  type='button'
                  className='btn-close'
                  onClick={() => setSuccess("")}
                  aria-label='Close'
                ></button>
              </div>
            )}

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

            {isEditMode ? (
              <form onSubmit={handleSubmit}>
                <h6 className='text-md text-primary-light mb-16'>
                  Profile Image
                </h6>
                <div className='mb-24 mt-16'>
                  <div className='avatar-upload'>
                    <div className='avatar-edit position-absolute bottom-0 end-0 me-24 mt-16 z-1 cursor-pointer'>
                      <input
                        type='file'
                        id='imageUpload'
                        accept='.png, .jpg, .jpeg'
                        hidden
                        onChange={readURL}
                      />
                      <label
                        htmlFor='imageUpload'
                        className='w-32-px h-32-px d-flex justify-content-center align-items-center bg-primary-50 text-primary-600 border border-primary-600 bg-hover-primary-100 text-lg rounded-circle'
                      >
                        <Icon
                          icon='solar:camera-outline'
                          className='icon'
                        ></Icon>
                      </label>
                    </div>
                    <div className='avatar-preview'>
                      <div
                        id='imagePreview'
                        style={{
                          backgroundImage: `url(${imagePreview})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className='row'>
                  <div className='col-sm-6'>
                    <div className='mb-20'>
                      <label
                        htmlFor='first_name'
                        className='form-label fw-semibold text-primary-light text-sm mb-8'
                      >
                        First Name
                        <span className='text-danger-600'>*</span>
                      </label>
                      <input
                        type='text'
                        className='form-control radius-8'
                        id='first_name'
                        name='first_name'
                        placeholder='Enter First Name'
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
                        Last Name
                        <span className='text-danger-600'>*</span>
                      </label>
                      <input
                        type='text'
                        className='form-control radius-8'
                        id='last_name'
                        name='last_name'
                        placeholder='Enter Last Name'
                        value={formData.last_name}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
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
                        Phone
                      </label>
                      <input
                        type='tel'
                        className='form-control radius-8'
                        id='phone'
                        name='phone'
                        placeholder='Enter phone number'
                        value={formData.phone}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                  <div className='col-sm-6'>
                    <div className='mb-20'>
                      <label
                        htmlFor='business_name'
                        className='form-label fw-semibold text-primary-light text-sm mb-8'
                      >
                        Business Name
                      </label>
                      <input
                        type='text'
                        className='form-control radius-8'
                        id='business_name'
                        name='business_name'
                        placeholder='Enter Business Name'
                        value={formData.business_name}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                  <div className='col-sm-6'>
                    <div className='mb-20'>
                      <label
                        htmlFor='business_email'
                        className='form-label fw-semibold text-primary-light text-sm mb-8'
                      >
                        Business Email
                      </label>
                      <input
                        type='email'
                        className='form-control radius-8'
                        id='business_email'
                        name='business_email'
                        placeholder='Enter Business Email'
                        value={formData.business_email}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
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
                  <div className='col-sm-6'>
                    <div className='mb-20'>
                      <label
                        htmlFor='gender'
                        className='form-label fw-semibold text-primary-light text-sm mb-8'
                      >
                        Gender
                      </label>
                      <select
                        className='form-control radius-8 form-select'
                        id='gender'
                        name='gender'
                        value={formData.gender}
                        onChange={handleChange}
                      >
                        <option value=''>Select Gender</option>
                        <option value='Male'>Male</option>
                        <option value='Female'>Female</option>
                        <option value='Other'>Other</option>
                      </select>
                    </div>
                  </div>
                  <div className='col-sm-12'>
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
                  </div>
                  <div className='col-sm-12'>
                    <div className='mb-20'>
                      <label
                        htmlFor='business_address'
                        className='form-label fw-semibold text-primary-light text-sm mb-8'
                      >
                        Business Address
                      </label>
                      <textarea
                        className='form-control radius-8'
                        id='business_address'
                        name='business_address'
                        rows='3'
                        placeholder='Enter business address'
                        value={formData.business_address}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className='col-sm-12'>
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
                  </div>
                </div>
                <div className='d-flex align-items-center justify-content-center gap-3'>
                  <button
                    type='button'
                    onClick={handleCancel}
                    className='border border-danger-600 bg-hover-danger-200 text-danger-600 text-md px-56 py-11 radius-8'
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
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className='row'>
                  <div className='col-sm-6 mb-20'>
                    <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                      First Name
                    </label>
                    <p className='text-secondary-light mb-0'>{formData.first_name || 'N/A'}</p>
                  </div>
                  <div className='col-sm-6 mb-20'>
                    <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                      Last Name
                    </label>
                    <p className='text-secondary-light mb-0'>{formData.last_name || 'N/A'}</p>
                  </div>
                  <div className='col-sm-6 mb-20'>
                    <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                      Email
                    </label>
                    <p className='text-secondary-light mb-0'>{formData.email || 'N/A'}</p>
                  </div>
                  <div className='col-sm-6 mb-20'>
                    <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                      Phone
                    </label>
                    <p className='text-secondary-light mb-0'>{formData.phone || 'N/A'}</p>
                  </div>
                  {formData.business_name && (
                    <div className='col-sm-6 mb-20'>
                      <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                        Business Name
                      </label>
                      <p className='text-secondary-light mb-0'>{formData.business_name}</p>
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
                  {formData.dob && (
                    <div className='col-sm-6 mb-20'>
                      <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                        Date of Birth
                      </label>
                      <p className='text-secondary-light mb-0'>{formData.dob}</p>
                    </div>
                  )}
                  {formData.gender && (
                    <div className='col-sm-6 mb-20'>
                      <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                        Gender
                      </label>
                      <p className='text-secondary-light mb-0'>{formData.gender}</p>
                    </div>
                  )}
                  {formData.address && (
                    <div className='col-sm-12 mb-20'>
                      <label className='form-label fw-semibold text-primary-light text-sm mb-8'>
                        Address
                      </label>
                      <p className='text-secondary-light mb-0'>
                        {Array.isArray(formData.address) ? formData.address.join(', ') : formData.address}
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
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewProfileLayer;
