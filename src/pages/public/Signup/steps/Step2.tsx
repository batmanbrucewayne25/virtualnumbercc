import { updateOtpVerificationStep } from "@/hasura/mutations";
import { Step2Props } from "@/types/auth/signup";
import OtpVerify from "./Components/OtpVerify";

const Step2 = ({ email, onBack, onVerify }: Step2Props) => {
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
