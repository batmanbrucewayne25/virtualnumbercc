import { useState, useEffect } from "react";
import OtpVerify from "../../Signup/steps/Components/OtpVerify";

interface Step4Props {
  phone: string;
  skipOtpVerification?: boolean;
  onBack: () => void;
  onVerify: () => void;
}

const Step4 = ({ phone, skipOtpVerification = false, onBack, onVerify }: Step4Props) => {
  // Auto-verify if skipOtpVerification is true
  useEffect(() => {
    if (skipOtpVerification && phone) {
      onVerify();
    }
  }, [skipOtpVerification, phone, onVerify]);

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
      title="Verify Phone Number (WhatsApp)"
      label="Phone"
      phone={phone}
      onBack={onBack}
      onVerify={async () => {
        // TODO: Add WhatsApp OTP verification API call
        // For now, just proceed
        onVerify();
      }}
    />
  );
};

export default Step4;
