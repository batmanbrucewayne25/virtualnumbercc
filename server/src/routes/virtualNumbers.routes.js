import express from 'express';
import {
  getAvailableNumbers,
  activateNumber,
  configureCallForwarding,
  updateCallForwarding,
  getNumberDetails,
  suspendNumber,
  reactivateNumber
} from '../controllers/virtualNumbers.controller.js';
import { apiKeyMiddleware } from '../middleware/apiKey.middleware.js';

const router = express.Router();

/**
 * @route   GET /virtualnumbers/available
 * @desc    Get available virtual numbers
 * @access  Private (API Key)
 */
router.get('/available', apiKeyMiddleware, getAvailableNumbers);

/**
 * @route   POST /virtualnumbers/activate
 * @desc    Activate a virtual number
 * @access  Private (API Key)
 */
router.post('/activate', apiKeyMiddleware, activateNumber);

/**
 * @route   POST /virtualnumbers/call-forward
 * @desc    Configure call forwarding
 * @access  Private (API Key)
 */
router.post('/call-forward', apiKeyMiddleware, configureCallForwarding);

/**
 * @route   PUT /virtualnumbers/call-forward
 * @desc    Update call forwarding
 * @access  Private (API Key)
 */
router.put('/call-forward', apiKeyMiddleware, updateCallForwarding);

/**
 * @route   GET /virtualnumbers/details/:number
 * @desc    Get number details
 * @access  Private (API Key)
 */
router.get('/details/:number', apiKeyMiddleware, getNumberDetails);

/**
 * @route   POST /virtualnumbers/suspend
 * @desc    Suspend a number
 * @access  Private (API Key)
 */
router.post('/suspend', apiKeyMiddleware, suspendNumber);

/**
 * @route   POST /virtualnumbers/reactivate
 * @desc    Reactivate a number
 * @access  Private (API Key)
 */
router.post('/reactivate', apiKeyMiddleware, reactivateNumber);

export default router;

