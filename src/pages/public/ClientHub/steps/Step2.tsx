import PasswordField from "@/components/Form/PasswordField";
import { useState } from "react";
import { checkMstCustomerExists, createMstCustomer } from "@/hasura/mutations/customer";
import { getConstraintViolationMessage, extractGraphQLError } from "@/utils/graphqlErrorHandler";
import { getApiBaseUrl } from "@/utils/apiUrl.js";

interface Step2Props {
  resellerId: string;
  allowExistingCustomer?: boolean;
  onBack: () => void;
  onSuccess: (data: { firstName: string; lastName: string; email: string; phone: string; password: string }) => void;
}

const Step2 = ({ resellerId, allowExistingCustomer, onBack, onSuccess }: Step2Props) => {
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [firstNameError, setFirstNameError] = useState<string>("");
  const [lastNameError, setLastNameError] = useState<string>("");
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
  };

  const handleContinue = async () => {
    setError("");
    setFirstNameError("");
    setLastNameError("");
    setEmailError("");
    setPhoneError("");

    // Validate all fields
    if (!firstName?.trim()) {
      setFirstNameError("First name is required.");
      setError("Please fill all required fields.");
      return;
    }
    if (!lastName?.trim()) {
      setLastNameError("Last name is required.");
      setError("Please fill all required fields.");
      return;
    }
    if (!email || !phone || !password || !confirmPassword) {
      setError("Please fill all required fields.");
      return;
    }

    if (!validateEmail(email)) {
      setEmailError("Enter a valid email address.");
      setError("Please fix the errors above before continuing.");
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
      // If reseller allows only existing (whitelist), check email/phone is in allowed list
      if (allowExistingCustomer) {
        const API_BASE_URL = getApiBaseUrl();
        const checkRes = await fetch(`${API_BASE_URL}/reseller/check-allowed-customer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resellerId,
            email: email.trim(),
            phone: phone.trim(),
          }),
        });
        const checkData = await checkRes.json();
        if (!checkData.allowed) {
          setError(
            "Your email or phone is not in the list of allowed contacts for this reseller. Please contact the reseller."
          );
          setLoading(false);
          return;
        }
      }

      // Check if email or phone already exists
      const checkResult = await checkMstCustomerExists(email, phone);
      
      if (checkResult?.exists && checkResult.data) {
        const existingUser = checkResult.data;
        if (existingUser.email === email) {
          setEmailError("Email already exists. Please use a different email.");
          setLoading(false);
          return;
        }
        if (existingUser.phone === phone) {
          setPhoneError("Phone number already exists. Please use a different phone number.");
          setLoading(false);
          return;
        }
      }

      // Create customer record (DB columns: first_name, last_name)
      const result = await createMstCustomer({
        reseller_id: resellerId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email,
        phone,
        password_hash: password,
      });

      // Check for GraphQL errors in response
      if (result?.errors && Array.isArray(result.errors) && result.errors.length > 0) {
        const errorMessage = extractGraphQLError(result);
        if (errorMessage.includes("email") || errorMessage.includes("Email")) {
          setEmailError(getConstraintViolationMessage(result));
        } else if (errorMessage.includes("phone") || errorMessage.includes("Phone")) {
          setPhoneError(getConstraintViolationMessage(result));
        } else {
          setError(getConstraintViolationMessage(result));
        }
        setLoading(false);
        return;
      }

      if (!result.success) {
        setError(result.message || "Failed to create account. Please try again.");
        setLoading(false);
        return;
      }

      // Call onSuccess to proceed to next step
      if (onSuccess) {
        onSuccess({ firstName: firstName.trim(), lastName: lastName.trim(), email, phone, password });
      } else {
        console.error("onSuccess callback is not defined");
        setError("An error occurred. Please try again.");
      }
    } catch (err: any) {
      console.error("Error creating account:", err);
      
      // Extract error message from GraphQL response format
      const errorMessage = extractGraphQLError(err);
      
      // Check if error is due to duplicate email/phone from database constraint
      if (errorMessage.includes("unique") || errorMessage.includes("duplicate") || errorMessage.includes("constraint")) {
        if (errorMessage.toLowerCase().includes("email")) {
          setEmailError(getConstraintViolationMessage(err));
        } else if (errorMessage.toLowerCase().includes("phone")) {
          setPhoneError(getConstraintViolationMessage(err));
        } else {
          setError(getConstraintViolationMessage(err));
        }
      } else {
        setError("Failed to create account. Please try again.");
      }
      setLoading(false);
    }
  };

  return (
    <>
      <h4 className="mb-12">Create Account</h4>

      {error && <div className="alert alert-danger mb-12">{error}</div>}

      <div className="row">
        <div className="col-md-6 mb-16">
          <label className="form-label text-sm mb-8">
            First Name <span className="text-danger">*</span>
          </label>
          <input
            className={`form-control h-56-px ${firstNameError ? "is-invalid" : ""}`}
            type="text"
            placeholder="Enter first name"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              if (firstNameError) setFirstNameError("");
            }}
          />
          {firstNameError && <div className="text-danger small mt-4">{firstNameError}</div>}
        </div>
        <div className="col-md-6 mb-16">
          <label className="form-label text-sm mb-8">
            Last Name <span className="text-danger">*</span>
          </label>
          <input
            className={`form-control h-56-px ${lastNameError ? "is-invalid" : ""}`}
            type="text"
            placeholder="Enter last name"
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              if (lastNameError) setLastNameError("");
            }}
          />
          {lastNameError && <div className="text-danger small mt-4">{lastNameError}</div>}
        </div>
      </div>

      <div className="mb-16">
        <label className="form-label text-sm mb-8">
          Email <span className="text-danger">*</span>
        </label>
        <input
          className={`form-control h-56-px ${emailError ? "is-invalid" : ""}`}
          type="email"
          placeholder="Enter your email address"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError("");
          }}
          onBlur={handleEmailBlur}
        />
        {emailError && <div className="text-danger small mt-4">{emailError}</div>}
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
          name="password"
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
          name="confirmPassword"
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

