import { useState } from "react";
import SignaturePad from "@/components/SignaturePad";
import { getAuthToken } from "@/utils/auth";

interface Step9Props {
  email: string;
  onBack: () => void;
  onSubmit: (data: { signatureFilename: string }) => void;
}

const Step9 = ({ email, onBack, onSubmit }: Step9Props) => {
  const [signature, setSignature] = useState<string>("");
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signatureUploaded, setSignatureUploaded] = useState<boolean>(false);
  const [uploadingSignature, setUploadingSignature] = useState<boolean>(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Convert data URL to File
  const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  // Upload signature function
  const handleUploadSignature = async () => {
    if (!signatureFile) {
      setError("Please draw your signature first.");
      return;
    }

    setError("");
    setUploadingSignature(true);

    try {
      const token = getAuthToken();
      const { getApiBaseUrl } = await import("@/utils/apiUrl");
      const API_BASE_URL = getApiBaseUrl();
      const IMAGE_UPLOAD_PATH = (import.meta as any).env?.VITE_IMAGE_UPLOAD_PATH || 'http://localhost:3001/uploads';

      // Create FormData
      const signatureFormData = new FormData();
      signatureFormData.append('signature', signatureFile);

      // Prepare headers
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const uploadUrl = `${API_BASE_URL}/upload/signature`;
      console.log("Uploading signature:", uploadUrl);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: headers,
        body: signatureFormData,
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.filename) {
          // Store only the filename (not the full URL) to send to GraphQL
          const filename = result.data.filename;
          console.log("✅ Signature uploaded successfully");
          console.log("Filename from server:", filename);
          // Store filename for GraphQL
          setSignature(filename);
          setSignatureUploaded(true);
          setError("");
        } else {
          setError(result.message || "Failed to upload signature");
        }
      } else {
        const errorText = await response.text();
        setError(`Failed to upload signature: ${response.status}`);
        console.error("Upload failed:", errorText);
      }
    } catch (uploadErr: any) {
      console.error("Signature upload error:", uploadErr);
      setError(uploadErr.message || "Failed to upload signature");
    } finally {
      setUploadingSignature(false);
    }
  };

  const handleSubmit = async () => {
    setError("");

    if (!signature) {
      setError("Please draw your digital signature.");
      return;
    }

    if (!signatureUploaded) {
      setError("Please upload your signature first.");
      return;
    }

    setLoading(true);
    try {
      // Submit with filename
      onSubmit({
        signatureFilename: signature,
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
        Please sign in the box below using your mouse or touch screen. Your signature will be uploaded to the server.
      </p>

      <div className="mb-24">
        <SignaturePad
          onSignatureChange={(signatureDataUrl) => {
            if (signatureDataUrl) {
              setSignature(signatureDataUrl);
              // Convert data URL to File
              const file = dataURLtoFile(signatureDataUrl, `signature-${Date.now()}.png`);
              setSignatureFile(file);
              setSignatureUploaded(false); // Reset upload status when signature changes
              setError("");
            } else {
              setSignature("");
              setSignatureFile(null);
              setSignatureUploaded(false);
            }
          }}
          width={600}
          height={200}
          penColor="#000000"
          backgroundColor="#ffffff"
        />
        {signature && !signatureUploaded && (
          <div className="mt-12">
            <small className="text-info">✓ Signature captured. Please upload it.</small>
          </div>
        )}
        {signatureUploaded && (
          <div className="mt-12">
            <small className="text-success">✓ Signature uploaded successfully</small>
          </div>
        )}
      </div>

      {signature && !signatureUploaded && (
        <button
          type="button"
          className="btn btn-outline-primary w-100 radius-12 mb-16"
          onClick={handleUploadSignature}
          disabled={uploadingSignature}
        >
          {uploadingSignature ? "Uploading..." : "Upload Signature"}
        </button>
      )}

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
        disabled={!signature || !signatureUploaded || loading}
      >
        {loading ? "Processing..." : "Submit & Continue"}
      </button>
    </>
  );
};

export default Step9;

