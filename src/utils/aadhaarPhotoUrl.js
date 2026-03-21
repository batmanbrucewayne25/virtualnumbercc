/**
 * Raw image value for Aadhaar section: prefer dedicated columns, then profile_image
 * (customer onboarding stores the Aadhaar crop in profile_image when aadhar_photo is unset).
 */
export function getAadhaarPhotoRaw(customer) {
  if (!customer) return "";
  const candidates = [
    customer.aadhar_photo,
    customer.aadhaar_photo,
    customer.profile_image,
  ];
  for (const c of candidates) {
    if (c == null || c === "") continue;
    const s = String(c).trim();
    if (s) return s;
  }
  return "";
}

/**
 * Resolve display URL for customer/reseller Aadhaar photo.
 * Stored as base64, data URL, http(s), or uploaded filename.
 */
export function getAadhaarPhotoDisplaySrc(customer) {
  const raw = getAadhaarPhotoRaw(customer);
  if (!raw) return null;

  if (raw.startsWith("data:")) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;

  const uploadBase = (
    import.meta.env.VITE_IMAGE_UPLOAD_PATH || "http://localhost:3001/uploads"
  ).replace(/\/+$/, "");

  // Server-stored filename (e.g. uuid.jpg)
  if (/\.(jpe?g|png|gif|webp|jfif)$/i.test(raw) && raw.length < 600) {
    return `${uploadBase}/profile-images/${raw.replace(/^\/+/, "")}`;
  }

  return `data:image/jpeg;base64,${raw}`;
}
