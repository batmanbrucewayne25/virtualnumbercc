import PasswordField from "@/components/Form/PasswordField";
import { useState } from "react";

interface Step2Props {
  onBack: () => void;
  onSuccess: (data: { email: string; phone: string; password: string }) => void;
}

// Common personal email domains to check
const PERSONAL_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
  "mail.com",
  "protonmail.com",
  "yandex.com",
  "zoho.com",
  "rediffmail.com",
  "live.com",
  "msn.com",
];

const Step2 = ({ onBack, onSuccess }: Step2Props) => {
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [emailError, setEmailError] = useState<string>("");
  const [phoneError, setPhoneError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const validatePhone = (ph: string): boolean => {
    const digits = ph.replace(/\D/g, "");
    return digits.length === 10 && /^[6-9]\d{9}$/.test(digits);
  };

  const validateEmail = (em: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
  };

  const isBusinessEmail = (em: string): boolean => {
    if (!validateEmail(em)) return false;
    const domain = em.split("@")[1]?.toLowerCase();
    if (!domain) return false;
    return !PERSONAL_EMAIL_DOMAINS.includes(domain);
  };

  const handleEmailBlur = () => {
    setEmailError("");
    if (!email) {
      setEmailError("Email is required.");
      return;
    }
    if (!validateEmail(email)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    if (!isBusinessEmail(email)) {
      setEmailError(
        "Please use a business email address. Personal email addresses (Gmail, Yahoo, etc.) are not allowed."
      );
      return;
    }
  };

  const handleContinue = async () => {
    setError("");
    setEmailError("");
    setPhoneError("");

    // Validate all fields
    if (!email || !phone || !password || !confirmPassword) {
      setError("Please fill all required fields.");
      return;
    }

    if (!validateEmail(email)) {
      setEmailError("Enter a valid email address.");
      setError("Please fix the errors above before continuing.");
      return;
    }

    if (!isBusinessEmail(email)) {
      setEmailError(
        "Please use a business email address. Personal email addresses are not allowed."
      );
      setError("Please use a business email address.");
      return;
    }

    if (!validatePhone(phone)) {
      setPhoneError("Enter a valid 10-digit phone number starting with 6-9.");
      setError("Please enter a valid phone number.");
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

    // All validations passed
    setLoading(true);
    try {
      // Call onSuccess to proceed to next step
      if (onSuccess) {
        onSuccess({ email, phone, password });
      } else {
        console.error("onSuccess callback is not defined");
        setError("An error occurred. Please try again.");
      }
    } catch (err: any) {
      console.error("Error in handleContinue:", err);
      setError(err.message || "Failed to proceed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      <h4 className="mb-12">Create Account</h4>

      {error && <div className="alert alert-danger mb-12">{error}</div>}

      <div className="mb-16">
        <label className="form-label text-sm mb-8">
          Business Email <span className="text-danger">*</span>
        </label>
        <input
          className={`form-control h-56-px ${emailError ? "is-invalid" : ""}`}
          type="email"
          placeholder="business@company.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError("");
          }}
          onBlur={handleEmailBlur}
        />
        {emailError && <div className="text-danger small mt-4">{emailError}</div>}
        <small className="text-secondary-light">
          Personal email addresses (Gmail, Yahoo, etc.) are not allowed.
        </small>
      </div>

      <div className="mb-16">
        <label className="form-label text-sm mb-8">
          Mobile Number <span className="text-danger">*</span>
        </label>
        <input
          className={`form-control h-56-px ${phoneError ? "is-invalid" : ""}`}
          type="tel"
          placeholder="10-digit mobile number"
          value={phone}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "").slice(0, 10);
            setPhone(value);
            if (phoneError) setPhoneError("");
          }}
          onBlur={() => {
            if (phone && !validatePhone(phone)) {
              setPhoneError("Enter a valid 10-digit phone number.");
            }
          }}
        />
        {phoneError && <div className="text-danger small mt-4">{phoneError}</div>}
      </div>

      <div className="mb-16">
        <label className="form-label text-sm mb-8">
          Password <span className="text-danger">*</span>
        </label>
        <PasswordField
          id="clienthub-password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-0"
          required
        />
        <small className="text-secondary-light">Minimum 6 characters</small>
      </div>

      <div className="mb-16">
        <label className="form-label text-sm mb-8">
          Confirm Password <span className="text-danger">*</span>
        </label>
        <PasswordField
          id="clienthub-confirm-password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mb-0"
          required
        />
      </div>

      <button
        type="button"
        className="btn btn-outline-secondary w-100 radius-12 mb-12"
        onClick={(e) => {
          e.preventDefault();
          onBack();
        }}
        disabled={loading}
      >
        Back
      </button>

      <button
        type="button"
        className="btn btn-primary w-100 radius-12"
        onClick={(e) => {
          e.preventDefault();
          handleContinue();
        }}
        disabled={loading}
      >
        {loading ? "Please wait..." : "Submit & Continue"}
      </button>
    </>
  );
};

export default Step2;

