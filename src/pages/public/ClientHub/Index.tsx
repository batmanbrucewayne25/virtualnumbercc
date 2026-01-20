import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getMstResellerById } from "@/hasura/mutations/reseller";
import Step1 from "./steps/Step1";
import Step2 from "./steps/Step2";
import Step3 from "./steps/Step3";
import Step4 from "./steps/Step4";
import Step5 from "./steps/Step5";
import Step6 from "./steps/Step6";
import Step7 from "./steps/Step7";
import Step8 from "./steps/Step8";
import Step9 from "./steps/Step9";
import Step10 from "./steps/Step10";
import Step11 from "./steps/Step11";

const ClientHubLayer = () => {
  const { resellerId } = useParams<{ resellerId: string }>();
  const [step, setStep] = useState<number>(1);
  const [resellerData, setResellerData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [formData, setFormData] = useState<any>({
    email: "",
    phone: "",
    password: "",
    panData: null,
    aadhaarData: null,
    gstData: null,
    signature: null,
  });

  useEffect(() => {
    // Fetch reseller data to get reseller name for success message
    const fetchResellerData = async () => {
      if (resellerId) {
        setLoading(true);
        try {
          const result = await getMstResellerById(resellerId);
          if (result.success && result.data) {
            setResellerData(result.data);
          } else {
            console.error("Failed to fetch reseller:", result.message);
          }
        } catch (err) {
          console.error("Failed to fetch reseller data:", err);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchResellerData();
  }, [resellerId]);

  const handleStepChange = (newStep: number) => {
    setStep(newStep);
  };

  const handleStep1Success = (data: any) => {
    setFormData((prev: any) => ({ ...prev, ...data }));
    handleStepChange(2);
  };

  const handleStep2Success = (data: any) => {
    setFormData((prev: any) => ({ ...prev, ...data }));
    handleStepChange(3);
  };

  const handleStep2FormSuccess = (data: any) => {
    setFormData((prev: any) => ({ ...prev, ...data }));
    handleStepChange(3);
  };

  const handleStep3Success = (data: any) => {
    setFormData((prev: any) => ({ ...prev, ...data }));
    handleStepChange(4);
  };

  const handleStep3Verify = async () => {
    try {
      handleStep3Success({});
    } catch (error) {
      console.error("Error in Step3 verify:", error);
      throw error;
    }
  };

  const handleStep4Success = (data: any) => {
    setFormData((prev: any) => ({ ...prev, ...data }));
    handleStepChange(5);
  };

  const handleStep4Verify = async () => {
    try {
      handleStep4Success({});
    } catch (error) {
      console.error("Error in Step4 verify:", error);
      throw error;
    }
  };

  const handleStep5Success = (data: any) => {
    setFormData((prev: any) => ({ ...prev, panData: data }));
    handleStepChange(6);
  };

  const handleStep6Success = (data: any) => {
    setFormData((prev: any) => ({ ...prev, aadhaarData: data }));
    handleStepChange(7);
  };

  const handleStep7Success = () => {
    handleStepChange(8);
  };

  const handleStep8Success = (data: any) => {
    setFormData((prev: any) => ({ ...prev, gstData: data }));
    handleStepChange(9);
  };

  const handleStep9Success = (data: any) => {
    setFormData((prev: any) => ({ ...prev, signature: data }));
    handleStepChange(10);
  };

  const handleStep10Success = () => {
    handleStepChange(11);
  };

  if (loading && !resellerData) {
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
          <img src="assets/images/own/login.svg" alt="Onboarding" />
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
            Step {step} of 11
          </p>

          {/* STEP 1: Login or Sign Up */}
          {step === 1 && (
            <Step1
              resellerId={resellerId || ""}
              onSignUp={() => handleStepChange(2)}
              onLogin={() => {
                // TODO: Handle login flow
                console.log("Login clicked");
              }}
            />
          )}

          {/* STEP 2: Form 1 - Business Email, Mobile, Password */}
          {step === 2 && (
            <Step2
              onBack={() => handleStepChange(1)}
              onSuccess={handleStep2FormSuccess}
            />
          )}

          {/* STEP 3: Email OTP Verification */}
          {step === 3 && (
            <Step3
              email={formData.email}
              onBack={() => handleStepChange(2)}
              onVerify={handleStep3Verify}
            />
          )}

          {/* STEP 4: Phone/WhatsApp OTP Verification */}
          {step === 4 && (
            <Step4
              phone={formData.phone}
              onBack={() => handleStepChange(3)}
              onVerify={handleStep4Verify}
            />
          )}

          {/* STEP 5: PAN Card Verification */}
          {step === 5 && (
            <Step5
              email={formData.email}
              onBack={() => handleStepChange(4)}
              onSubmit={handleStep5Success}
            />
          )}

          {/* STEP 6: Aadhaar Verification */}
          {step === 6 && (
            <Step6
              email={formData.email}
              onBack={() => handleStepChange(5)}
              onSubmit={handleStep6Success}
            />
          )}

          {/* STEP 7: DOB Matching */}
          {step === 7 && (
            <Step7
              panData={formData.panData}
              aadhaarData={formData.aadhaarData}
              onBack={() => handleStepChange(6)}
              onSuccess={handleStep7Success}
            />
          )}

          {/* STEP 8: GST Verification (Optional) */}
          {step === 8 && (
            <Step8
              email={formData.email}
              onBack={() => handleStepChange(7)}
              onContinue={handleStep8Success}
            />
          )}

          {/* STEP 9: Digital Signature */}
          {step === 9 && (
            <Step9
              email={formData.email}
              onBack={() => handleStepChange(8)}
              onSubmit={handleStep9Success}
            />
          )}

          {/* STEP 10: Preview Screen */}
          {step === 10 && (
            <Step10
              formData={formData}
              resellerId={resellerId || ""}
              onBack={() => handleStepChange(9)}
              onSubmit={handleStep10Success}
            />
          )}

          {/* STEP 11: Success Screen */}
          {step === 11 && (
            <Step11
              resellerName={
                resellerData?.business_name ||
                `${resellerData?.first_name || ""} ${resellerData?.last_name || ""}`.trim() ||
                "Admin"
              }
            />
          )}

          {/* FOOTER */}
          {step !== 11 && (
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
    </section>
  );
};

export default ClientHubLayer;
