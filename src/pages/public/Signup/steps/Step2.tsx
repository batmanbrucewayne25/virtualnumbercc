import { updateOtpVerificationStep } from "@/hasura/mutations";
import { Step2Props } from "@/types/auth/signup";
import OtpVerify from "./Components/OtpVerify";
import { useEffect } from "react";

interface Step2PropsWithSkip extends Step2Props {
  skipOtpVerification?: boolean;
}

const Step2 = ({ email, onBack, onVerify, skipOtpVerification = false }: Step2PropsWithSkip) => {
  // Auto-verify if skipOtpVerification is true
  useEffect(() => {
    if (skipOtpVerification && email) {
      const autoVerify = async () => {
        try {
          await updateOtpVerificationStep({ email });
          onVerify();
        } catch (err) {
          console.error("Error auto-verifying email:", err);
        }
      };
      autoVerify();
    }
  }, [skipOtpVerification, email, onVerify]);

  // If skipping OTP, show a message and auto-verify
  if (skipOtpVerification) {
    return (
      <>
        <h4 className="mb-12">Email Verification</h4>
        <div className="alert alert-info mb-16">
          <p className="mb-0">Email verification skipped (Admin mode)</p>
        </div>
        <p className="text-sm text-secondary-light mb-16">Verifying email automatically...</p>
      </>
    );
  }

  return (
    <OtpVerify
      title="Verify Email"
      label="Email"
      email={email}
      onBack={onBack}
      onVerify={async () => {
        // Update email verification status and move to step 3 (phone verification)
        await updateOtpVerificationStep({ email });
        onVerify();
      }}
    />
  );
};

export default Step2;
