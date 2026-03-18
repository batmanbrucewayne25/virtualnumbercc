import express from 'express';
import {
  uploadProfileImage,
  uploadLogo,
  uploadSignature,
  serveSignature,
  serveLogo,
  serveProfileImage,
} from '../controllers/upload.controller.js';
import { optionalAuthMiddleware } from '../middleware/optionalAuth.middleware.js';
import {
  uploadProfileImage as uploadProfileImageMulter,
  uploadLogo as uploadLogoMulter,
  uploadSignature as uploadSignatureMulter,
} from '../services/upload.service.js';

const router = express.Router();

/**
 * @route   POST /api/upload/profile-image
 * @desc    Upload reseller profile image
 * @access  Private (Reseller only) or Public (if resellerId provided in query)
 */
router.post('/profile-image', optionalAuthMiddleware, uploadProfileImageMulter.single('profile_image'), uploadProfileImage);

/**
 * @route   GET /api/upload/profile-image/:filename
 * @desc    Serve a profile image by filename (API fallback when static /uploads is unavailable)
 * @access  Public
 */
router.get('/profile-image/:filename', serveProfileImage);

/**
 * @route   POST /api/upload/logo
 * @desc    Upload reseller logo
 * @access  Private (Reseller only) or during signup with email in query
 */
router.post('/logo', optionalAuthMiddleware, uploadLogoMulter.single('logo'), uploadLogo);

/**
 * @route   GET /api/upload/logo/:filename
 * @desc    Serve a logo image by filename (API fallback when static /uploads is unavailable)
 * @access  Public
 */
router.get('/logo/:filename', serveLogo);

/**
 * @route   POST /api/upload/signature
 * @desc    Upload reseller signature
 * @access  Private (Reseller only) or Public (if resellerId provided in query)
 */
router.post('/signature', optionalAuthMiddleware, uploadSignatureMulter.single('signature'), uploadSignature);

/**
 * @route   GET /api/upload/signature/:filename
 * @desc    Serve a signature image by filename (API fallback when static /uploads is unavailable)
 * @access  Public
 */
router.get('/signature/:filename', serveSignature);

export default router;

