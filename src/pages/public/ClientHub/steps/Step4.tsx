import { useState } from "react";
import OtpVerify from "../../Signup/steps/Components/OtpVerify";

interface Step4Props {
  phone: string;
  onBack: () => void;
  onVerify: () => void;
}

const Step4 = ({ phone, onBack, onVerify }: Step4Props) => {
  return (
    <OtpVerify
      title="Verify Phone Number (WhatsApp)"
      label="Phone"
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

