import { useState } from "react";
import PasswordField from "@/components/Form/PasswordField";
import { useNavigate } from "react-router-dom";
// @ts-ignore - JavaScript module imports
import { login } from "@/utils/api";
// @ts-ignore - JavaScript module imports
import { saveAuthToken } from "@/utils/auth";

interface Step1Props {
  resellerId: string;
  brandName?: string;
  allowExistingCustomer?: boolean;
  onSignUp: () => void;
  onLogin: () => void;
}

const Step1 = ({ resellerId, brandName, allowExistingCustomer, onSignUp, onLogin }: Step1Props) => {
  const [showLogin, setShowLogin] = useState(false);
  const [showExistingUserModal, setShowExistingUserModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const result = await login(email.trim(), password);

      if (result.success) {
        // Extract token and user from either structure
        const token = result.data?.token || result.token;
        const user = result.data?.user || result.user;

        if (!token || !user) {
          setError("Invalid response from server. Please try again.");
          setLoading(false);
          return;
        }

        // Save authentication
        saveAuthToken(token, user, null);

        // Clear form
        setEmail("");
        setPassword("");
        setError("");

        // Call the onLogin callback to notify parent (optional)
        if (onLogin) {
          onLogin();
        }

        // Redirect to dashboard or home
        // For client hub, you might want to redirect to a customer dashboard
        // For now, redirect to home
        navigate("/reseller-dashboard", { replace: true });
      } else {
        setError(result.message || "Invalid email or password.");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (showLogin) {
    return (
      <>
        <h4 className="mb-12">Login to {brandName || "Client Hub"}</h4>
        <p className="text-sm text-secondary-light mb-24">
          Enter your credentials to access your account.
        </p>

        {error && <div className="alert alert-danger mb-12">{error}</div>}

        <form onSubmit={handleLoginSubmit}>
          <div className="mb-16">
            <label className="form-label text-sm mb-8">Email</label>
            <input
              className="form-control h-56-px"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              disabled={loading}
              required
            />
          </div>

          <div className="mb-24">
            <label className="form-label text-sm mb-8">Password</label>
            <PasswordField
              id="clienthub-login-password"
              name="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError("");
              }}
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100 radius-12 mb-12"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <button
            type="button"
            className="btn btn-outline-secondary w-100 radius-12"
            onClick={(e) => {
              e.preventDefault();
              setShowLogin(false);
              setError("");
              setEmail("");
              setPassword("");
            }}
            disabled={loading}
          >
            Back
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <h4 className="mb-12">Welcome to {brandName || "Client Hub"}</h4>
      <p className="text-sm text-secondary-light mb-24">
        Get started by creating your account 
      </p>

      <button
        type="button"
        className="btn btn-primary w-100 radius-12 mb-12"
        onClick={(e) => {
          e.preventDefault();
          if (allowExistingCustomer) {
            setShowExistingUserModal(true);
          } else {
            onSignUp();
          }
        }}
      >
        Get Your Virtual Number
      </button>

      {/* Modal: Are you an existing user? (when allow_existing_customer is true) */}
      {showExistingUserModal && (
        <div
          className="modal d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          tabIndex={-1}
          role="dialog"
          aria-labelledby="existingUserModalLabel"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content radius-16">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title text-primary-light" id="existingUserModalLabel">
                  Are you an existing {brandName || "Client Hub"} user?
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setShowExistingUserModal(false)}
                />
              </div>
              <div className="modal-footer border-0 pt-16 justify-content-center gap-12">
                <button
                  type="button"
                  className="btn btn-outline-primary radius-12"
                  onClick={() => {
                    setShowExistingUserModal(false);
                    onSignUp();
                  }}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className="btn btn-primary radius-12"
                  onClick={() => {
                    setShowExistingUserModal(false);
                    onSignUp();
                  }}
                >
                  No
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Step1;
