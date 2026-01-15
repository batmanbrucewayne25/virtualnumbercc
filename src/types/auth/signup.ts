// Common Auth Types
export interface StepCallback {
    (): void;
}

export interface Step1SuccessData {
    email: string;
}

export interface Step1Props {
    onSuccess: (data: Step1SuccessData) => void;
}

export interface BaseStepProps {
    email: string;
    onBack: StepCallback;
    [key: string]: string | StepCallback;
}

export type Step2Props = BaseStepProps & { onVerify: StepCallback };
export type Step3Props = BaseStepProps & { onSubmit: StepCallback };
export type Step4Props = BaseStepProps & { onSubmit: StepCallback };
export type Step5Props = BaseStepProps & { onContinue: StepCallback };
export type Step6Props = BaseStepProps & { onSubmit: StepCallback };

export interface SignupFormData {
    email: string;
    step: number;
    showSuccess: boolean;
}

export interface OtpVerificationData {
    emailOtp: string;
    phoneOtp: string;
}

export interface PanVerificationData {
    panNumber: string;
    panOtp: string;
}

export interface AadhaarVerificationData {
    aadhaarNumber: string;
    aadhaarOtp: string;
}

export interface GstVerificationData {
    gstNumber: string;
}

export interface KycPreviewData {
    profileImage: string;
    address: string[];
    acceptedTerms: boolean;
}

export type SignupState = {
    step: number;
    email: string;
    showSuccess: boolean;
};
