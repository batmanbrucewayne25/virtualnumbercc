import express from 'express';
import {
  getAdminList,
  getAdminById,
  createAdmin,
  updateAdmin,
  deleteAdmin
} from '../controllers/admin.controller.js';
import {
  notifyResellersMaintenanceDisabled,
  notifyResellersMaintenanceEnabled,
} from '../controllers/maintenance.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/admin/list
 * @desc    Get all admins
 * @access  Private (requires authentication)
 */
router.get('/list', authMiddleware, getAdminList);

/**
 * @route   POST /api/admin/maintenance/notify-resellers-enabled
 * @desc    Broadcast maintenance-on email to all eligible resellers
 * @access  Private (admin / super_admin)
 */
router.post(
  '/maintenance/notify-resellers-enabled',
  authMiddleware,
  notifyResellersMaintenanceEnabled,
);

/**
 * @route   POST /api/admin/maintenance/notify-resellers-disabled
 * @desc    Broadcast maintenance-off email to all eligible resellers
 * @access  Private (admin / super_admin)
 */
router.post(
  '/maintenance/notify-resellers-disabled',
  authMiddleware,
  notifyResellersMaintenanceDisabled,
);

/**
 * @route   GET /api/admin/:id
 * @desc    Get admin by ID
 * @access  Private
 */
router.get('/:id', authMiddleware, getAdminById);

/**
 * @route   POST /api/admin/create
 * @desc    Create new admin
 * @access  Private
 */
router.post('/create', authMiddleware, createAdmin);

/**
 * @route   PUT /api/admin/:id
 * @desc    Update admin
 * @access  Private
 */
router.put('/:id', authMiddleware, updateAdmin);

/**
 * @route   DELETE /api/admin/:id
 * @desc    Delete admin
 * @access  Private
 */
router.delete('/:id', authMiddleware, deleteAdmin);

export default router;
