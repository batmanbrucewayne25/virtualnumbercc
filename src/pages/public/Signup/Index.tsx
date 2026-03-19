import { getMstResellerByEmail } from "@/hasura/mutations";
import { getPublishedCmsPages, getCmsPageBySlug } from "@/hasura/mutations/cms";
import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import SuccessPopup from "../../../components/Modal";
import CmsPageModal from "@/components/CmsPageModal";
import { getApiBaseUrl } from "@/utils/apiUrl";
import Step1 from "./steps/Step1";
import Step2 from "./steps/Step2";
import Step3 from "./steps/Step3";
import Step4 from "./steps/Step4";
import Step5 from "./steps/Step5";
import Step6 from "./steps/Step6";
import Step7 from "./steps/Step7";
import Step8 from "./steps/Step8";

interface SignUpLayerProps {
  skipOtpVerification?: boolean;
}

const SignUpLayer = ({ skipOtpVerification = false }: SignUpLayerProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(1);
  // Initialise email & phone synchronously from localStorage so that when
  // Step 3 (OtpVerify) mounts the phone prop is already populated and the
  // auto-send fires immediately on the first render — not on a second render
  // after a useEffect populates the value.
  const [email, setEmail] = useState<string>(() => localStorage.getItem("signupEmail") ?? "");
  const [phone, setPhone] = useState<string>(() => localStorage.getItem("signupPhone") ?? "");
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [cmsPages, setCmsPages] = useState<any[]>([]);
  const [cmsModalOpen, setCmsModalOpen] = useState(false);
  const [selectedCmsPage, setSelectedCmsPage] = useState<any>(null);
  const [cmsPageLoading, setCmsPageLoading] = useState(false);
  const buildType = import.meta.env.VITE_BUILD_TYPE || "admin";
  const isClientHubBuild = buildType === "clienthub";
  const [resellerId, setResellerId] = useState<string | null>(null);

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
      // If step param exists but no email, validate step is between 1-8
      if (requestedStep >= 1 && requestedStep <= 8) {
        setStep(requestedStep);
      } else {
        // Invalid step, default to 1
        setStep(1);
        setSearchParams({ step: "1" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // When ClientHub build, fetch reseller by domain for CMS context
  useEffect(() => {
    if (!isClientHubBuild) return;
    const domain = typeof window !== "undefined" ? window.location.hostname : "";
    if (!domain) return;
    const fetchResellerByDomain = async () => {
      try {
        const API_BASE_URL = getApiBaseUrl();
        const response = await fetch(
          `${API_BASE_URL}/reseller/by-domain?domain=${encodeURIComponent(domain)}`
        );
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data?.resellerId) {
            setResellerId(result.data.resellerId);
          }
        }
      } catch (err) {
        console.error("Error fetching reseller for Signup CMS:", err);
      }
    };
    fetchResellerByDomain();
  }, [isClientHubBuild]);

  // Fetch published CMS pages: admin only when admin build, reseller pages when ClientHub (after resellerId)
  useEffect(() => {
    const fetchCmsPages = async () => {
      if (isClientHubBuild && resellerId == null) return;
      try {
        const cmsResellerId = isClientHubBuild ? resellerId : null;
        const result = await getPublishedCmsPages(cmsResellerId);
        if (result.success && result.data) {
          setCmsPages(result.data);
        }
      } catch (err) {
        console.error("Failed to fetch CMS pages:", err);
      }
    };
    fetchCmsPages();
  }, [isClientHubBuild, resellerId]);

  // Handle CMS page click (admin page when admin build, reseller page when ClientHub)
  const handleCmsPageClick = async (e: React.MouseEvent, page: any) => {
    e.preventDefault();
    setCmsPageLoading(true);
    setCmsModalOpen(true);
    setSelectedCmsPage(null);
    const cmsResellerId = isClientHubBuild ? resellerId : null;
    try {
      const result = await getCmsPageBySlug(page.slug, cmsResellerId ?? undefined);
      if (result.success && result.data) {
        setSelectedCmsPage(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch CMS page:", err);
    } finally {
      setCmsPageLoading(false);
    }
  };

  const fetchUserData = async (userEmail: string, requestedStep: number | null = null) => {
    setLoading(true);
    try {
      const result = await getMstResellerByEmail({ email: userEmail });

      if (result?.mst_reseller?.length > 0) {
        const user = result.mst_reseller[0];
        setUserData(user);
        setEmail(userEmail);

        if (user.signup_completed) {
          // signup_completed means Step 7 data is saved — land on Step 8 (review screen)
          // so the reseller can review and press "Confirm & Submit" themselves.
          // Never auto-fire the success popup; only the button press in Step 8 does that.
          setStep(8);
          setSearchParams({ step: "8" });
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

  /**
   * Re-fetch the reseller record from the DB and update local userData state.
   * Returns the fresh user object so callers can use it immediately (avoids
   * stale-closure issues with the userData state variable).
   */
  const refreshUserData = async (userEmail: string): Promise<any | null> => {
    try {
      const result = await getMstResellerByEmail({ email: userEmail });
      const fresh = result?.mst_reseller?.[0] ?? null;
      if (fresh) setUserData(fresh);
      return fresh;
    } catch {
      return null;
    }
  };

  /**
   * Navigate to a new step.
   * Accepts an optional `latestUser` param — the freshly fetched user record —
   * so we always validate against the DB value, not stale React state.
   */
  const handleStepChange = (newStep: number, latestUser?: any) => {
    const user = latestUser ?? userData;

    if (user && !user.signup_completed) {
      const maxAllowedStep = (user.current_step || 0) + 1;

      if (newStep >= 1 && newStep <= maxAllowedStep) {
        setStep(newStep);
        setSearchParams({ step: newStep.toString() });
      } else if (newStep > maxAllowedStep) {
        console.log(`⚠️  Step ${newStep} not allowed (max ${maxAllowedStep}). Redirecting.`);
        setStep(maxAllowedStep);
        setSearchParams({ step: maxAllowedStep.toString() });
      } else {
        setStep(1);
        setSearchParams({ step: "1" });
      }
    } else {
      // No userData or signup_completed — allow free navigation (Step 8 confirm, etc.)
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
      if (requestedStep >= 1 && requestedStep <= 8) {
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
      <section className="auth bg-base d-flex flex-wrap" style={{ height: "100vh", overflow: "hidden" }}>
        <div className="auth-right py-32 px-24 d-flex flex-column justify-content-center w-100">
          <div className="max-w-464-px mx-auto w-100 text-center">
            <p>Loading...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="auth bg-base d-flex flex-wrap"
      style={{ height: "100vh", overflow: "hidden" }}
    >
      {/* LEFT — fixed, never scrolls */}
      <div
        className="auth-left d-lg-block d-none"
        style={{ position: "sticky", top: 0, height: "100vh", flexShrink: 0 }}
      >
        <div className="d-flex align-items-center flex-column h-100 justify-content-center">
          <img src="assets/images/own/login.svg" alt="Signup" />
        </div>
      </div>

      {/* RIGHT — independently scrollable */}
      <div
        className="auth-right py-32 px-24 d-flex flex-column"
        style={{ height: "100vh", overflowY: "auto", justifyContent: "flex-start" }}
      >
        <div className="max-w-464-px mx-auto w-100">
          {/* LOGO */}
          <Link to="/index" className="mb-40 max-w-290-px d-block">
            <img src="assets/images/own/dlogo.png" alt="Logo" />
          </Link>

          {/* STEP INDICATOR */}
          <p className="text-sm text-secondary-light mb-16">
            Step {step} of 8
          </p>

          {/* STEP 1 */}
          {step === 1 && <Step1 onSuccess={handleStep1Success} />}

          {/* STEP 2 */}
          {step === 2 && (
            <Step2
              email={email}
              skipOtpVerification={skipOtpVerification}
              onBack={() => handleStepChange(1)}
              onVerify={async () => {
                const fresh = await refreshUserData(email);
                handleStepChange(3, fresh);
              }}
            />
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <Step3
              email={email}
              phone={phone}
              skipOtpVerification={skipOtpVerification}
              onBack={() => handleStepChange(2)}
              onVerify={async () => {
                const fresh = await refreshUserData(email);
                handleStepChange(4, fresh);
              }}
            />
          )}

          {/* STEP 4 (PAN) */}
          {step === 4 && (
            <Step4
              email={email}
              skipOtpVerification={skipOtpVerification}
              onBack={() => handleStepChange(3)}
              onSubmit={async () => {
                const fresh = await refreshUserData(email);
                handleStepChange(5, fresh);
              }}
            />
          )}

          {/* STEP 5 (Aadhaar) */}
          {step === 5 && (
            <Step5
              email={email}
              skipOtpVerification={skipOtpVerification}
              onBack={() => handleStepChange(4)}
              onSubmit={async () => {
                const fresh = await refreshUserData(email);
                handleStepChange(6, fresh);
              }}
            />
          )}

          {/* STEP 6 */}
          {step === 6 && (
            <Step6
              email={email}
              onBack={() => handleStepChange(5)}
              onContinue={async () => {
                const fresh = await refreshUserData(email);
                handleStepChange(7, fresh);
              }}
            />
          )}

          {/* STEP 7 */}
          {step === 7 && (
            <Step7
              email={email}
              onBack={() => handleStepChange(6)}
              onSubmit={async () => {
                const fresh = await refreshUserData(email);
                handleStepChange(8, fresh);
              }}
            />
          )}

          {/* STEP 8 — Review & Confirm */}
          {step === 8 && (
            <Step8
              email={email}
              onBack={() => handleStepChange(7)}
              onConfirm={() => setShowSuccess(true)}
            />
          )}

          {/* FOOTER */}
          <div className="mt-32">
            {!skipOtpVerification && (
              <div className="text-center text-sm mb-16">
                <p>
                  Already have an account?{" "}
                  <Link to="/sign-in" className="text-primary-600 fw-semibold">
                    Sign In
                  </Link>
                </p>
              </div>
            )}
            
            {/* CMS Pages Links */}
            {cmsPages.length > 0 && (
              <div className="text-center">
                <div className="d-flex flex-wrap justify-content-center gap-3 mb-12">
                  {cmsPages.map((page) => (
                    <button
                      key={page.id}
                      type="button"
                      onClick={(e) => handleCmsPageClick(e, page)}
                      className="btn btn-link text-sm text-secondary-light text-decoration-none p-0"
                    >
                      {page.page_title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <SuccessPopup
        show={showSuccess}
        onClose={() => setShowSuccess(false)}
      />

      {/* CMS Page Modal */}
      <CmsPageModal
        isOpen={cmsModalOpen}
        onClose={() => {
          setCmsModalOpen(false);
          setSelectedCmsPage(null);
        }}
        page={selectedCmsPage}
        loading={cmsPageLoading}
      />
    </section>
  );
};

export default SignUpLayer;
