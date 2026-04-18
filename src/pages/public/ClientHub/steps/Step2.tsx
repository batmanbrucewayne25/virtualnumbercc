import PasswordField from "@/components/Form/PasswordField";
import { useState } from "react";
import { checkMstCustomerExists, createMstCustomer } from "@/hasura/mutations/customer";
import { getConstraintViolationMessage, extractGraphQLError } from "@/utils/graphqlErrorHandler";
import { getApiBaseUrl } from "@/utils/apiUrl.js";
import { getStrongPasswordError, STRONG_PASSWORD_HINT } from "@/utils/passwordPolicy";
import { mergeAutofillWithState } from "@/utils/formAutofillSync";

/** Stable ids for DOM read at submit (Chrome autofill often skips React onChange). */
const CLIENTHUB_SIGNUP_FIELD_IDS = {
  firstName: "clienthub-first-name",
  lastName: "clienthub-last-name",
  email: "clienthub-email",
  phone: "clienthub-phone",
  password: "clienthub-password",
  confirmPassword: "clienthub-confirm-password",
} as const;

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
    const em = mergeAutofillWithState(CLIENTHUB_SIGNUP_FIELD_IDS.email, email);
    setEmail(em);
    setEmailError("");
    if (!em) {
      setEmailError("Email is required.");
      return;
    }
    if (!validateEmail(em)) {
      setEmailError("Enter a valid email address.");
      return;
    }
  };

  const handleContinue = async () => {
    const fn = mergeAutofillWithState(CLIENTHUB_SIGNUP_FIELD_IDS.firstName, firstName);
    const ln = mergeAutofillWithState(CLIENTHUB_SIGNUP_FIELD_IDS.lastName, lastName);
    const em = mergeAutofillWithState(CLIENTHUB_SIGNUP_FIELD_IDS.email, email);
    const phRaw = mergeAutofillWithState(CLIENTHUB_SIGNUP_FIELD_IDS.phone, phone);
    const ph = phRaw.replace(/\D/g, "").slice(0, 10);
    const pw = mergeAutofillWithState(CLIENTHUB_SIGNUP_FIELD_IDS.password, password);
    const pw2 = mergeAutofillWithState(CLIENTHUB_SIGNUP_FIELD_IDS.confirmPassword, confirmPassword);

    setFirstName(fn);
    setLastName(ln);
    setEmail(em);
    setPhone(ph);
    setPassword(pw);
    setConfirmPassword(pw2);

    setError("");
    setFirstNameError("");
    setLastNameError("");
    setEmailError("");
    setPhoneError("");

    // Validate all fields (use merged values — authoritative for autofill)
    if (!fn) {
      setFirstNameError("First name is required.");
      setError("Please fill all required fields.");
      return;
    }
    if (!ln) {
      setLastNameError("Last name is required.");
      setError("Please fill all required fields.");
      return;
    }
    if (!em || !ph || !pw || !pw2) {
      setError("Please fill all required fields.");
      return;
    }

    if (!validateEmail(em)) {
      setEmailError("Enter a valid email address.");
      setError("Please fix the errors above before continuing.");
      return;
    }

    if (!validatePhone(ph)) {
      setPhoneError("Enter a valid 10-digit phone number starting with 6-9.");
      setError("Please enter a valid phone number.");
      return;
    }

    const passwordError = getStrongPasswordError(pw);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (pw !== pw2) {
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
            email: em.trim(),
            phone: ph.trim(),
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
      const checkResult = await checkMstCustomerExists(em, ph);
      
      if (checkResult?.exists && checkResult.data) {
        const existingUser = checkResult.data;
        if (existingUser.email === em) {
          setEmailError("Email already exists. Please use a different email.");
          setLoading(false);
          return;
        }
        if (existingUser.phone === ph) {
          setPhoneError("Phone number already exists. Please use a different phone number.");
          setLoading(false);
          return;
        }
      }

      // Create customer record (DB columns: first_name, last_name)
      const result = await createMstCustomer({
        reseller_id: resellerId,
        first_name: fn,
        last_name: ln,
        email: em,
        phone: ph,
        password_hash: pw,
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
        onSuccess({ firstName: fn, lastName: ln, email: em, phone: ph, password: pw });
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
            id={CLIENTHUB_SIGNUP_FIELD_IDS.firstName}
            className={`form-control h-56-px ${firstNameError ? "is-invalid" : ""}`}
            type="text"
            name="given-name"
            autoComplete="given-name"
            placeholder="Enter first name"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              if (firstNameError) setFirstNameError("");
            }}
            onInput={(e) => {
              setFirstName(e.currentTarget.value);
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
            id={CLIENTHUB_SIGNUP_FIELD_IDS.lastName}
            className={`form-control h-56-px ${lastNameError ? "is-invalid" : ""}`}
            type="text"
            name="family-name"
            autoComplete="family-name"
            placeholder="Enter last name"
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              if (lastNameError) setLastNameError("");
            }}
            onInput={(e) => {
              setLastName(e.currentTarget.value);
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
          id={CLIENTHUB_SIGNUP_FIELD_IDS.email}
          className={`form-control h-56-px ${emailError ? "is-invalid" : ""}`}
          type="email"
          name="email"
          autoComplete="email"
          placeholder="Enter your email address"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError("");
          }}
          onInput={(e) => {
            setEmail(e.currentTarget.value);
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
          id={CLIENTHUB_SIGNUP_FIELD_IDS.phone}
          className={`form-control h-56-px ${phoneError ? "is-invalid" : ""}`}
          type="tel"
          name="tel"
          autoComplete="tel"
          inputMode="numeric"
          placeholder="10-digit mobile number"
          value={phone}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "").slice(0, 10);
            setPhone(value);
            if (phoneError) setPhoneError("");
          }}
          onInput={(e) => {
            const value = e.currentTarget.value.replace(/\D/g, "").slice(0, 10);
            setPhone(value);
            if (phoneError) setPhoneError("");
          }}
          onBlur={() => {
            const raw = mergeAutofillWithState(CLIENTHUB_SIGNUP_FIELD_IDS.phone, phone);
            const digits = raw.replace(/\D/g, "").slice(0, 10);
            setPhone(digits);
            if (digits && !validatePhone(digits)) {
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
          id={CLIENTHUB_SIGNUP_FIELD_IDS.password}
          name="new-password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-0"
          required
          autoComplete="new-password"
        />
        <small className="text-secondary-light">{STRONG_PASSWORD_HINT}</small>
      </div>

      <div className="mb-16">
        <label className="form-label text-sm mb-8">
          Confirm Password <span className="text-danger">*</span>
        </label>
        <PasswordField
          id={CLIENTHUB_SIGNUP_FIELD_IDS.confirmPassword}
          name="confirm-password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mb-0"
          required
          autoComplete="new-password"
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

