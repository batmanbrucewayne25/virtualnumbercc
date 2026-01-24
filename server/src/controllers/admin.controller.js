import { AdminService } from '../services/admin.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * @desc    Get all admins
 * @route   GET /api/admin/list
 */
export const getAdminList = asyncHandler(async (req, res) => {
  const result = await AdminService.getAllAdmins();

  res.json({
    success: true,
    data: result
  });
});

/**
 * @desc    Get admin by ID
 * @route   GET /api/admin/:id
 */
export const getAdminById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const admin = await AdminService.getAdminById(parseInt(id));

  if (!admin) {
    return res.status(404).json({
      success: false,
      message: 'Admin not found'
    });
  }

  res.json({
    success: true,
    data: admin
  });
});

/**
 * @desc    Create new admin
 * @route   POST /api/admin/create
 */
export const createAdmin = asyncHandler(async (req, res) => {
  const { first_name, last_name, email, phone, password, status, role_id } = req.body;

  // Validate required fields
  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all required fields: first_name, last_name, email, password'
    });
  }

  // Validate password strength
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters long'
    });
  }

  // Get the current logged-in admin's ID (the one creating the new admin)
  const creatorAdminId = req.user?.userId || null;
  
  const result = await AdminService.createAdmin({
    first_name,
    last_name,
    email,
    phone: phone || null,
    password,
    status: status !== undefined ? status : true,
    role_id: role_id || null
  }, creatorAdminId);

  res.status(201).json({
    success: true,
    message: 'Admin created successfully. Welcome email has been sent.',
    data: result
  });
});

/**
 * @desc    Update admin
 * @route   PUT /api/admin/:id
 */
export const updateAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Don't allow password update through this endpoint (use separate change password endpoint)
  if (updateData.password) {
    delete updateData.password;
  }

  const result = await AdminService.updateAdmin(parseInt(id), updateData);

  if (!result) {
    return res.status(404).json({
      success: false,
      message: 'Admin not found'
    });
  }

  res.json({
    success: true,
    message: 'Admin updated successfully',
    data: result
  });
});

/**
 * @desc    Delete admin
 * @route   DELETE /api/admin/:id
 */
export const deleteAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await AdminService.deleteAdmin(parseInt(id));

  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: 'Admin not found'
    });
  }

  res.json({
    success: true,
    message: 'Admin deleted successfully'
  });
});
