import { Icon } from "@iconify/react/dist/iconify.js";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getMstResellerById, updateMstReseller } from "@/hasura/mutations/reseller";
import { getResellerValidity } from "@/hasura/mutations/resellerValidity";

const EditResellerLayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    business_name: "",
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
  });

  useEffect(() => {
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

    const fetchReseller = async () => {
      setFetching(true);
      setError("");
      try {
        console.log("Fetching reseller with ID:", resellerId);
        const result = await getMstResellerById(resellerId);
        console.log("GraphQL result:", result);
        if (result.success && result.data) {
          // Handle address as array - convert to string for form input
          const addressValue = Array.isArray(result.data.address) 
            ? result.data.address.join('\n')
            : (result.data.address || "");

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

          setFormData({
            first_name: result.data.first_name || "",
            last_name: result.data.last_name || "",
            email: result.data.email || "",
            phone: result.data.phone || "",
            business_name: result.data.business_name || "",
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
          });
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

    fetchReseller();
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError("");
  };

  const validateForm = () => {
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.phone || !formData.business_name || !formData.business_email || !formData.business_address) {
      setError("Please fill all required fields.");
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
      const result = await updateMstReseller(resellerId, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        business_name: formData.business_name,
        business_email: formData.business_email,
        gstin: formData.gstin || null,
        status: formData.status,
        address: formData.address || null, // Will be converted to array in mutation
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
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate("/reseller-list");
        }, 2000);
      } else {
        setError(result.message || "Failed to update reseller. Please try again.");
      }
    } catch (err) {
      console.error("Error updating reseller:", err);
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
                    <div className='col-sm-6'>
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
                          <option value='Male'>Male</option>
                          <option value='Female'>Female</option>
                          <option value='Other'>Other</option>
                        </select>
                      </div>
                    </div>
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
                          htmlFor='pan_dob'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          PAN Date of Birth
                        </label>
                        <input
                          type='date'
                          className='form-control radius-8'
                          id='pan_dob'
                          name='pan_dob'
                          value={formData.pan_dob}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                  </div>

                  <div className='row'>
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
                  </div>

                  <div className='row'>
                    <div className='col-sm-6'>
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

                  <h6 className='text-sm text-primary-light mb-16 mt-24'>Validity Information</h6>
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
    </div>
  );
};

export default EditResellerLayer;
