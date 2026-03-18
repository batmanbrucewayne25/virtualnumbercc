/**
 * Production-grade signature image component.
 * - Uses shared URL resolution (relative path for reliability)
 * - Falls back to API proxy URL on load error
 * - Graceful error state with user-friendly message
 */
import { useState, useCallback } from "react";
import {
  getSignatureImageUrl,
  getSignatureImageApiUrl,
} from "@/utils/signatureImageUrl";

const SignatureImage = ({
  signatureValue,
  alt = "Digital Signature",
  className = "rounded border",
  style = {
    maxWidth: "100%",
    maxHeight: "200px",
    objectFit: "contain",
    cursor: "pointer",
    display: "block",
    backgroundColor: "#fff",
  },
  onClick,
  "data-testid": dataTestId,
}) => {
  const [errorState, setErrorState] = useState("none"); // "none" | "tried_fallback" | "failed"

  const primaryUrl = getSignatureImageUrl(signatureValue);
  const apiFallbackUrl = getSignatureImageApiUrl(signatureValue);

  const handleError = useCallback(() => {
    if (errorState === "none" && apiFallbackUrl) {
      setErrorState("tried_fallback");
    } else {
      setErrorState("failed");
    }
  }, [errorState, apiFallbackUrl]);

  if (
    !signatureValue ||
    typeof signatureValue !== "string" ||
    !signatureValue.trim()
  ) {
    return (
      <div className="text-sm text-secondary-light">No signature available</div>
    );
  }

  const src = errorState === "tried_fallback" ? apiFallbackUrl : primaryUrl;
  if (!src) {
    return (
      <div className="alert alert-warning mb-0">Invalid signature data</div>
    );
  }

  return (
    <div>
      {errorState !== "failed" && (
        <img
          key={src}
          src={src}
          alt={alt}
          className={className}
          style={style}
          onError={handleError}
          onClick={onClick}
          data-testid={dataTestId}
          title={onClick ? "Click to view full size" : undefined}
        />
      )}
      {errorState === "failed" && (
        <div className="alert alert-warning mb-0" role="alert">
          Failed to load signature image
        </div>
      )}
    </div>
  );
};

export default SignatureImage;
