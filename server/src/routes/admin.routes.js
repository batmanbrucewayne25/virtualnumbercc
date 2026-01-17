import express from 'express';
import {
  getAdminList,
  getAdminById,
  createAdmin,
  updateAdmin,
  deleteAdmin
} from '../controllers/admin.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/admin/list
 * @desc    Get all admins
 * @access  Private (requires authentication)
 */
router.get('/list', authMiddleware, getAdminList);

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
