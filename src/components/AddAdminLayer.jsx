import { Icon } from "@iconify/react/dist/iconify.js";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PasswordField from "./Form/PasswordField";
import { createAdmin } from "@/utils/api";

const AddAdminLayer = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    status: true,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError("");
  };

  const validateForm = () => {
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.password) {
      setError("Please fill all required fields.");
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
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

    setLoading(true);
    try {
      const result = await createAdmin({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone || null,
        password: formData.password,
        status: formData.status,
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate("/admin-list");
        }, 2000);
      } else {
        setError(result.message || "Failed to create admin. Please try again.");
      }
    } catch (err) {
      console.error("Error creating admin:", err);
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='card h-100 p-0 radius-12'>
      <div className='card-body p-24'>
        <div className='row justify-content-center'>
          <div className='col-xxl-8 col-xl-10 col-lg-12'>
            <div className='card border'>
              <div className='card-body p-40'>
                <h6 className='text-md text-primary-light mb-24'>
                  Add New Admin
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
                    Admin created successfully! Redirecting...
                  </div>
                )}

                <form onSubmit={handleSubmit}>
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

                  <div className='row'>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='password'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          Password <span className='text-danger-600'>*</span>
                        </label>
                        <PasswordField
                          id='password'
                          name='password'
                          placeholder='Enter password'
                          value={formData.password}
                          onChange={handleChange}
                          required
                        />
                        <small className='text-muted d-block mt-2'>
                          Password must be at least 6 characters long
                        </small>
                      </div>
                    </div>
                    <div className='col-sm-6'>
                      <div className='mb-20'>
                        <label
                          htmlFor='confirmPassword'
                          className='form-label fw-semibold text-primary-light text-sm mb-8'
                        >
                          Confirm Password <span className='text-danger-600'>*</span>
                        </label>
                        <PasswordField
                          id='confirmPassword'
                          name='confirmPassword'
                          placeholder='Confirm password'
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          required
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
                        Active Status (Admin will be active upon creation)
                      </label>
                    </div>
                  </div>

                  <div className='d-flex align-items-center justify-content-center gap-3'>
                    <button
                      type='button'
                      className='border border-danger-600 bg-hover-danger-200 text-danger-600 text-md px-56 py-11 radius-8'
                      onClick={() => navigate("/admin-list")}
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
                          Creating...
                        </>
                      ) : (
                        "Create Admin"
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

export default AddAdminLayer;
