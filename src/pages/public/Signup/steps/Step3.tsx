import { updatePhoneOtpVerificationStep } from "@/hasura/mutations";
import { Step2Props } from "@/types/auth/signup";
import OtpVerify from "./Components/OtpVerify";
import { useEffect } from "react";

interface Step3PropsWithSkip extends Step2Props {
  phone?: string;
  skipOtpVerification?: boolean;
}

const Step3 = ({ email, phone, onBack, onVerify, skipOtpVerification = false }: Step3PropsWithSkip) => {
  // Auto-verify if skipOtpVerification is true
  useEffect(() => {
    if (skipOtpVerification && email) {
      const autoVerify = async () => {
        try {
          await updatePhoneOtpVerificationStep({ email });
          onVerify();
        } catch (err) {
          console.error("Error auto-verifying phone:", err);
        }
      };
      autoVerify();
    }
  }, [skipOtpVerification, email, onVerify]);

  // If skipping OTP, show a message and auto-verify
  if (skipOtpVerification) {
    return (
      <>
        <h4 className="mb-12">Phone Verification</h4>
        <div className="alert alert-info mb-16">
          <p className="mb-0">Phone verification skipped (Admin mode)</p>
        </div>
        <p className="text-sm text-secondary-light mb-16">Verifying phone automatically...</p>
      </>
    );
  }

  return (
    <OtpVerify
      title="Verify Phone Number"
      label="Phone"
      phone={phone}
      onBack={onBack}
      onVerify={async () => {
        if (email) {
          await updatePhoneOtpVerificationStep({ email });
        }
        onVerify();
      }}
    />
  );
};

export default Step3;
