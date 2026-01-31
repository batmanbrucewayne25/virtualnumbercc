import express from 'express';
import { getResellerByDomain } from '../controllers/reseller.controller.js';

const router = express.Router();

/**
 * @route   GET /api/reseller/by-domain
 * @desc    Get reseller by custom domain (only approved domains)
 * @access  Public
 */
router.get('/by-domain', getResellerByDomain);

export default router;
