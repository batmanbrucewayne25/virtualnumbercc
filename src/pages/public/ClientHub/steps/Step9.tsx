import { useState } from "react";
import SignaturePad from "@/components/SignaturePad";

interface Step9Props {
  email: string;
  onBack: () => void;
  onSubmit: (data: { signatureHash: string; signatureMetadata: any }) => void;
}

const Step9 = ({ email, onBack, onSubmit }: Step9Props) => {
  const [signature, setSignature] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const generateHash = async (data: string): Promise<string> => {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return hashHex;
  };

  const handleSubmit = async () => {
    setError("");

    if (!signature) {
      setError("Please draw your digital signature.");
      return;
    }

    setLoading(true);
    try {
      // Generate hash from signature data URL
      const signatureHash = await generateHash(signature);

      // Create metadata
      const signatureMetadata = {
        source: "signature_pad",
        createdAt: new Date().toISOString(),
        email: email,
        format: "image/png",
      };

      onSubmit({
        signatureHash,
        signatureMetadata,
      });
    } catch (err) {
      console.error("Error processing signature:", err);
      setError("Failed to process signature. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h4 className="mb-12">Digital Signature</h4>

      {error && <div className="alert alert-danger mb-12">{error}</div>}

      <p className="text-sm text-secondary-light mb-16">
        Please sign in the box below using your mouse or touch screen. This will be stored securely as a hash with metadata.
      </p>

      <div className="mb-24">
        <SignaturePad
          onSignatureChange={(signatureDataUrl) => {
            setSignature(signatureDataUrl || "");
            setError("");
          }}
          width={600}
          height={200}
          penColor="#000000"
          backgroundColor="#ffffff"
        />
        {signature && (
          <div className="mt-12">
            <small className="text-success">✓ Signature captured successfully</small>
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn btn-outline-secondary w-100 radius-12 mb-12"
        onClick={onBack}
        disabled={loading}
      >
        Back
      </button>

      <button
        type="button"
        className="btn btn-primary w-100 radius-12"
        onClick={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        disabled={!signature || loading}
      >
        {loading ? "Processing..." : "Submit & Continue"}
      </button>
    </>
  );
};

export default Step9;

