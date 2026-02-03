import { useState } from "react";
import PasswordField from "@/components/Form/PasswordField";
import { useNavigate } from "react-router-dom";
// @ts-ignore - JavaScript module imports
import { login } from "@/utils/api";
// @ts-ignore - JavaScript module imports
import { saveAuthToken } from "@/utils/auth";

interface Step1Props {
  resellerId: string;
  onSignUp: () => void;
  onLogin: () => void;
}

const Step1 = ({ resellerId, onSignUp, onLogin }: Step1Props) => {
  const [showLogin, setShowLogin] = useState(false);
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
        navigate("/", { replace: true });
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
        <h4 className="mb-12">Login to Client Hub</h4>
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
      <h4 className="mb-12">Welcome to Client Hub</h4>
      <p className="text-sm text-secondary-light mb-24">
        Get started by creating your account or logging in if you already have
        one.
      </p>

      <button
        type="button"
        className="btn btn-primary w-100 radius-12 mb-12"
        onClick={(e) => {
          e.preventDefault();
          onSignUp();
        }}
      >
        Sign Up
      </button>

      <button
        type="button"
        className="btn btn-outline-primary w-100 radius-12"
        onClick={(e) => {
          e.preventDefault();
          setShowLogin(true);
        }}
      >
        Login
      </button>
    </>
  );
};

export default Step1;
