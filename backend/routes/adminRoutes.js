const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware } = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// All admin routes require valid JWT + admin role
router.use(authMiddleware, adminMiddleware);

router.get('/stats', adminController.getDashboardStats);
router.get('/users', adminController.getUsers);
router.put('/users/:id/role', adminController.updateUserRole);
router.put('/users/:id/status', adminController.updateUserStatus);
router.get('/properties', adminController.getAllProperties);
router.put('/properties/:id/status', adminController.updatePropertyStatus);
router.get('/verification-queue', adminController.getVerificationQueue);
router.put('/verify-document/:id', adminController.verifyDocument);

module.exports = router;
