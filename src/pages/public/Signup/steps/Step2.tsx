import { updateOtpVerificationStep } from "@/hasura/mutations";
import { Step2Props } from "@/types/auth/signup";
import { useState } from "react";
import OtpVerify from "./Components/OtpVerify";

const Step2 = ({ email, onBack, onVerify }: Step2Props) => {

  return (
    <OtpVerify
      title="Verify Email"
      label="Email"
      onBack={onBack}
      onVerify={async () => {
        await updateOtpVerificationStep({ email });
        onVerify();
      }}
    />
  );
};

export default Step2;
