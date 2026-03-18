import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get upload directory from environment variable or use default
const IMAGE_UPLOAD_BASE_DIR = process.env.IMAGE_UPLOAD_PATH || path.join(__dirname, '../../uploads');

// Create uploads directories if they don't exist
const profileImagesDir = path.join(IMAGE_UPLOAD_BASE_DIR, 'profile-images');
const logosDir = path.join(IMAGE_UPLOAD_BASE_DIR, 'logos');
const signaturesDir = path.join(IMAGE_UPLOAD_BASE_DIR, 'signatures');
if (!fs.existsSync(profileImagesDir)) {
  fs.mkdirSync(profileImagesDir, { recursive: true });
}
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}
if (!fs.existsSync(signaturesDir)) {
  fs.mkdirSync(signaturesDir, { recursive: true });
}

// Configure storage for profile images
const profileImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profileImagesDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-resellerId-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = `profile-${uniqueSuffix}${ext}`;
    cb(null, filename);
  }
});

// Configure storage for logos
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, logosDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-resellerId-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = `logo-${uniqueSuffix}${ext}`;
    cb(null, filename);
  }
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
  }
};

// Configure multer for profile images
export const uploadProfileImage = multer({
  storage: profileImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Configure storage for signatures
const signatureStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, signaturesDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-resellerId-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.png';
    const filename = `signature-${uniqueSuffix}${ext}`;
    cb(null, filename);
  }
});

// Configure multer for logos
export const uploadLogo = multer({
  storage: logoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Configure multer for signatures
export const uploadSignature = multer({
  storage: signatureStorage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit for signatures
  },
  fileFilter: fileFilter
});

/**
 * Get the relative URL path for the uploaded profile image
 * @param {string} filename - The filename of the uploaded image
 * @returns {string} Relative URL path
 */
export const getProfileImageUrl = (filename) => {
  if (!filename) return null;
  return filename;
};

/**
 * Get the relative URL path for the uploaded logo
 * @param {string} filename - The filename of the uploaded logo
 * @returns {string} Relative URL path
 */
export const getLogoUrl = (filename) => {
  if (!filename) return null;
  return filename;
};

/**
 * Get the relative URL path for the uploaded signature
 * @param {string} filename - The filename of the uploaded signature
 * @returns {string} Relative URL path
 */
export const getSignatureUrl = (filename) => {
  if (!filename) return null;
  return filename;
};

/**
 * Get the full file path for the uploaded profile image
 * @param {string} filename - The filename of the uploaded image
 * @returns {string} Full file path
 */
export const getProfileImagePath = (filename) => {
  if (!filename) return null;
  return path.join(profileImagesDir, filename);
};

/**
 * Get the full file path for the uploaded logo
 * @param {string} filename - The filename of the uploaded logo
 * @returns {string} Full file path
 */
export const getLogoPath = (filename) => {
  if (!filename) return null;
  return path.join(logosDir, filename);
};

/**
 * Get the full file path for the uploaded signature
 * @param {string} filename - The filename of the uploaded signature
 * @returns {string} Full file path
 */
export const getSignaturePath = (filename) => {
  if (!filename) return null;
  return path.join(signaturesDir, filename);
};

/**
 * Delete a profile image file
 * @param {string} filename - The filename to delete
 * @returns {Promise<boolean>} Success status
 */
export const deleteProfileImage = async (filename) => {
  try {
    if (!filename) return true;
    
    const filePath = getProfileImagePath(filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return true; // File doesn't exist, consider it deleted
  } catch (error) {
    console.error('Error deleting profile image:', error);
    return false;
  }
};

/**
 * Delete a logo file
 * @param {string} filename - The filename to delete
 * @returns {Promise<boolean>} Success status
 */
export const deleteLogo = async (filename) => {
  try {
    if (!filename) return true;
    
    const filePath = getLogoPath(filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return true; // File doesn't exist, consider it deleted
  } catch (error) {
    console.error('Error deleting logo:', error);
    return false;
  }
};

/**
 * Delete a signature file
 * @param {string} filename - The filename to delete
 * @returns {Promise<boolean>} Success status
 */
export const deleteSignature = async (filename) => {
  try {
    if (!filename) return true;
    
    const filePath = getSignaturePath(filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return true; // File doesn't exist, consider it deleted
  } catch (error) {
    console.error('Error deleting signature:', error);
    return false;
  }
};

