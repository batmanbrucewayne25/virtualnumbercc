import PasswordField from "@/components/Form/PasswordField";
import { insertMstReseller, checkMstResellerExists } from "@/hasura/mutations";
import { Step1Props } from "@/types/auth/signup";
import { useState } from "react";
import { getConstraintViolationMessage, extractGraphQLError } from "@/utils/graphqlErrorHandler";
import { getStrongPasswordError, STRONG_PASSWORD_HINT } from "@/utils/passwordPolicy";
import { mergeAutofillWithState } from "@/utils/formAutofillSync";

const RESELLER_SIGNUP_FIELD_IDS = {
  firstName: "signup-first-name",
  lastName: "signup-last-name",
  email: "signup-email",
  phone: "signup-phone",
  password: "signup-password",
  confirmPassword: "signup-confirm-password",
} as const;

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

  // Personal/free email domains not allowed for reseller onboarding (company email only)
  const PERSONAL_EMAIL_DOMAINS = [
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "yahoo.in",
    "hotmail.com", "hotmail.co.in", "outlook.com", "live.com", "live.in", "msn.com",
    "icloud.com", "me.com", "mac.com",
    "mail.com", "protonmail.com", "proton.me", "zoho.com", "rediffmail.com",
    "aol.com", "ymail.com", "gmx.com", "gmx.net", "inbox.com", "mail.ru",
    "outlook.in", "outlook.co.in", "skiff.com", "tutanota.com", "fastmail.com",
  ];

  const getEmailDomain = (em: string): string => {
    const parts = em.trim().toLowerCase().split("@");
    return parts.length === 2 ? parts[1] : "";
  };

  const isPersonalEmailDomain = (em: string): boolean => {
    const domain = getEmailDomain(em);
    return PERSONAL_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith("." + d));
  };

  const handleContinue = async () => {
    const fn = mergeAutofillWithState(RESELLER_SIGNUP_FIELD_IDS.firstName, firstName);
    const ln = mergeAutofillWithState(RESELLER_SIGNUP_FIELD_IDS.lastName, lastName);
    const em = mergeAutofillWithState(RESELLER_SIGNUP_FIELD_IDS.email, email);
    const phRaw = mergeAutofillWithState(RESELLER_SIGNUP_FIELD_IDS.phone, phone);
    const ph = phRaw.replace(/\D/g, "").slice(0, 10);
    const pw = mergeAutofillWithState(RESELLER_SIGNUP_FIELD_IDS.password, password);
    const pw2 = mergeAutofillWithState(RESELLER_SIGNUP_FIELD_IDS.confirmPassword, confirmPassword);

    setFirstName(fn);
    setLastName(ln);
    setEmail(em);
    setPhone(ph);
    setPassword(pw);
    setConfirmPassword(pw2);

    setError("");

    if (!fn || !ln || !em || !ph || !pw) {
      setError("Please fill all required fields.");
      return;
    }

    if (!validatePhone(ph)) {
      setPhoneError("Enter a valid 10-digit phone number");
      return;
    }

    if (!validateEmail(em)) {
      setEmailError("Enter a valid email address");
      return;
    }

    if (isPersonalEmailDomain(em)) {
      setEmailError("Please use a company email address. Personal email domains (e.g. Gmail, Yahoo) are not allowed.");
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

    setLoading(true);
    try {
      // Check if email or phone already exists
      const checkResult = await checkMstResellerExists({ email: em, phone: ph });
      
      if (checkResult?.mst_reseller && checkResult.mst_reseller.length > 0) {
        const existingUser = checkResult.mst_reseller[0];
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

      // If validation passes, save the record
      const result = await insertMstReseller({
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

      onSuccess({ email: em, phone: ph });
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
        setError("Failed to create account. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h4 className="mb-12">Create Account</h4>

      {error && <div className="alert alert-danger mb-12">{error}</div>}

      <input
        id={RESELLER_SIGNUP_FIELD_IDS.firstName}
        className="form-control h-56-px mb-16"
        placeholder="First Name"
        name="given-name"
        autoComplete="given-name"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        onInput={(e) => setFirstName(e.currentTarget.value)}
      />

      <input
        id={RESELLER_SIGNUP_FIELD_IDS.lastName}
        className="form-control h-56-px mb-16"
        placeholder="Last Name"
        name="family-name"
        autoComplete="family-name"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        onInput={(e) => setLastName(e.currentTarget.value)}
      />

      <input
        id={RESELLER_SIGNUP_FIELD_IDS.phone}
        className="form-control h-56-px mb-16"
        placeholder="Phone Number"
        name="tel"
        autoComplete="tel"
        inputMode="numeric"
        type="tel"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value);
          if (phoneError) setPhoneError("");
        }}
        onInput={(e) => {
          setPhone(e.currentTarget.value);
          if (phoneError) setPhoneError("");
        }}
        onBlur={() => {
          const raw = mergeAutofillWithState(RESELLER_SIGNUP_FIELD_IDS.phone, phone);
          const digits = raw.replace(/\D/g, "").slice(0, 10);
          setPhone(digits);
          if (digits && !validatePhone(digits)) {
            setPhoneError("Enter a valid 10-digit phone number");
          }
        }}
      />

      {phoneError && <div className="text-danger small mb-12">{phoneError}</div>}

      <input
        id={RESELLER_SIGNUP_FIELD_IDS.email}
        className="form-control h-56-px mb-8"
        placeholder="Company email (e.g. you@yourcompany.com)"
        name="email"
        autoComplete="email"
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (emailError) setEmailError("");
        }}
        onInput={(e) => {
          setEmail(e.currentTarget.value);
          if (emailError) setEmailError("");
        }}
        onBlur={() => {
          const em = mergeAutofillWithState(RESELLER_SIGNUP_FIELD_IDS.email, email);
          setEmail(em);
          if (!em) return;
          if (!validateEmail(em)) {
            setEmailError("Enter a valid email address");
          } else if (isPersonalEmailDomain(em)) {
            setEmailError("Please use a company email address. Personal email domains (e.g. Gmail, Yahoo) are not allowed.");
          } else {
            setEmailError("");
          }
        }}
      />
      <small className="text-secondary-light d-block mb-16">Use your company email. Personal emails (Gmail, Yahoo, etc.) are not allowed.</small>

      {emailError && (
        <div className="text-danger small mb-12">{emailError}</div>
      )}

      <PasswordField
        id={RESELLER_SIGNUP_FIELD_IDS.password}
        name="new-password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-8"
        required
        autoComplete="new-password"
      />
      <small className="text-secondary-light d-block mb-16">{STRONG_PASSWORD_HINT}</small>

      <PasswordField
        id={RESELLER_SIGNUP_FIELD_IDS.confirmPassword}
        name="confirm-password"
        placeholder="Confirm Password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="mb-24"
        required
        autoComplete="new-password"
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
