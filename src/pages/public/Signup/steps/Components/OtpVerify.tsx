import { useState } from "react";

type OtpVerifyProps = {
    title: string;
    label: string;
    onBack: () => void;
    onVerify: () => Promise<void>;
};

const STATIC_OTP = "1234";

const OtpVerify = ({ title, label, onBack, onVerify }: OtpVerifyProps) => {
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleVerify = async () => {
        setError("");

        if (!otp) {
            setError("Please enter OTP.");
            return;
        }

        if (otp !== STATIC_OTP) {
            setError(`Invalid ${label} OTP. Use 1234 for testing.`);
            return;
        }

        setLoading(true);
        try {
            await onVerify();
        } catch {
            setError("OTP verification failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <h4 className="mb-12">{title}</h4>

            {error && <div className="alert alert-danger mb-12">{error}</div>}

            <p className="text-xs text-secondary-light mb-12">Test OTP: 1234</p>

            <label className="text-sm mb-8">{label} OTP</label>
            <input
                className="form-control h-56-px mb-24"
                placeholder={`Enter ${label} OTP`}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
            />

            <button 
                type="button"
                className="btn btn-outline-secondary w-100 mb-12" 
                onClick={(e) => {
                    e.preventDefault();
                    onBack();
                }}
            >
                Back
            </button>

            <button 
                type="button"
                className="btn btn-primary w-100" 
                onClick={(e) => {
                    e.preventDefault();
                    handleVerify();
                }}
                disabled={loading}
            >
                {loading ? "Please wait..." : "Verify & Continue"}
            </button>
        </>
    );
};
export default OtpVerify;