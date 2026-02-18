import { asyncHandler } from '../utils/asyncHandler.js';
import { getProfileImageUrl, getLogoUrl, getSignatureUrl } from '../services/upload.service.js';
import { getHasuraClient } from '../config/hasura.client.js';

/**
 * @desc    Upload profile image
 * @route   POST /api/upload/profile-image
 * @access  Private (Reseller only)
 */
export const uploadProfileImage = asyncHandler(async (req, res) => {
  console.log("=== Profile Image Upload Endpoint Hit ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  console.log("Headers:", {
    'content-type': req.headers['content-type'],
    'authorization': req.headers['authorization'] ? 'present' : 'missing'
  });
  console.log("File:", req.file ? {
    fieldname: req.file.fieldname,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    filename: req.file.filename
  } : 'NO FILE');
  
  if (!req.file) {
    console.error("❌ No file provided in request");
    return res.status(400).json({
      success: false,
      message: 'No image file provided'
    });
  }

  try {
    // File is already saved by multer middleware
    // Just return the filename
    const filename = req.file.filename;
    const imageUrl = getProfileImageUrl(filename);

    console.log("✅ Profile image saved to server successfully");
    console.log("Filename:", filename);
    
    const responseData = {
      success: true,
      message: 'Profile image uploaded successfully',
      data: {
        filename: filename,
        imageUrl: imageUrl
      }
    };
    console.log("Sending response:", responseData);
    res.json(responseData);
  } catch (error) {
    console.error('Error uploading profile image:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload profile image'
    });
  }
});

/**
 * @desc    Upload logo
 * @route   POST /api/upload/logo
 * @access  Private (Reseller only)
 */
export const uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No logo file provided'
    });
  }

  // Allow admin to upload for a specific reseller via query param
  const targetId = req.query.resellerId || req.user.userId;

  try {
    // Get logo URL
    const logoUrl = getLogoUrl(req.file.filename);

    // Update reseller logo in database
    const client = getHasuraClient();
    const mutation = `
      mutation UpdateResellerLogo($id: uuid!, $logo: String!) {
        update_mst_reseller_by_pk(
          pk_columns: { id: $id }
          _set: { logo: $logo }
        ) {
          id
          logo
        }
      }
    `;

    const result = await client.client.request(mutation, {
      id: targetId,
      logo: logoUrl
    });

    if (result?.errors) {
      return res.status(400).json({
        success: false,
        message: result.errors[0]?.message || 'Failed to update logo'
      });
    }

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      data: {
        logoUrl: logoUrl,
        filename: req.file.filename
      }
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload logo'
    });
  }
});

/**
 * @desc    Upload signature image
 * @route   POST /api/upload/signature
 * @access  Private (Reseller only) or Public (if resellerId provided in query)
 */
export const uploadSignature = asyncHandler(async (req, res) => {
  console.log("=== Signature Upload Endpoint Hit ===");
  console.log("File:", req.file ? {
    fieldname: req.file.fieldname,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    filename: req.file.filename
  } : 'NO FILE');
  
  if (!req.file) {
    console.error("❌ No file provided in request");
    return res.status(400).json({
      success: false,
      message: 'No signature image file provided'
    });
  }

  try {
    // File is already saved by multer middleware
    // Just return the filename
    const filename = req.file.filename;
    const signatureUrl = getSignatureUrl(filename);

    console.log("✅ Signature saved to server successfully");
    console.log("Filename:", filename);
    
    const responseData = {
      success: true,
      message: 'Signature uploaded successfully',
      data: {
        filename: filename,
        signatureUrl: signatureUrl
      }
    };
    console.log("Sending response:", responseData);
    res.json(responseData);
  } catch (error) {
    console.error('Error uploading signature:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload signature'
    });
  }
});

