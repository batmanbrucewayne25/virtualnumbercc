import express from 'express';
import {
  uploadProfileImage,
  uploadLogo,
  uploadSignature,
  uploadFavicon,
  uploadMinifiedLogo,
  uploadProfileImageAlt,
  serveSignature,
  serveLogo,
  serveProfileImage,
  serveFavicon,
  serveMinifiedLogo,
  serveProfileImageAlt,
} from '../controllers/upload.controller.js';
import { optionalAuthMiddleware } from '../middleware/optionalAuth.middleware.js';
import {
  uploadProfileImage as uploadProfileImageMulter,
  uploadLogo as uploadLogoMulter,
  uploadSignature as uploadSignatureMulter,
  uploadFavicon as uploadFaviconMulter,
  uploadMinifiedLogo as uploadMinifiedLogoMulter,
  uploadProfileImageAlt as uploadProfileImageAltMulter,
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

router.post('/favicon', optionalAuthMiddleware, uploadFaviconMulter.single('favicon'), uploadFavicon);
router.get('/favicon/:filename', serveFavicon);

router.post('/minified-logo', optionalAuthMiddleware, uploadMinifiedLogoMulter.single('minified_logo'), uploadMinifiedLogo);
router.get('/minified-logo/:filename', serveMinifiedLogo);

router.post('/profile-image-alt', optionalAuthMiddleware, uploadProfileImageAltMulter.single('profile_image_alt'), uploadProfileImageAlt);
router.get('/profile-image-alt/:filename', serveProfileImageAlt);

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

