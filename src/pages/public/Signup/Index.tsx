import getMstResellerByEmail from "@/hasura/mutations";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SuccessPopup from "../../../components/Modal";
import Step1 from "./steps/Step1";
import Step2 from "./steps/Step2";
import Step3 from "./steps/Step3";
import Step4 from "./steps/Step4";
import Step5 from "./steps/Step5";
import Step6 from "./steps/Step6";
import Step7 from "./steps/Step7";

const SignUpLayer = () => {
  const [step, setStep] = useState<number>(1);
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const emailFromStorage = localStorage.getItem("signupEmail");
    const phoneFromStorage = localStorage.getItem("signupPhone");
    if (emailFromStorage) {
      setEmail(emailFromStorage);
      if (phoneFromStorage) {
        setPhone(phoneFromStorage);
      }
      fetchUserData(emailFromStorage);
    }
  }, []);

  const fetchUserData = async (userEmail: string) => {
    setLoading(true);
    try {
      const result = await getMstResellerByEmail({ email: userEmail });

      if (result?.mst_reseller?.length > 0) {
        const user = result.mst_reseller[0];
        setUserData(user);
        setEmail(userEmail);

        if (user.signup_completed) {
          setShowSuccess(true);
          setStep(7);
        } else {
          setStep(user.current_step || 1);
        }
      }
    } catch (err) {
      console.error("Failed to fetch user data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStepChange = (newStep: number) => {
    setStep(newStep);
  };

  const handleStep1Success = (data: any) => {
    setEmail(data.email);
    setPhone(data.phone);
    localStorage.setItem("signupEmail", data.email);
    localStorage.setItem("signupPhone", data.phone);
    handleStepChange(2);
  };

  if (loading) {
    return (
      <section className="auth bg-base d-flex flex-wrap">
        <div className="auth-right py-32 px-24 d-flex flex-column justify-content-center w-100">
          <div className="max-w-464-px mx-auto w-100 text-center">
            <p>Loading...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="auth bg-base d-flex flex-wrap">
      {/* LEFT (UNCHANGED) */}
      <div className="auth-left d-lg-block d-none">
        <div className="d-flex align-items-center flex-column h-100 justify-content-center">
          <img src="assets/images/own/login.svg" alt="Signup" />
        </div>
      </div>

      {/* RIGHT */}
      <div className="auth-right py-32 px-24 d-flex flex-column justify-content-center">
        <div className="max-w-464-px mx-auto w-100">
          {/* LOGO */}
          <Link to="/index" className="mb-40 max-w-290-px d-block">
            <img src="assets/images/own/dlogo.png" alt="Logo" />
          </Link>

          {/* STEP INDICATOR */}
          <p className="text-sm text-secondary-light mb-16">
            Step {step} of 7
          </p>

          {/* STEP 1 */}
          {step === 1 && <Step1 onSuccess={handleStep1Success} />}

          {/* STEP 2 */}
          {step === 2 && (
            <Step2
              email={email}
              onBack={() => handleStepChange(1)}
              onVerify={() => handleStepChange(3)}
            />
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <Step3
              email={email}
              phone={phone}
              onBack={() => handleStepChange(2)}
              onVerify={() => handleStepChange(4)}
            />
          )}

          {/* STEP 4 (Aadhaar) */}
          {step === 4 && (
            <Step4
              email={email}
              onBack={() => handleStepChange(3)}
              onSubmit={() => handleStepChange(5)}
            />
          )}

          {/* STEP 5 ✅ FIXED */}
          {step === 5 && (
            <Step5
              email={email}
              onBack={() => handleStepChange(4)}
              onSubmit={() => handleStepChange(6)}
            />
          )}

          {/* STEP 6 */}
          {step === 6 && (
            <Step6
              email={email}
              onBack={() => handleStepChange(5)}
              onContinue={() => handleStepChange(7)}
            />
          )}

          {/* STEP 7 */}
          {step === 7 && (
            <Step7
              email={email}
              onBack={() => handleStepChange(6)}
              onSubmit={() => setShowSuccess(true)}
            />
          )}

          {/* FOOTER */}
          <div className="mt-32 text-center text-sm">
            <p>
              Already have an account?{" "}
              <Link to="/sign-in" className="text-primary-600 fw-semibold">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>

      <SuccessPopup
        show={showSuccess}
        onClose={() => setShowSuccess(false)}
      />
    </section>
  );
};

export default SignUpLayer;
