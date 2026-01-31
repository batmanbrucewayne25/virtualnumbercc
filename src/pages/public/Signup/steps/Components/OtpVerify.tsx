import { useState, useEffect } from "react";
import { getApiBaseUrl } from "@/utils/apiUrl";

type OtpVerifyProps = {
    title: string;
    label: string;
    email?: string;
    phone?: string;
    onBack: () => void;
    onVerify: () => Promise<void>;
};

const OtpVerify = ({ title, label, email, phone, onBack, onVerify }: OtpVerifyProps) => {
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [countdown, setCountdown] = useState(0);

    // Auto-send OTP on component mount
    useEffect(() => {
        sendOTP();
    }, []);

    // Countdown timer
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const sendOTP = async () => {
        setSending(true);
        setError("");
        setSuccess("");

        try {
            const API_BASE_URL = getApiBaseUrl();
            const endpoint = label.toLowerCase() === 'email' 
                ? `${API_BASE_URL}/otp/send-email`
                : `${API_BASE_URL}/otp/send-phone`;
            
            const payload = label.toLowerCase() === 'email' 
                ? { email }
                : { phone };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (result.success) {
                setSuccess(result.message || 'OTP sent successfully!');
                setOtpSent(true);
                setCountdown(60); // 60 seconds countdown
                setTimeout(() => setSuccess(""), 3000);
            } else {
                setError(result.message || 'Failed to send OTP. Please try again.');
            }
        } catch (err: any) {
            console.error('Error sending OTP:', err);
            setError('Failed to send OTP. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const handleVerify = async () => {
        setError("");

        if (!otp) {
            setError("Please enter OTP.");
            return;
        }

        if (otp.length !== 6) {
            setError("OTP must be 6 digits.");
            return;
        }

        setLoading(true);
        try {
            const API_BASE_URL = getApiBaseUrl();
            const endpoint = label.toLowerCase() === 'email'
                ? `${API_BASE_URL}/otp/verify-email`
                : `${API_BASE_URL}/otp/verify-phone`;
            
            const payload = label.toLowerCase() === 'email'
                ? { email, otp }
                : { phone, otp };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (result.success) {
                await onVerify();
            } else {
                setError(result.message || 'Invalid OTP. Please try again.');
            }
        } catch (err: any) {
            console.error('Error verifying OTP:', err);
            setError('OTP verification failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <h4 className="mb-12">{title}</h4>

            {error && <div className="alert alert-danger mb-12">{error}</div>}
            {success && <div className="alert alert-success mb-12">{success}</div>}

            <div className="mb-12">
                <p className="text-xs text-secondary-light mb-8">
                    {label === 'Email' 
                        ? `OTP has been sent to ${email}` 
                        : `OTP has been sent to ${phone} via WhatsApp`}
                </p>
                {!otpSent && (
                    <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-primary-600"
                        onClick={sendOTP}
                        disabled={sending}
                    >
                        {sending ? 'Sending...' : 'Resend OTP'}
                    </button>
                )}
                {otpSent && countdown > 0 && (
                    <p className="text-xs text-secondary-light">
                        Resend OTP in {countdown} seconds
                    </p>
                )}
                {otpSent && countdown === 0 && (
                    <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-primary-600"
                        onClick={sendOTP}
                        disabled={sending}
                    >
                        {sending ? 'Sending...' : 'Resend OTP'}
                    </button>
                )}
            </div>

            <label className="text-sm mb-8">{label} OTP</label>
            <input
                className="form-control h-56-px mb-24"
                placeholder={`Enter 6-digit ${label} OTP`}
                value={otp}
                onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtp(value);
                    setError("");
                }}
                maxLength={6}
                disabled={loading}
            />

            <button 
                type="button"
                className="btn btn-outline-secondary w-100 mb-12" 
                onClick={(e) => {
                    e.preventDefault();
                    onBack();
                }}
                disabled={loading || sending}
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
                disabled={loading || !otp || otp.length !== 6}
            >
                {loading ? "Verifying..." : "Verify & Continue"}
            </button>
        </>
    );
};
export default OtpVerify;