import PasswordField from "@/components/Form/PasswordField";
import { insertMstReseller } from "@/hasura/mutations";
import { Step1Props } from "@/types/auth/signup";
import { useState } from "react";

const Step1 = ({ onSuccess }: Step1Props) => {
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [emailError, setEmailError] = useState<string>("");

  const [confirmPassword, setConfirmPassword] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [phoneError, setPhoneError] = useState<string>("");

  const validatePhone = (ph: string): boolean => {
    const digits = ph.replace(/\D/g, "");
    return digits.length === 10 && /^[6-9]\d{9}$/.test(digits);
  };

  const validateEmail = (em: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
  };

  const handleContinue = async () => {
    setError("");

    if (!firstName || !lastName || !email || !phone || !password) {
      setError("Please fill all required fields.");
      return;
    }

    if (!validatePhone(phone)) {
      setPhoneError("Enter a valid 10-digit phone number");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await insertMstReseller({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        password_hash: password,
      });

      onSuccess({ email, phone });
    } catch (err) {
      console.error(err);
      setError("Failed to create account. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h4 className="mb-12">Create Account</h4>

      {error && <div className="alert alert-danger mb-12">{error}</div>}

      <input
        className="form-control h-56-px mb-16"
        placeholder="First Name"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
      />

      <input
        className="form-control h-56-px mb-16"
        placeholder="Last Name"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
      />

      <input
        className="form-control h-56-px mb-16"
        placeholder="Phone Number"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value);
          if (phoneError) setPhoneError("");
        }}
        onBlur={() => {
          if (phone && !validatePhone(phone)) {
            setPhoneError("Enter a valid 10-digit phone number");
          }
        }}
      />

      {phoneError && <div className="text-danger small mb-12">{phoneError}</div>}

      <input
        className="form-control h-56-px mb-16"
        placeholder="Email ID"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (emailError) setEmailError("");
        }}
        onBlur={() => {
          if (email && !validateEmail(email)) {
            setEmailError("Enter a valid email address");
          }
        }}
      />

      {emailError && (
        <div className="text-danger small mb-12">{emailError}</div>
      )}

      <PasswordField
        id="signup-password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-16"
        required
      />

      <PasswordField
        id="signup-confirm-password"
        placeholder="Confirm Password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="mb-24"
        required
      />

      <button
        className="btn btn-primary w-100 radius-12"
        onClick={handleContinue}
        disabled={loading}
      >
        {loading ? "Please wait..." : "Continue"}
      </button>
    </>
  );
};

export default Step1;
