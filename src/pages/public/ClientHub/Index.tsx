import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { getMstResellerById } from "@/hasura/mutations/reseller";
import { getPublishedCmsPages } from "@/hasura/mutations/cms";
import { getApiBaseUrl } from "@/utils/apiUrl.js";
import { isAuthenticated } from "@/utils/auth.js";
import Step1 from "./steps/Step1";
import Step2 from "./steps/Step2";
import Step3 from "./steps/Step3";
import Step4 from "./steps/Step4";
import Step5 from "./steps/Step5";
import Step6 from "./steps/Step6";
import Step8 from "./steps/Step8";
import Step9 from "./steps/Step9";
import Step10 from "./steps/Step10";
import Step11 from "./steps/Step11";

const isClientHubBuild = import.meta.env.VITE_BUILD_TYPE === "clienthub";

const STORAGE_KEY_PREFIX = "clienthub_progress_";
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const getStorageKey = (resellerId: string) => `${STORAGE_KEY_PREFIX}${resellerId}`;

const loadProgress = (resellerId: string): { step: number; formData: any } | null => {
  try {
    const raw = sessionStorage.getItem(getStorageKey(resellerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.step !== "number") return null;
    const age = Date.now() - (parsed.timestamp || 0);
    if (age > STORAGE_TTL_MS) return null;
    return { step: parsed.step, formData: parsed.formData || {} };
  } catch {
    return null;
  }
};

const saveProgress = (resellerId: string, step: number, formData: any) => {
  try {
    const toSave = { ...formData };
    delete toSave.password; // Never persist password
    sessionStorage.setItem(
      getStorageKey(resellerId),
      JSON.stringify({ step, formData: toSave, timestamp: Date.now() })
    );
  } catch (e) {
    console.warn("Failed to save ClientHub progress:", e);
  }
};

const clearProgress = (resellerId: string) => {
  try {
    sessionStorage.removeItem(getStorageKey(resellerId));
  } catch {}
};

interface ClientHubLayerProps {
  skipOtpVerification?: boolean;
  resellerId?: string;
  isAdminMode?: boolean;
}

const ClientHubLayer = ({
  skipOtpVerification = false,
  resellerId: resellerIdProp,
  isAdminMode = false,
}: ClientHubLayerProps) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { resellerId: resellerIdFromUrl } = useParams<{
    resellerId?: string;
  }>();
  const [resellerId, setResellerId] = useState<string | null>(
    resellerIdProp || null
  );
  const [step, setStep] = useState<number>(isAdminMode ? 2 : 1); // Skip Step1 (login/signup) in admin mode
  const [resellerData, setResellerData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(!isAdminMode); // Don't load if admin mode with resellerId provided
  const [error, setError] = useState<string>("");
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [formData, setFormData] = useState<any>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    panData: null,
    aadhaarData: null,
    gstData: null,
    signature: null,
  });
  const [progressRestored, setProgressRestored] = useState(false);
  const [cmsPages, setCmsPages] = useState<any[]>([]);

  // ClientHub deploy: already logged in (e.g. reseller) → dashboard, not onboarding
  useEffect(() => {
    if (!isClientHubBuild || isAdminMode || resellerIdProp) return;
    if (isAuthenticated()) {
      navigate("/reseller-dashboard", { replace: true });
    }
  }, [navigate, isAdminMode, resellerIdProp]);

  useEffect(() => {
    setProgressRestored(false);
  }, [resellerId]);

  // Fetch reseller's published CMS pages for footer
  useEffect(() => {
    if (!resellerId) return;
    const fetchCms = async () => {
      try {
        const result = await getPublishedCmsPages(resellerId);
        if (result.success && result.data) setCmsPages(result.data);
      } catch (err) {
        console.error("Failed to fetch CMS pages for ClientHub footer:", err);
      }
    };
    fetchCms();
  }, [resellerId]);

  useEffect(() => {
    // If resellerId is provided as prop (admin mode), use it directly
    if (resellerIdProp) {
      setResellerId(resellerIdProp);
      // Fetch reseller data
      const fetchResellerData = async () => {
        try {
          const result = await getMstResellerById(resellerIdProp);
          if (result.success && result.data) {
            setResellerData(result.data);
          }
        } catch (err) {
          console.error("Failed to fetch reseller data:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchResellerData();
      return;
    }

    // Determine resellerId from URL param or domain
    const determineResellerId = async () => {
      setLoading(true);
      setError("");

      try {
        let finalResellerId: string | null = null;

        // First, check if resellerId is in URL (backward compatibility)
        if (resellerIdFromUrl) {
          finalResellerId = resellerIdFromUrl;
        } else {
          // Try to get resellerId from domain (server allows localhost when DEFAULT_RESELLER_ID_FOR_LOCALHOST is set)
          const domain = window.location.hostname;

          try {
            // Call API to get resellerId by domain
            const API_BASE_URL = getApiBaseUrl();

            const response = await fetch(
              `${API_BASE_URL}/reseller/by-domain?domain=${encodeURIComponent(
                domain
              )}`
            );

            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data) {
                finalResellerId = result.data.resellerId;
                setMaintenanceMode(result.data.maintenanceMode === true);
              } else {
                setError(result.message || "Domain not found or not approved");
                setLoading(false);
                return;
              }
            } else {
              const errorData = await response.json();
              setError(errorData.message || "Failed to resolve domain");
              setLoading(false);
              return;
            }
          } catch (apiError) {
            console.error("Error fetching reseller by domain:", apiError);
            setError("Failed to resolve domain. Please contact support.");
            setLoading(false);
            return;
          }
        }

        // Fetch reseller data
        if (finalResellerId) {
          setResellerId(finalResellerId);
          // If resellerId came from domain (not URL), navigate to /clienthub/:resellerId so refresh works (admin build)
          if (!resellerIdFromUrl && !isClientHubBuild) {
            navigate(`/clienthub/${finalResellerId}`, { replace: true });
          }
          const result = await getMstResellerById(finalResellerId);
          if (result.success && result.data) {
            setResellerData(result.data);
          } else {
            setError(result.message || "Reseller not found");
          }
        } else {
          setError("Reseller ID or domain is required");
        }
      } catch (err: any) {
        console.error("Failed to fetch reseller data:", err);
        setError(
          err.message || "An error occurred while loading reseller information"
        );
      } finally {
        setLoading(false);
      }
    };

    determineResellerId();
  }, [resellerIdFromUrl, resellerIdProp, navigate]);

  // Restore progress from sessionStorage + URL when resellerId is ready
  useEffect(() => {
    if (!resellerId || loading || progressRestored || isAdminMode) return;
    const urlStep = searchParams.get("step");
    const stored = loadProgress(resellerId);
    const urlStepNum = urlStep ? parseInt(urlStep, 10) : NaN;
    const validUrlStep = !isNaN(urlStepNum) && urlStepNum >= 1 && urlStepNum <= 11;
    const stepToUse = validUrlStep ? urlStepNum : stored?.step;
    const formToUse = stored?.formData;
    if (stepToUse != null && stepToUse >= 1 && stepToUse <= 11) {
      setStep(stepToUse);
      if (!validUrlStep && urlStep === null && !isClientHubBuild) {
        setSearchParams((p) => {
          const next = new URLSearchParams(p);
          next.set("step", String(stepToUse));
          return next;
        }, { replace: true });
      }
    }
    if (formToUse && typeof formToUse === "object") {
      setFormData((prev: any) => ({
        ...prev,
        ...formToUse,
        password: prev.password || "", // Never restore password
      }));
    }
    setProgressRestored(true);
  }, [resellerId, loading, progressRestored, isAdminMode, searchParams, setSearchParams]);

  // Persist progress on step/formData changes
  useEffect(() => {
    if (!resellerId || !progressRestored || step === 11) return;
    saveProgress(resellerId, step, formData);
    if (!isClientHubBuild) {
      setSearchParams((p) => {
        const next = new URLSearchParams(p);
        next.set("step", String(step));
        return next;
      }, { replace: true });
    }
  }, [resellerId, step, formData, progressRestored, setSearchParams]);

  // Clear progress on completion (step 11)
  useEffect(() => {
    if (resellerId && step === 11) {
      clearProgress(resellerId);
      if (!isClientHubBuild) {
        setSearchParams((p) => {
          const next = new URLSearchParams(p);
          next.delete("step");
          return next;
        }, { replace: true });
      }
    }
  }, [resellerId, step, setSearchParams]);

  const handleStepChange = useCallback((newStep: number) => {
    setStep(newStep);
  }, []);

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
    handleStepChange(8);
  };

  const handleStep8Success = (data: any) => {
    setFormData((prev: any) => ({ ...prev, gstData: data }));
    handleStepChange(9);
  };

  const handleStep9Success = async (data: any) => {
    // Save only signature image filename to database (no full path)
    if (data.signatureFilename && formData.email) {
      try {
        const { updateCustomerSignature } = await import("@/hasura/mutations/customer");
        await updateCustomerSignature({
          email: formData.email,
          signatureImage: data.signatureFilename,
        });
      } catch (err) {
        console.error("Failed to save signature:", err);
      }
    }
    setFormData((prev: any) => ({ ...prev, signature: data }));
    handleStepChange(10);
  };

  const handleStep10Success = () => {
    handleStepChange(11);
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

  if (error || !resellerId) {
    return (
      <section className="auth bg-base d-flex flex-wrap">
        <div className="auth-right py-32 px-24 d-flex flex-column justify-content-center w-100">
          <div className="max-w-464-px mx-auto w-100 text-center">
            <div className="alert alert-danger">
              <h5>Access Error</h5>
              <p>{error || "Reseller information not found"}</p>
              <p className="text-sm text-muted mt-2">
                Please ensure you're accessing this page through the correct
                domain or contact support.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const imageBasePath = (import.meta as any).env?.VITE_IMAGE_BASE_PATH || "http://localhost:3001/uploads";
  const resellerLogoUrl = resellerData?.logo
    ? (resellerData.logo.startsWith("data:") || resellerData.logo.startsWith("http")
        ? resellerData.logo
        : `${imageBasePath}/logos/${resellerData.logo}`)
    : null;
  const resellerLogoAlt = resellerData?.brand_name || resellerData?.business_name || "Logo";

  return (
    <section className="auth bg-base d-flex flex-wrap">
      {/* LEFT: reseller logo when available, else default illustration */}
      <div className="auth-left d-lg-block d-none">
        <div className="d-flex align-items-center flex-column h-100 justify-content-center">
          {resellerLogoUrl ? (
            <img
              src={resellerLogoUrl}
              alt={resellerLogoAlt}
              style={{ maxWidth: "100%", maxHeight: "280px", objectFit: "contain" }}
              onError={(e: any) => {
                e.currentTarget.src = "assets/images/own/login.svg";
                e.currentTarget.alt = "Onboarding";
              }}
            />
          ) : (
            <img src="assets/images/own/login.svg" alt="Onboarding" />
          )}
        </div>
      </div>

      {/* RIGHT */}
      <div className="auth-right py-32 px-24 d-flex flex-column justify-content-center">
        <div className="max-w-464-px mx-auto w-100">
          {/* LOGO & BRAND */}
          <div className="mb-40">
            <Link to="/index" className="max-w-290-px d-block">
              {resellerLogoUrl ? (
                <img
                  src={resellerLogoUrl}
                  alt={resellerLogoAlt}
                  style={{ maxHeight: "60px", objectFit: "contain" }}
                  onError={(e: any) => {
                    e.target.src = "assets/images/own/dlogo.png";
                  }}
                />
              ) : (
                <img src="assets/images/own/dlogo.png" alt="Logo" />
              )}
            </Link>
            {resellerData?.brand_name && (
              <h5 className="mt-12 text-primary-light fw-bold">
                {resellerData.brand_name}
              </h5>
            )}
          </div>

          {maintenanceMode && (
            <div className="alert alert-info mb-16" role="alert">
              The site is currently in maintenance mode. Some features may be limited.
            </div>
          )}

          {/* STEP INDICATOR (steps 1-6,8,9,10,11 = 10 total; step 7 removed) */}
          {(() => {
            const displayStep = step <= 6 ? step : step - 1;
            const totalSteps = 10;
            return (
              <p className="text-sm text-secondary-light mb-16">
                Step {displayStep} of {totalSteps}
              </p>
            );
          })()}

          {/* STEP 1: Login or Sign Up */}
          {step === 1 && resellerId && (
            <Step1
              resellerId={resellerId}
              brandName={resellerData?.brand_name || resellerData?.business_name}
              allowExistingCustomer={resellerData?.allow_existing_customer === true}
              resellerEmail={resellerData?.email}
              resellerPhone={resellerData?.phone}
              onSignUp={() => handleStepChange(2)}
              onLogin={() => {
                // Login handled in Step1 component
                // This callback can be used for any post-login actions if needed
                // No need to log here as login is handled in Step1
              }}
            />
          )}

          {/* STEP 2: Form 1 - Business Email, Mobile, Password */}
          {step === 2 && resellerId && (
            <Step2
              resellerId={resellerId}
              allowExistingCustomer={resellerData?.allow_existing_customer === true}
              onBack={() => handleStepChange(1)}
              onSuccess={handleStep2FormSuccess}
            />
          )}

          {/* STEP 3: Email OTP Verification */}
          {step === 3 && (
            <Step3
              email={formData.email}
              skipOtpVerification={skipOtpVerification}
              onBack={() => handleStepChange(2)}
              onVerify={handleStep3Verify}
            />
          )}

          {/* STEP 4: Phone/WhatsApp OTP Verification */}
          {step === 4 && (
            <Step4
              phone={formData.phone}
              skipOtpVerification={skipOtpVerification}
              onBack={() => handleStepChange(3)}
              onVerify={handleStep4Verify}
            />
          )}

          {/* STEP 5: PAN Card Verification */}
          {step === 5 && (
            <Step5
              email={formData.email}
              skipOtpVerification={skipOtpVerification}
              onBack={() => handleStepChange(4)}
              onSubmit={handleStep5Success}
            />
          )}

          {/* STEP 6: Aadhaar Verification */}
          {step === 6 && (
            <Step6
              email={formData.email}
              skipOtpVerification={skipOtpVerification}
              onBack={() => handleStepChange(5)}
              onSubmit={handleStep6Success}
            />
          )}

          {/* STEP 8: GST Verification (Optional) */}
          {step === 8 && (
            <Step8
              email={formData.email}
              onBack={() => handleStepChange(6)}
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
          {step === 10 && resellerId && (
            <Step10
              formData={formData}
              resellerId={resellerId}
              onBack={() => handleStepChange(9)}
              onSubmit={handleStep10Success}
            />
          )}

          {/* STEP 11: Success Screen */}
          {step === 11 && (
            <Step11
              resellerName={
                resellerData?.brand_name ||
                resellerData?.business_name ||
                `${resellerData?.first_name || ""} ${
                  resellerData?.last_name || ""
                }`.trim() ||
                "Admin"
              }
            />
          )}

          {/* FOOTER */}
          {step === 1 && !skipOtpVerification && (
            <div className="mt-32 text-center text-sm">
              <p> 
                <button
                  onClick={() => navigate("/sign-in")}
                  className="text-primary-600 fw-semibold border-0 bg-transparent p-0"
                  style={{ textDecoration: 'underline', cursor: 'pointer' }}
                >
                  Login as Admin
                </button>
              </p>
            </div>
          )}

          {cmsPages.length > 0 && (
            <div className="mt-24 text-center">
              <div className="d-flex flex-wrap justify-content-center gap-3">
                {cmsPages.map((page: any) => (
                  <Link
                    key={page.id}
                    to={`/page/${page.slug}?reseller_id=${resellerId}`}
                    className="text-sm text-secondary-light text-decoration-none"
                  >
                    {page.page_title}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <p className="mt-32 text-center text-sm text-secondary-light mb-0">
            2026 © {resellerData?.brand_name || resellerData?.business_name || "Client Hub"}. All Rights Reserved.
          </p>
        </div>
      </div>
    </section>
  );
};

export default ClientHubLayer;
