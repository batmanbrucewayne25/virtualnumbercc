import { Icon } from "@iconify/react/dist/iconify.js";
import { useState } from "react";
import PasswordField from "./Form/PasswordField";
import { changePassword } from "@/utils/api";
import { getUserData } from "@/utils/auth";

const ChangePasswordLayer = () => {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
    setSuccess("");
  };

  const validateForm = () => {
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setError("Please fill all fields.");
      return false;
    }

    if (formData.newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return false;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("New password and confirm password do not match.");
      return false;
    }

    if (formData.currentPassword === formData.newPassword) {
      setError("New password must be different from current password.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const result = await changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });

      if (result.success) {
        setSuccess("Password changed successfully!");
        setFormData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setTimeout(() => {
          setSuccess("");
        }, 5000);
      } else {
        setError(result.message || "Failed to change password. Please try again.");
      }
    } catch (err) {
      console.error("Error changing password:", err);
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='card h-100 p-0 radius-12'>
      <div className='card-header border-bottom bg-base py-16 px-24'>
        <h5 className='text-md text-primary-light mb-0'>Reset Password</h5>
      </div>
      <div className='card-body p-24'>
        {error && (
          <div className='alert alert-danger radius-8 mb-24' role='alert'>
            <Icon icon='material-symbols:error-outline' className='icon me-2' />
            {error}
          </div>
        )}

        {success && (
          <div className='alert alert-success radius-8 mb-24' role='alert'>
            <Icon icon='material-symbols:check-circle-outline' className='icon me-2' />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className='mb-20'>
            <label
              htmlFor='currentPassword'
              className='form-label fw-semibold text-primary-light text-sm mb-8'
            >
              Current Password <span className='text-danger-600'>*</span>
            </label>
            <PasswordField
              id='currentPassword'
              name='currentPassword'
              placeholder='Enter current password'
              value={formData.currentPassword}
              onChange={handleChange}
              className='radius-8'
              required
            />
          </div>

          <div className='mb-20'>
            <label
              htmlFor='newPassword'
              className='form-label fw-semibold text-primary-light text-sm mb-8'
            >
              New Password <span className='text-danger-600'>*</span>
            </label>
            <PasswordField
              id='newPassword'
              name='newPassword'
              placeholder='Enter new password'
              value={formData.newPassword}
              onChange={handleChange}
              className='radius-8'
              required
            />
            <small className='text-muted d-block mt-2'>
              Password must be at least 6 characters long
            </small>
          </div>

          <div className='mb-24'>
            <label
              htmlFor='confirmPassword'
              className='form-label fw-semibold text-primary-light text-sm mb-8'
            >
              Confirm New Password <span className='text-danger-600'>*</span>
            </label>
            <PasswordField
              id='confirmPassword'
              name='confirmPassword'
              placeholder='Confirm new password'
              value={formData.confirmPassword}
              onChange={handleChange}
              className='radius-8'
              required
            />
          </div>

          <div className='d-flex justify-content-end gap-2'>
            <button
              type='submit'
              className='btn btn-primary radius-8'
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Changing Password...
                </>
              ) : (
                "Change Password"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordLayer;

