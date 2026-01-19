import { Icon } from "@iconify/react/dist/iconify.js";
import { Link } from "react-router-dom";
import { useState } from "react";
import { forgotPassword } from "@/utils/api";

const ForgotPasswordLayer = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const result = await forgotPassword(email.trim());
      
      if (result.success) {
        setSuccess(true);
        setShowModal(true);
        setError("");
      } else {
        setError(result.message || "Failed to send reset email. Please try again.");
      }
    } catch (err) {
      console.error("Forgot password error:", err);
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section className='auth forgot-password-page bg-base d-flex flex-wrap'>
        <div className='auth-left d-lg-block d-none'>
          <div className='d-flex align-items-center flex-column h-100 justify-content-center'>
            <img
              src='assets/images/auth/forgot-pass-img.png'
              alt='WowDash React Vite'
            />
          </div>
        </div>
        <div className='auth-right py-32 px-24 d-flex flex-column justify-content-center'>
          <div className='max-w-464-px mx-auto w-100'>
            <div>
              <h4 className='mb-12'>Forgot Password</h4>
              <p className='mb-32 text-secondary-light text-lg'>
                Enter the email address associated with your account and we will
                send you a link to reset your password.
              </p>
            </div>
            <form onSubmit={handleSubmit}>
              {error && (
                <div className='alert alert-danger radius-8 mb-20' role='alert'>
                  <Icon icon='material-symbols:error-outline' className='icon me-2' />
                  {error}
                </div>
              )}
              <div className='icon-field'>
                <span className='icon top-50 translate-middle-y'>
                  <Icon icon='mage:email' />
                </span>
                <input
                  type='email'
                  className='form-control h-56-px bg-neutral-50 radius-12'
                  placeholder='Enter Email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <button
                type='submit'
                className='btn btn-primary text-sm btn-sm px-12 py-16 w-100 radius-12 mt-32'
                disabled={loading}
              >
                {loading ? "Sending..." : "Continue"}
              </button>
              <div className='text-center'>
                <Link to='/sign-in' className='text-primary-600 fw-bold mt-24'>
                  Back to Sign In
                </Link>
              </div>
              <div className='mt-120 text-center text-sm'>
                <p className='mb-0'>
                  Already have an account?{" "}
                  <Link to='/sign-in' className='text-primary-600 fw-semibold'>
                    Sign In
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </section>
      {/* Success Modal */}
      {showModal && (
        <div
          className='modal fade show'
          style={{ display: 'block' }}
          tabIndex={-1}
          aria-hidden='true'
        >
          <div className='modal-backdrop fade show'></div>
          <div className='modal-dialog modal-dialog-centered'>
            <div className='modal-content radius-16 bg-base'>
              <div className='modal-body p-40 text-center'>
                <div className='mb-32'>
                  <img
                    src='assets/images/auth/envelop-icon.png'
                    alt='WowDash React Vite'
                  />
                </div>
                <h6 className='mb-12'>Verify your Email</h6>
                <p className='text-secondary-light text-sm mb-0'>
                  Thank you, check your email for instructions to reset your
                  password. If you don't see the email, please check your spam folder.
                </p>
                <Link
                  to='/sign-in'
                  className='btn btn-primary text-sm btn-sm px-12 py-16 w-100 radius-12 mt-32'
                >
                  Back to Sign In
                </Link>
                <div className='mt-32 text-sm'>
                  <p className='mb-0'>
                    Don't receive an email?{" "}
                    <button
                      type='button'
                      className='btn btn-link text-primary-600 fw-semibold p-0 border-0'
                      onClick={() => {
                        setShowModal(false);
                        setEmail("");
                      }}
                    >
                      Try Again
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ForgotPasswordLayer;
