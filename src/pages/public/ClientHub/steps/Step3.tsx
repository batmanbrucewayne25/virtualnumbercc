import { useState, useEffect } from "react";
import OtpVerify from "../../Signup/steps/Components/OtpVerify";

interface Step3Props {
  email: string;
  skipOtpVerification?: boolean;
  onBack: () => void;
  onVerify: () => void;
}

const Step3 = ({ email, skipOtpVerification = false, onBack, onVerify }: Step3Props) => {
  // Auto-verify if skipOtpVerification is true
  useEffect(() => {
    if (skipOtpVerification && email) {
      onVerify();
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
      userType="customer"
      onBack={onBack}
      onVerify={async () => {
        onVerify();
      }}
    />
  );
};

export default Step3;
