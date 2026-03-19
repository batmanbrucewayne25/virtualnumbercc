import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getProfileImageUrl,
  getLogoUrl,
  getSignatureUrl,
  getFaviconUrl,
  getMinifiedLogoUrl,
  getProfileImageAltUrl,
  getSignaturePath,
  getLogoPath,
  getProfileImagePath,
  getFaviconPath,
  getMinifiedLogoPath,
  getProfileImageAltPath
} from '../services/upload.service.js';
import { getHasuraClient } from '../config/hasura.client.js';
import path from 'path';
import fs from 'fs';

const resolveTargetResellerId = async (req) => {
  let targetId = req.query.resellerId || req.user?.userId;
  if (!targetId && (req.query.email || req.body?.email)) {
    const client = getHasuraClient();
    const email = req.query.email || req.body.email;
    const reseller = await client.getUserByEmail(email);
    if (reseller) targetId = reseller.id;
  }
  return targetId;
};

const uploadResellerAsset = async ({
  req,
  res,
  fileRequiredMessage,
  mutationName,
  dbField,
  dbValue,
  successMessage,
  responseData,
}) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: fileRequiredMessage
    });
  }

  const targetId = await resolveTargetResellerId(req);
  if (!targetId) {
    return res.status(401).json({
      success: false,
      message: 'Reseller identification required. Log in, or provide resellerId or email.'
    });
  }

  const client = getHasuraClient();
  const mutation = `
    mutation ${mutationName}($id: uuid!, $value: String!) {
      update_mst_reseller_by_pk(
        pk_columns: { id: $id }
        _set: { ${dbField}: $value }
      ) {
        id
        ${dbField}
      }
    }
  `;

  const result = await client.client.request(mutation, {
    id: targetId,
    value: dbValue
  });

  if (result?.errors) {
    return res.status(400).json({
      success: false,
      message: result.errors[0]?.message || `Failed to update ${dbField}`
    });
  }

  return res.json({
    success: true,
    message: successMessage,
    data: responseData
  });
};

/**
 * @desc    Upload profile image
 * @route   POST /api/upload/profile-image
 * @access  Private (Reseller only) or Admin (with resellerId query param)
 */
export const uploadProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No image file provided'
    });
  }

  // Resolve target reseller: explicit resellerId (admin flow) takes precedence over JWT userId (reseller editing own)
  const targetId = req.query.resellerId || req.user?.userId;
  console.log('[uploadProfileImage] req.query.resellerId:', req.query.resellerId);
  console.log('[uploadProfileImage] req.user?.userId:', req.user?.userId);
  console.log('[uploadProfileImage] targetId (reseller to update):', targetId);

  if (!targetId) {
    return res.status(401).json({
      success: false,
      message: 'Reseller identification required. Provide a valid auth token or resellerId query param.'
    });
  }

  try {
    const filename = req.file.filename;
    const imageUrl = getProfileImageUrl(filename);
    console.log('[uploadProfileImage] Saving filename to DB:', filename, 'for reseller:', targetId);

    // Persist the filename to the database so it survives page refreshes
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
      profile_image: filename,
    });

    if (result?.errors) {
      console.error('[uploadProfileImage] Hasura mutation failed:', result.errors);
      return res.status(400).json({
        success: false,
        message: result.errors[0]?.message || 'Failed to update profile image in database'
      });
    }

    console.log('[uploadProfileImage] DB updated successfully for reseller:', targetId);
    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: {
        filename,
        imageUrl,
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
  const logoUrl = getLogoUrl(req.file?.filename);
  return uploadResellerAsset({
    req,
    res,
    fileRequiredMessage: 'No logo file provided',
    mutationName: 'UpdateResellerLogo',
    dbField: 'logo',
    dbValue: logoUrl,
    successMessage: 'Logo uploaded successfully',
    responseData: { logoUrl, filename: req.file.filename }
  });
});

export const uploadFavicon = asyncHandler(async (req, res) => {
  const faviconUrl = getFaviconUrl(req.file?.filename);
  return uploadResellerAsset({
    req,
    res,
    fileRequiredMessage: 'No favicon file provided',
    mutationName: 'UpdateResellerFavicon',
    dbField: 'favicon',
    dbValue: faviconUrl,
    successMessage: 'Favicon uploaded successfully',
    responseData: { faviconUrl, filename: req.file.filename }
  });
});

export const uploadMinifiedLogo = asyncHandler(async (req, res) => {
  const minifiedLogoUrl = getMinifiedLogoUrl(req.file?.filename);
  return uploadResellerAsset({
    req,
    res,
    fileRequiredMessage: 'No minified logo file provided',
    mutationName: 'UpdateResellerMinifiedLogo',
    dbField: 'minified_logo',
    dbValue: minifiedLogoUrl,
    successMessage: 'Minified logo uploaded successfully',
    responseData: { minifiedLogoUrl, filename: req.file.filename }
  });
});

export const uploadProfileImageAlt = asyncHandler(async (req, res) => {
  const profileImageAltUrl = getProfileImageAltUrl(req.file?.filename);
  return uploadResellerAsset({
    req,
    res,
    fileRequiredMessage: 'No alternative profile image file provided',
    mutationName: 'UpdateResellerProfileImageAlt',
    dbField: 'profile_image_alt',
    dbValue: profileImageAltUrl,
    successMessage: 'Alternative profile image uploaded successfully',
    responseData: { profileImageAltUrl, filename: req.file.filename }
  });
});

/**
 * @desc    Upload signature image
 * @route   POST /api/upload/signature
 * @access  Private (Reseller only) or Public (if resellerId provided in query)
 */
export const uploadSignature = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No signature image file provided'
    });
  }

  // Resolve target reseller: from JWT auth, explicit query param, or email lookup (signup flow)
  let targetId = req.user?.userId || req.query.resellerId;
  if (!targetId && (req.query.email || req.body?.email)) {
    const client = getHasuraClient();
    const email = req.query.email || req.body.email;
    const reseller = await client.getUserByEmail(email);
    if (reseller) targetId = reseller.id;
  }

  try {
    const filename = req.file.filename;
    const signatureUrl = getSignatureUrl(filename);

    // If we have a reseller ID, persist to DB immediately so it survives refresh.
    // During the signup flow the frontend calls completeSignupStep separately,
    // so we only write to DB here when the reseller is already identified.
    if (targetId) {
      const client = getHasuraClient();
      const mutation = `
        mutation UpdateResellerSignature($id: uuid!, $signatureImage: String!) {
          update_mst_reseller_by_pk(
            pk_columns: { id: $id }
            _set: { signatureImage: $signatureImage }
          ) {
            id
            signatureImage
          }
        }
      `;

      const result = await client.client.request(mutation, {
        id: targetId,
        signatureImage: filename,
      });

      if (result?.errors) {
        return res.status(400).json({
          success: false,
          message: result.errors[0]?.message || 'Failed to update signature in database'
        });
      }
    }

    res.json({
      success: true,
      message: 'Signature uploaded successfully',
      data: {
        filename,
        signatureUrl,
      }
    });
  } catch (error) {
    console.error('Error uploading signature:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload signature'
    });
  }
});

/**
 * @desc    Serve a signature image by filename (GET fallback for frontend)
 * @route   GET /api/upload/signature/:filename
 * @access  Public
 */
export const serveSignature = asyncHandler(async (req, res) => {
  const { filename } = req.params;

  // Prevent path traversal attacks
  if (!filename || !/^[a-zA-Z0-9_.-]+$/.test(filename)) {
    return res.status(400).json({ success: false, message: 'Invalid filename' });
  }

  const filePath = getSignaturePath(filename);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Signature not found' });
  }

  res.sendFile(path.resolve(filePath));
});

/**
 * @desc    Serve a logo image by filename (GET fallback for frontend)
 * @route   GET /api/upload/logo/:filename
 * @access  Public
 */
export const serveLogo = asyncHandler(async (req, res) => {
  const { filename } = req.params;

  if (!filename || !/^[a-zA-Z0-9_.-]+$/.test(filename)) {
    return res.status(400).json({ success: false, message: 'Invalid filename' });
  }

  const filePath = getLogoPath(filename);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Logo not found' });
  }

  res.sendFile(path.resolve(filePath));
});

/**
 * @desc    Serve a profile image by filename (GET fallback for frontend)
 * @route   GET /api/upload/profile-image/:filename
 * @access  Public
 */
export const serveProfileImage = asyncHandler(async (req, res) => {
  const { filename } = req.params;

  if (!filename || !/^[a-zA-Z0-9_.-]+$/.test(filename)) {
    return res.status(400).json({ success: false, message: 'Invalid filename' });
  }

  const filePath = getProfileImagePath(filename);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Profile image not found' });
  }

  res.sendFile(path.resolve(filePath));
});

export const serveFavicon = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  if (!filename || !/^[a-zA-Z0-9_.-]+$/.test(filename)) {
    return res.status(400).json({ success: false, message: 'Invalid filename' });
  }
  const filePath = getFaviconPath(filename);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Favicon not found' });
  }
  res.sendFile(path.resolve(filePath));
});

export const serveMinifiedLogo = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  if (!filename || !/^[a-zA-Z0-9_.-]+$/.test(filename)) {
    return res.status(400).json({ success: false, message: 'Invalid filename' });
  }
  const filePath = getMinifiedLogoPath(filename);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Minified logo not found' });
  }
  res.sendFile(path.resolve(filePath));
});

export const serveProfileImageAlt = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  if (!filename || !/^[a-zA-Z0-9_.-]+$/.test(filename)) {
    return res.status(400).json({ success: false, message: 'Invalid filename' });
  }
  const filePath = getProfileImageAltPath(filename);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Alternative profile image not found' });
  }
  res.sendFile(path.resolve(filePath));
});

