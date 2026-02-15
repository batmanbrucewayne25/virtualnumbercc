import { asyncHandler } from '../utils/asyncHandler.js';
import { getProfileImageUrl, getLogoUrl } from '../services/upload.service.js';
import { getHasuraClient } from '../config/hasura.client.js';

/**
 * @desc    Upload profile image
 * @route   POST /api/upload/profile-image
 * @access  Private (Reseller only)
 */
export const uploadProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No image file provided'
    });
  }

  // Allow admin to upload for a specific reseller via query param
  const targetId = req.query.resellerId || req.user.userId;

  try {
    // Get image URL
    const imageUrl = getProfileImageUrl(req.file.filename);

    // Update reseller profile_image in database
    const client = getHasuraClient();
    const mutation = `
      mutation UpdateResellerProfileImage($id: uuid!, $profile_image: String!) {
        update_mst_reseller_by_pk(
          pk_columns: { id: $id }
          _set: { profile_image: $profile_image }
        ) {
          id
          profile_image
        }
      }
    `;

    const result = await client.client.request(mutation, {
      id: targetId,
      profile_image: imageUrl
    });

    if (result?.errors) {
      return res.status(400).json({
        success: false,
        message: result.errors[0]?.message || 'Failed to update profile image'
      });
    }

    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: {
        imageUrl: imageUrl,
        filename: req.file.filename
      }
    });
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

