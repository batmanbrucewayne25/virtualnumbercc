import { useEffect, useState } from "react";
import { getMstResellerByEmail } from "@/hasura/mutations";
import { getAddressDisplayLines } from "@/utils/addressDisplay.js";
import { buildLogoPublicUrl, buildUploadedAssetUrl } from "@/utils/resellerAssetUrl.js";

interface Step8Props {
  email: string;
  onBack: () => void;
  onConfirm: () => void;
  onOpenTermsModal?: () => void;
}

/** Mask PAN: first 4 + **** + last 2 */
const maskPan = (pan: string) => {
  if (!pan || pan.length < 6) return "****";
  return `${pan.slice(0, 4)}****${pan.slice(-2)}`;
};

/** Mask Aadhaar: XXXX-XXXX-last4 */
const maskAadhaar = (num: string) => {
  if (!num) return "N/A";
  const clean = num.replace(/\D/g, "");
  return `XXXX-XXXX-${clean.slice(-4)}`;
};

/** Format date to DD-MM-YYYY */
const formatDate = (dateStr: string) => {
  if (!dateStr) return "N/A";
  const trimmed = dateStr.trim();
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[3].padStart(2, "0")}-${m[2].padStart(2, "0")}-${m[1]}`;
  return trimmed;
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="d-flex justify-content-between align-items-start py-8 border-bottom">
    <span className="text-secondary-light text-sm" style={{ minWidth: 140 }}>
      {label}
    </span>
    <span className="fw-medium text-sm text-end">{value || "—"}</span>
  </div>
);

const SectionCard = ({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: "success" | "warning";
  children: React.ReactNode;
}) => (
  <div className="card border radius-12 mb-16 overflow-hidden">
    <div
      className={`card-header d-flex align-items-center gap-8 py-10 px-16 ${
        badge === "success"
          ? "bg-success-focus"
          : badge === "warning"
          ? "bg-warning-focus"
          : "bg-neutral-100"
      }`}
    >
      {badge === "success" && (
        <span className="text-success fw-bold" style={{ fontSize: 16 }}>
          ✓
        </span>
      )}
      <h6 className="mb-0 fw-semibold text-sm">{title}</h6>
    </div>
    <div className="card-body px-16 py-4">{children}</div>
  </div>
);

const Step8 = ({
  email,
  onBack,
  onConfirm,
  onOpenTermsModal,
}: Step8Props) => {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await getMstResellerByEmail({ email });
        if (result?.mst_reseller?.[0]) {
          setUserData(result.mst_reseller[0]);
        } else {
          setError("Could not load your details. Please go back and try again.");
        }
      } catch (err: any) {
        console.error("[Step8] Failed to fetch reseller data:", err);
        setError("Failed to load details. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    if (email) {
      fetchData();
    } else {
      setError("Email not found. Please go back and try again.");
      setLoading(false);
    }
  }, [email]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  /** Same segment order as Step7 `formatAddressDisplayMultiline` (see addressDisplay.js). */
  const getAddress = () => {
    if (!userData) return "N/A";
    if (userData.address != null && userData.address !== "") {
      const lines = getAddressDisplayLines(userData.address);
      const oneLine = lines.join(", ").trim();
      if (oneLine) return oneLine;
    }
    return userData.business_address || "N/A";
  };

  if (loading) {
    return (
      <div className="text-center py-40">
        <div className="spinner-border text-primary" role="status" />
        <p className="mt-12 text-secondary-light">Loading your details…</p>
      </div>
    );
  }

  if (error || !userData) {
    return (
      <div>
        <div className="alert alert-danger">{error || "No data found."}</div>
        <button className="btn btn-outline-secondary w-100" onClick={onBack}>
          Back
        </button>
      </div>
    );
  }

  const logoUrl = buildLogoPublicUrl(userData.logo);

  const signatureUrl = userData.signatureImage
    ? buildUploadedAssetUrl(userData.signatureImage, "signatures")
    : null;

  const profilePhotoUrl = userData.aadhar_photo
    ? userData.aadhar_photo.startsWith("data:")
      ? userData.aadhar_photo
      : `data:image/jpeg;base64,${userData.aadhar_photo}`
    : null;

  return (
    <>
      <h4 className="mb-4 fw-bold">Review &amp; Confirm</h4>
      <p className="text-secondary-light text-sm mb-20">
        Please review all your details carefully before confirming your account.
      </p>

      {/* ── Personal Information ── */}
      <SectionCard title="Personal Information">
        <Row label="Full Name" value={`${userData.first_name || ""} ${userData.last_name || ""}`.trim()} />
        <Row label="Email" value={userData.email} />
        <Row label="Phone" value={userData.phone} />
        <Row label="Gender" value={userData.gender} />
        <Row label="Date of Birth" value={formatDate(userData.dob || userData.pan_dob)} />
        <Row label="Address" value={getAddress()} />
        {profilePhotoUrl && (
          <div className="py-8">
            <span className="text-secondary-light text-sm d-block mb-8">Aadhaar Photo</span>
            <img
              src={profilePhotoUrl}
              alt="Aadhaar photo"
              className="rounded border"
              style={{ width: 72, height: 72, objectFit: "cover" }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}
      </SectionCard>

      {/* ── PAN Card ── */}
      {userData.is_pan_verified && (
        <SectionCard title="PAN Card" badge="success">
          <Row label="PAN Number" value={maskPan(userData.pan_number)} />
          <Row label="Name on PAN" value={userData.pan_full_name} />
          <Row label="DOB (PAN)" value={formatDate(userData.pan_dob)} />
        </SectionCard>
      )}

      {/* ── Aadhaar ── */}
      {userData.is_aadhaar_verified && (
        <SectionCard title="Aadhaar Card" badge="success">
          <Row label="Aadhaar Number" value={maskAadhaar(userData.aadhaar_number)} />
          <Row label="DOB (Aadhaar)" value={formatDate(userData.dob)} />
          <Row label="Gender" value={userData.gender} />
        </SectionCard>
      )}

      {/* ── GST ── */}
      {userData.is_gst_verified && (
        <SectionCard title="GST Details" badge="success">
          <Row label="GSTIN" value={userData.gstin} />
          <Row label="Business Name" value={userData.business_name} />
          <Row label="Legal Name" value={userData.legal_name} />
          <Row label="Business Type" value={userData.constitution_of_business} />
          <Row label="GST Status" value={userData.gstin_status} />
          <Row label="Business Email" value={userData.business_email} />
          <Row label="Business Address" value={userData.business_address} />
        </SectionCard>
      )}

      {/* ── Brand & Logo ── */}
      <SectionCard title="Brand Details">
        <Row label="Brand Name" value={userData.brand_name} />
        {logoUrl ? (
          <div className="py-8">
            <span className="text-secondary-light text-sm d-block mb-8">Business Logo</span>
            <img
              src={logoUrl}
              alt="Business logo"
              className="rounded border bg-white"
              style={{ maxHeight: 72, maxWidth: 180, objectFit: "contain" }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        ) : (
          <Row label="Business Logo" value="Not uploaded" />
        )}
      </SectionCard>

      {/* ── Digital Signature ── */}
      <SectionCard title="Digital Signature" badge={signatureUrl ? "success" : "warning"}>
        {signatureUrl ? (
          <div className="py-8">
            <span className="text-secondary-light text-sm d-block mb-8">Signature</span>
            <img
              src={signatureUrl}
              alt="Digital signature"
              className="rounded border bg-white"
              style={{ maxHeight: 80, maxWidth: "100%", objectFit: "contain" }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        ) : (
          <Row label="Signature" value="Not uploaded" />
        )}
      </SectionCard>

      {/* ── Verification Status Summary ── */}
      <div className="card border radius-12 mb-20">
        <div className="card-header bg-neutral-100 py-10 px-16">
          <h6 className="mb-0 fw-semibold text-sm">Verification Status</h6>
        </div>
        <div className="card-body px-16 py-4">
          {[
            { label: "Email Verified", ok: userData.is_email_verified },
            { label: "Phone Verified", ok: userData.is_phone_verified },
            { label: "PAN Verified", ok: userData.is_pan_verified },
            { label: "Aadhaar Verified", ok: userData.is_aadhaar_verified },
            { label: "GST Verified", ok: userData.is_gst_verified },
          ].map(({ label, ok }) => (
            <div
              key={label}
              className="d-flex justify-content-between align-items-center py-8 border-bottom"
            >
              <span className="text-sm">{label}</span>
              <span
                className={`badge ${ok ? "bg-success-focus text-success" : "bg-danger-focus text-danger"}`}
                style={{ fontSize: 11 }}
              >
                {ok ? "✓ Verified" : "✗ Pending"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="alert alert-info mb-20 text-sm">
        By confirming, you agree that all the information provided is accurate and you accept the{" "}
        <button
          type="button"
          className="fw-semibold text-primary-600 text-decoration-underline border-0 bg-transparent p-0 align-baseline"
          style={{ cursor: "pointer" }}
          onClick={() => onOpenTermsModal?.()}
        >
          Terms &amp; Conditions
        </button>
        .
      </div>

      <button
        type="button"
        className="btn btn-outline-secondary w-100 radius-12 mb-12"
        onClick={onBack}
        disabled={submitting}
      >
        Back
      </button>

      <button
        type="button"
        className="btn btn-success w-100 radius-12"
        onClick={handleConfirm}
        disabled={submitting}
      >
        {submitting ? (
          <>
            <span className="spinner-border spinner-border-sm me-8" role="status" aria-hidden="true" />
            Confirming…
          </>
        ) : (
          "Confirm & Submit Account"
        )}
      </button>
    </>
  );
};

export default Step8;
