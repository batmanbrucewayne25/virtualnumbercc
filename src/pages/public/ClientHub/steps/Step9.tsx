import { useRef, useState } from "react";

interface Step9Props {
  email: string;
  onBack: () => void;
  onSubmit: (data: { signatureHash: string; signatureMetadata: any }) => void;
}

const Step9 = ({ email, onBack, onSubmit }: Step9Props) => {
  const [signature, setSignature] = useState<string>("");
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please upload a valid signature image file.");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setError("Signature image size should be less than 2MB.");
        return;
      }
      setSignatureFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setSignature(event.target?.result as string);
        setError("");
      };
      reader.readAsDataURL(file);
    }
  };

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
      setError("Please upload your digital signature.");
      return;
    }

    if (!signatureFile) {
      setError("Signature file is required.");
      return;
    }

    setLoading(true);
    try {
      // Generate hash from signature data
      const signatureHash = await generateHash(signature);

      // Create metadata
      const signatureMetadata = {
        fileName: signatureFile.name,
        fileSize: signatureFile.size,
        fileType: signatureFile.type,
        uploadedAt: new Date().toISOString(),
        email: email,
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
        Please upload your digital signature. This will be stored securely as a hash with metadata.
      </p>

      <div className="mb-24">
        <div className="d-flex align-items-center gap-12">
          {signature ? (
            <div
              className="border radius-8 overflow-hidden"
              style={{ width: "200px", height: "80px", flexShrink: 0 }}
            >
              <img
                src={signature}
                alt="Signature Preview"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>
          ) : (
            <div
              className="border border-secondary-light radius-8 bg-light d-flex align-items-center justify-content-center"
              style={{ width: "200px", height: "80px", flexShrink: 0 }}
            >
              <span className="text-secondary-light text-xs">No signature</span>
            </div>
          )}
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => signatureInputRef.current?.click()}
          >
            {signature ? "Change" : "Upload"} Signature
          </button>
          <input
            ref={signatureInputRef}
            type="file"
            accept="image/*"
            onChange={handleSignatureUpload}
            style={{ display: "none" }}
          />
        </div>
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

