import { Icon } from "@iconify/react/dist/iconify.js";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import PasswordField from "@/components/Form/PasswordField";
import { resetPassword } from "@/utils/api";

const ResetPasswordLayer = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (!tokenParam) {
      setError("Invalid reset link. Please request a new password reset.");
    } else {
      setToken(tokenParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!password.trim()) {
      setError("Please enter a new password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!token) {
      setError("Invalid reset token. Please request a new password reset.");
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword(token, password);

      if (result.success) {
        setSuccess(true);
        setError("");
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate("/sign-in", { replace: true });
        }, 3000);
      } else {
        setError(result.message || "Failed to reset password. The link may have expired.");
      }
    } catch (err) {
      console.error("Reset password error:", err);
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <section className="auth bg-base d-flex flex-wrap">
        <div className="auth-left d-lg-block d-none">
          <div className="d-flex align-items-center flex-column h-100 justify-content-center">
            <img
              src="assets/images/auth/forgot-pass-img.png"
              alt="WowDash React Vite"
            />
          </div>
        </div>
        <div className="auth-right py-32 px-24 d-flex flex-column justify-content-center">
          <div className="max-w-464-px mx-auto w-100">
            <div className="text-center">
              <div className="mb-32">
                <Icon
                  icon="material-symbols:check-circle"
                  className="icon text-6xl text-success-600"
                />
              </div>
              <h4 className="mb-12">Password Reset Successful!</h4>
              <p className="mb-32 text-secondary-light text-lg">
                Your password has been reset successfully. You will be redirected to the login page shortly.
              </p>
              <Link
                to="/sign-in"
                className="btn btn-primary text-sm btn-sm px-12 py-16 w-100 radius-12"
              >
                Go to Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="auth bg-base d-flex flex-wrap">
      <div className="auth-left d-lg-block d-none">
        <div className="d-flex align-items-center flex-column h-100 justify-content-center">
          <img
            src="assets/images/auth/forgot-pass-img.png"
            alt="WowDash React Vite"
          />
        </div>
      </div>
      <div className="auth-right py-32 px-24 d-flex flex-column justify-content-center">
        <div className="max-w-464-px mx-auto w-100">
          <div>
            <h4 className="mb-12">Reset Password</h4>
            <p className="mb-32 text-secondary-light text-lg">
              Enter your new password below.
            </p>
          </div>
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="alert alert-danger radius-8 mb-20" role="alert">
                <Icon icon="material-symbols:error-outline" className="icon me-2" />
                {error}
              </div>
            )}
            <div className="position-relative mb-20">
              <div className="icon-field">
                <span className="icon top-50 translate-middle-y">
                  <Icon icon="solar:lock-password-outline" />
                </span>
                <PasswordField
                  id="new-password"
                  placeholder="New Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-neutral-50 radius-12"
                  required
                  disabled={loading || !token}
                />
              </div>
            </div>
            <div className="position-relative mb-20">
              <div className="icon-field">
                <span className="icon top-50 translate-middle-y">
                  <Icon icon="solar:lock-password-outline" />
                </span>
                <PasswordField
                  id="confirm-password"
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-neutral-50 radius-12"
                  required
                  disabled={loading || !token}
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary text-sm btn-sm px-12 py-16 w-100 radius-12 mt-32"
              disabled={loading || !token}
            >
              {loading ? "Resetting Password..." : "Reset Password"}
            </button>
            <div className="text-center mt-24">
              <Link to="/sign-in" className="text-primary-600 fw-bold">
                Back to Sign In
              </Link>
            </div>
            <div className="mt-120 text-center text-sm">
              <p className="mb-0">
                Don't have an account?{" "}
                <Link to="/sign-up" className="text-primary-600 fw-semibold">
                  Sign Up
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};

export default ResetPasswordLayer;

