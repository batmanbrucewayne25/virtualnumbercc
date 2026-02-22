import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getMstResellerByEmail } from "@/hasura/mutations";

interface UseStepValidationOptions {
  email: string;
  currentStep: number; // The step number this component represents (e.g., 2, 3, 4, etc.)
}

interface UserData {
  current_step?: number;
  signup_completed?: boolean;
}

/**
 * Custom hook to validate step access based on user's current_step
 * 
 * Validation Rules:
 * - If current_step = 3, user can access steps 1-4 (maxAllowedStep = 4)
 * - If user tries to access step > maxAllowedStep, redirects to maxAllowedStep
 * - Updates URL parameter to reflect corrected step
 * 
 * @param options - { email: string, currentStep: number }
 * @returns { isValid: boolean, loading: boolean, userData: UserData | null }
 */
export const useStepValidation = ({ email, currentStep }: UseStepValidationOptions) => {
  console.log("useStepValidation called", email, currentStep);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isValid, setIsValid] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    const validateStep = async () => {
      if (!email) {
        // No email, allow access (new signup)
        setIsValid(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Fetch user data to get current_step from database
        const result = await getMstResellerByEmail({ email });
console.log(result);
        if (result?.data?.mst_reseller?.length > 0) {
          const user = result.data.mst_reseller[0];
          setUserData({
            current_step: user.current_step,
            signup_completed: user.signup_completed,
          });

        
          // Get current_step from database
          const userCurrentStep = user.current_step || 0;
          const maxAllowedStep = userCurrentStep + 1;
console.log(maxAllowedStep, userCurrentStep);
          // Validate requested step
          if (currentStep > maxAllowedStep) {
            // BLOCK access - step exceeds max allowed
            console.log(
              `⚠️  Step ${currentStep} exceeds max allowed ${maxAllowedStep} for current_step ${userCurrentStep}. Redirecting...`
            );
            
            // Redirect to max allowed step
            navigate(`/sign-up?step=${maxAllowedStep}`, { replace: true });
            setIsValid(false);
          } else if (currentStep >= 1 && currentStep <= maxAllowedStep) {
            // ALLOW access - step is within allowed range
            setIsValid(true);
            // Update URL to reflect current step if needed
            const currentStepParam = searchParams.get("step");
            if (currentStepParam !== currentStep.toString()) {
              setSearchParams({ step: currentStep.toString() }, { replace: true });
            }
          } else {
            // Invalid step, redirect to step 1
            navigate("/sign-up?step=1", { replace: true });
            setIsValid(false);
          }
        } else {
          // User not found, allow access (new signup)
          setIsValid(true);
        }
      } catch (err) {
        console.error("Failed to validate step:", err);
        // On error, allow access to prevent blocking legitimate users
        setIsValid(true);
      } finally {
        setLoading(false);
      }
    };

    validateStep();
  }, [email, currentStep, searchParams, setSearchParams, navigate]);

  return { isValid, loading, userData };
};

