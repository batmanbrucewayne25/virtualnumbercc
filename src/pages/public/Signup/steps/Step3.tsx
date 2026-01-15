import { updateOtpVerificationStep } from "@/hasura/mutations";
import { Step2Props } from "@/types/auth/signup";
import { useState } from "react";
import OtpVerify from "./Components/OtpVerify";

const Step3 = ({ email, onBack, onVerify }: Step2Props) => {

  return (
    <OtpVerify
      title="Verify Phone Number"
      label="Phone"
      onBack={onBack}
      onVerify={async () => {
        // future: updatePhoneOtpVerificationStep
        onVerify();
      }}
    />
  );
};

export default Step3;
