import { Icon } from "@iconify/react/dist/iconify.js";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getMstResellerById, updateMstReseller } from "@/hasura/mutations/reseller";

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
    aadhaar_number: "",
    business_address: "",
    constitution_of_business: "",
    nature_bus_activities: "",
    legal_name: "",
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
          setFormData({
            first_name: result.data.first_name || "",
            last_name: result.data.last_name || "",
            email: result.data.email || "",
            phone: result.data.phone || "",
            business_name: result.data.business_name || "",
            business_email: result.data.business_email || "",
            gstin: result.data.gstin || "",
            status: result.data.status !== undefined ? result.data.status : true,
            address: result.data.address || "",
            dob: result.data.dob || "",
            gender: result.data.gender || "",
            pan_number: result.data.pan_number || "",
            aadhaar_number: result.data.aadhaar_number || "",
            business_address: result.data.business_address || "",
            constitution_of_business: result.data.constitution_of_business || "",
            nature_bus_activities: result.data.nature_bus_activities || "",
            legal_name: result.data.legal_name || "",
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
    if (!formData.first_name || !formData.last_name || !formData.email) {
      setError("Please fill all required fields.");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address.");
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
        phone: formData.phone || null,
        business_name: formData.business_name || null,
        business_email: formData.business_email || null,
        gstin: formData.gstin || null,
        status: formData.status,
        address: formData.address || null,
        dob: formData.dob || null,
        gender: formData.gender || null,
        pan_number: formData.pan_number || null,
        aadhaar_number: formData.aadhaar_number || null,
        business_address: formData.business_address || null,
        constitution_of_business: formData.constitution_of_business || null,
        nature_bus_activities: formData.nature_bus_activities || null,
        legal_name: formData.legal_name || null,
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
                          Phone Number
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
                      placeholder='Enter address'
                      value={formData.address}
                      onChange={handleChange}
                    />
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

                  <h6 className='text-sm text-primary-light mb-16 mt-24'>Business Information</h6>
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
                      placeholder='Enter business name'
                      value={formData.business_name}
                      onChange={handleChange}
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
                          Business Email
                        </label>
                        <input
                          type='email'
                          className='form-control radius-8'
                          id='business_email'
                          name='business_email'
                          placeholder='Enter business email'
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
                  </div>

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

                  <div className='row'>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='constitution_of_business'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          Constitution of Business
                        </label>
                        <input
                          type='text'
                          className='form-control radius-8'
                          id='constitution_of_business'
                          name='constitution_of_business'
                          placeholder='Enter constitution'
                          value={formData.constitution_of_business}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='nature_bus_activities'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          Nature of Business Activities
                        </label>
                        <input
                          type='text'
                          className='form-control radius-8'
                          id='nature_bus_activities'
                          name='nature_bus_activities'
                          placeholder='Enter nature of activities'
                          value={formData.nature_bus_activities}
                          onChange={handleChange}
                        />
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
