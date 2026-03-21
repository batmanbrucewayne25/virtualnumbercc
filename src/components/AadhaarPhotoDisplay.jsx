import { getAadhaarPhotoDisplaySrc } from "@/utils/aadhaarPhotoUrl";

/**
 * Shows Aadhaar crop/photo when present. Sensitive: only full image for admins (matches masked Aadhaar number).
 */
const AadhaarPhotoDisplay = ({ customer, isAdmin }) => {
  const imageSrc = getAadhaarPhotoDisplaySrc(customer);
  if (!imageSrc || !isAdmin) return null;

  return (
    <div>
      <span className="text-xs text-secondary-light d-block mb-8">Aadhaar Photo:</span>
      <img
        src={imageSrc}
        alt="Aadhaar"
        className="rounded border"
        style={{
          maxWidth: "100%",
          maxHeight: "300px",
          objectFit: "contain",
          cursor: "pointer",
          display: "block",
        }}
        onError={(e) => {
          e.target.style.display = "none";
        }}
        onClick={() => {
          const w = window.open();
          if (w) {
            w.document.write(
              `<img src="${imageSrc}" style="max-width: 100%; height: auto;" />`
            );
          }
        }}
        title="Click to view full size"
      />
    </div>
  );
};

export default AadhaarPhotoDisplay;
