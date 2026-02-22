import { getMstResellerByEmail } from "@/hasura/mutations";
import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import SuccessPopup from "../../../components/Modal";
import Step1 from "./steps/Step1";
import Step2 from "./steps/Step2";
import Step3 from "./steps/Step3";
import Step4 from "./steps/Step4";
import Step5 from "./steps/Step5";
import Step6 from "./steps/Step6";
import Step7 from "./steps/Step7";

interface SignUpLayerProps {
  skipOtpVerification?: boolean;
}

const SignUpLayer = ({ skipOtpVerification = false }: SignUpLayerProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(1);
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    // Read step from URL query parameter
    const stepParam = searchParams.get("step");
    const requestedStep = stepParam ? parseInt(stepParam, 10) : null;

    // Get email from localStorage or URL
    const emailFromStorage = localStorage.getItem("signupEmail");
    const phoneFromStorage = localStorage.getItem("signupPhone");
    
    if (emailFromStorage) {
      setEmail(emailFromStorage);
      if (phoneFromStorage) {
        setPhone(phoneFromStorage);
      }
      // Always fetch user data first to get current_step from database
      // This will validate the requested step against the user's current_step
      fetchUserData(emailFromStorage, requestedStep);
    } else if (requestedStep) {
      // If step param exists but no email, validate step is between 1-7
      if (requestedStep >= 1 && requestedStep <= 7) {
        setStep(requestedStep);
      } else {
        // Invalid step, default to 1
        setStep(1);
        setSearchParams({ step: "1" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const fetchUserData = async (userEmail: string, requestedStep: number | null = null) => {
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
          setSearchParams({ step: "7" });
        } else {
          // Get current_step from database
          const currentStep = user.current_step || 0;
          const maxAllowedStep = currentStep + 1;

          // If step was requested from URL, validate it
          if (requestedStep !== null) {
            // Validate requested step against user's current_step
            if (requestedStep > maxAllowedStep) {
              // BLOCK access - requested step exceeds max allowed
              console.log(`⚠️  Step ${requestedStep} exceeds max allowed ${maxAllowedStep} for current_step ${currentStep}. Redirecting to step ${maxAllowedStep}`);
              setStep(maxAllowedStep);
              setSearchParams({ step: maxAllowedStep.toString() });
            } else if (requestedStep >= 1 && requestedStep <= maxAllowedStep) {
              // ALLOW access - requested step is within allowed range
              setStep(requestedStep);
              setSearchParams({ step: requestedStep.toString() });
            } else {
              // Invalid step, use max allowed
              setStep(maxAllowedStep);
              setSearchParams({ step: maxAllowedStep.toString() });
            }
          } else {
            // No step param, navigate to next step (current_step + 1)
            setStep(maxAllowedStep);
            setSearchParams({ step: maxAllowedStep.toString() });
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch user data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStepChange = (newStep: number) => {
    // If userData exists, enforce step navigation restrictions
    if (userData && !userData.signup_completed) {
      const maxAllowedStep = (userData.current_step || 0) + 1;
      
      // Allow navigation to steps 1 to maxAllowedStep (completed steps + next step)
      if (newStep >= 1 && newStep <= maxAllowedStep) {
        setStep(newStep);
        // Update URL parameter when step changes
        setSearchParams({ step: newStep.toString() });
      } else if (newStep > maxAllowedStep) {
        // If trying to skip ahead, redirect to next step
        console.log(`⚠️  Step ${newStep} not allowed. Redirecting to step ${maxAllowedStep}`);
        setStep(maxAllowedStep);
        setSearchParams({ step: maxAllowedStep.toString() });
      } else {
        // Invalid step, stay at current or go to 1
        setStep(1);
        setSearchParams({ step: "1" });
      }
    } else {
      // No userData or signup completed, allow free navigation
      setStep(newStep);
      setSearchParams({ step: newStep.toString() });
    }
  };

  // Validate step on mount and when userData changes or URL param changes
  useEffect(() => {
    const stepParam = searchParams.get("step");
    const requestedStep = stepParam ? parseInt(stepParam, 10) : null;

    if (userData && !userData.signup_completed) {
      const currentStep = userData.current_step || 0;
      const maxAllowedStep = currentStep + 1;
      
      // If URL param exists, validate it
      if (requestedStep !== null) {
        if (requestedStep > maxAllowedStep) {
          // BLOCK access - step exceeds max allowed
          console.log(`⚠️  URL step ${requestedStep} exceeds max allowed ${maxAllowedStep} for current_step ${currentStep}. Redirecting...`);
          setStep(maxAllowedStep);
          setSearchParams({ step: maxAllowedStep.toString() });
        } else if (requestedStep !== step) {
          // URL param is valid but different from current step, sync them
          setStep(requestedStep);
        }
      } else if (step > maxAllowedStep) {
        // Current step exceeds max allowed, redirect to next step
        console.log(`⚠️  Current step ${step} exceeds max allowed ${maxAllowedStep}. Redirecting...`);
        setStep(maxAllowedStep);
        setSearchParams({ step: maxAllowedStep.toString() });
      }
    } else if (requestedStep !== null && requestedStep !== step) {
      // No userData or signup completed, sync step with URL param
      if (requestedStep >= 1 && requestedStep <= 7) {
        setStep(requestedStep);
      }
    }
  }, [userData, step, searchParams]);

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
              skipOtpVerification={skipOtpVerification}
              onBack={() => handleStepChange(1)}
              onVerify={() => handleStepChange(3)}
            />
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <Step3
              email={email}
              phone={phone}
              skipOtpVerification={skipOtpVerification}
              onBack={() => handleStepChange(2)}
              onVerify={() => handleStepChange(4)}
            />
          )}

          {/* STEP 4 (PAN) */}
          {step === 4 && (
            <Step4
              email={email}
              skipOtpVerification={skipOtpVerification}
              onBack={() => handleStepChange(3)}
              onSubmit={() => handleStepChange(5)}
            />
          )}

          {/* STEP 5 (Aadhaar) */}
          {step === 5 && (
            <Step5
              email={email}
              skipOtpVerification={skipOtpVerification}
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
          {!skipOtpVerification && (
            <div className="mt-32 text-center text-sm">
              <p>
                Already have an account?{" "}
                <Link to="/sign-in" className="text-primary-600 fw-semibold">
                  Sign In
                </Link>
              </p>
            </div>
          )}
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
