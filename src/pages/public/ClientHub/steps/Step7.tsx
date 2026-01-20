import { useState } from "react";

interface Step7Props {
  panData: any;
  aadhaarData: any;
  onBack: () => void;
  onSuccess: () => void;
}

const Step7 = ({ panData, aadhaarData, onBack, onSuccess }: Step7Props) => {
  const [error, setError] = useState("");

  const normalizeDate = (dateStr: string): string | null => {
    if (!dateStr) return null;
    
    // Remove any extra whitespace
    const cleaned = dateStr.trim();
    
    // Handle different date formats
    // Format 1: DD-MM-YYYY (e.g., "16-04-1992")
    // Format 2: YYYY-MM-DD (e.g., "1992-04-16")
    // Format 3: DD/MM/YYYY (e.g., "16/04/1992")
    // Format 4: YYYY/MM/DD (e.g., "1992/04/16")
    // Format 5: ISO string or other formats
    
    // Try to parse as DD-MM-YYYY or DD/MM/YYYY
    const ddmmyyyyMatch = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (ddmmyyyyMatch) {
      const day = ddmmyyyyMatch[1].padStart(2, '0');
      const month = ddmmyyyyMatch[2].padStart(2, '0');
      const year = ddmmyyyyMatch[3];
      return `${year}-${month}-${day}`; // Convert to YYYY-MM-DD
    }
    
    // Try to parse as YYYY-MM-DD or YYYY/MM/DD
    const yyyymmddMatch = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (yyyymmddMatch) {
      const year = yyyymmddMatch[1];
      const month = yyyymmddMatch[2].padStart(2, '0');
      const day = yyyymmddMatch[3].padStart(2, '0');
      return `${year}-${month}-${day}`; // Already in YYYY-MM-DD
    }
    
    // Try standard Date parsing for other formats
    try {
      const date = new Date(cleaned);
      if (!isNaN(date.getTime())) {
        // Check if date is valid (not invalid date)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {
      // If parsing fails, return null
    }
    
    return null;
  };

  const compareDates = (date1: string, date2: string): boolean => {
    const d1 = normalizeDate(date1);
    const d2 = normalizeDate(date2);
    
    if (!d1 || !d2) {
      // If either date cannot be normalized, do a direct string comparison
      return date1 === date2;
    }
    
    return d1 === d2;
  };

  const handleContinue = () => {
    setError("");

    if (!panData || !aadhaarData) {
      setError("PAN and Aadhaar data are required.");
      return;
    }

    const panDob = panData.dob;
    const aadhaarDob = aadhaarData.dob;

    if (!panDob || !aadhaarDob) {
      setError("Date of birth is missing in PAN or Aadhaar data.");
      return;
    }

    if (!compareDates(panDob, aadhaarDob)) {
      setError(
        "Date of birth mismatch! Please verify that the date of birth in your PAN card and Aadhaar card are the same. If they differ, please correct the documents and try again."
      );
      return;
    }

    // Dates match, proceed
    onSuccess();
  };

  return (
    <>
      <h4 className="mb-12">Date of Birth Verification</h4>

      {error && <div className="alert alert-danger mb-12">{error}</div>}

      <div className="alert alert-info mb-16">
        <p className="mb-8"><strong>PAN Card DOB:</strong> {panData?.dob || "N/A"}</p>
        <p className="mb-0"><strong>Aadhaar Card DOB:</strong> {aadhaarData?.dob || "N/A"}</p>
      </div>

      <p className="text-sm text-secondary-light mb-24">
        We need to verify that the date of birth in your PAN card matches your Aadhaar card.
      </p>

      <button
        type="button"
        className="btn btn-outline-secondary w-100 radius-12 mb-12"
        onClick={onBack}
      >
        Back
      </button>

      <button
        type="button"
        className="btn btn-primary w-100 radius-12"
        onClick={(e) => {
          e.preventDefault();
          handleContinue();
        }}
      >
        Continue
      </button>
    </>
  );
};

export default Step7;

