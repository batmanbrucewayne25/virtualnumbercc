import express from 'express';
import { uploadProfileImage, uploadLogo, uploadSignature } from '../controllers/upload.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { optionalAuthMiddleware } from '../middleware/optionalAuth.middleware.js';
import { uploadProfileImage as uploadProfileImageMulter, uploadLogo as uploadLogoMulter, uploadSignature as uploadSignatureMulter } from '../services/upload.service.js';

const router = express.Router();

/**
 * @route   POST /api/upload/profile-image
 * @desc    Upload reseller profile image
 * @access  Private (Reseller only) or Public (if resellerId provided in query)
 */
router.post('/profile-image', optionalAuthMiddleware, uploadProfileImageMulter.single('profile_image'), uploadProfileImage);

/**
 * @route   POST /api/upload/logo
 * @desc    Upload reseller logo
 * @access  Private (Reseller only)
 */
router.post('/logo', authMiddleware, uploadLogoMulter.single('logo'), uploadLogo);

/**
 * @route   POST /api/upload/signature
 * @desc    Upload reseller signature
 * @access  Private (Reseller only) or Public (if resellerId provided in query)
 */
router.post('/signature', optionalAuthMiddleware, uploadSignatureMulter.single('signature'), uploadSignature);

export default router;

