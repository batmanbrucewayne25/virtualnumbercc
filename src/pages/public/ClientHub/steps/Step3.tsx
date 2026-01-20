import { useState } from "react";
import OtpVerify from "../../Signup/steps/Components/OtpVerify";

interface Step3Props {
  email: string;
  onBack: () => void;
  onVerify: () => void;
}

const Step3 = ({ email, onBack, onVerify }: Step3Props) => {
  return (
    <OtpVerify
      title="Verify Email"
      label="Email"
      onBack={onBack}
      onVerify={async () => {
        // TODO: Add email OTP verification API call
        // For now, just proceed
        onVerify();
      }}
    />
  );
};

export default Step3;

