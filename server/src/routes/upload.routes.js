import express from 'express';
import { uploadProfileImage, uploadLogo } from '../controllers/upload.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { uploadProfileImage as uploadProfileImageMulter, uploadLogo as uploadLogoMulter } from '../services/upload.service.js';

const router = express.Router();

/**
 * @route   POST /api/upload/profile-image
 * @desc    Upload reseller profile image
 * @access  Private (Reseller only)
 */
router.post('/profile-image', authMiddleware, uploadProfileImageMulter.single('profile_image'), uploadProfileImage);

/**
 * @route   POST /api/upload/logo
 * @desc    Upload reseller logo
 * @access  Private (Reseller only)
 */
router.post('/logo', authMiddleware, uploadLogoMulter.single('logo'), uploadLogo);

export default router;

