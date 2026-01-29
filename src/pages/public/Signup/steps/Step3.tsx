import { updatePhoneOtpVerificationStep } from "@/hasura/mutations";
import { Step2Props } from "@/types/auth/signup";
import OtpVerify from "./Components/OtpVerify";

const Step3 = ({ email, phone, onBack, onVerify }: Step2Props & { phone?: string }) => {
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
