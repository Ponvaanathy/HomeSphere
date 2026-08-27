const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { uploadUserAvatar } = require('../middleware/uploadMiddleware');

router.get('/profile', authMiddleware, userController.getProfile);
router.put('/profile', authMiddleware, userController.updateProfile);
router.post('/avatar', authMiddleware, uploadUserAvatar.single('avatar'), userController.updateAvatar);
router.get('/preferences', authMiddleware, userController.getPreferences);
router.put('/preferences', authMiddleware, userController.updatePreferences);
router.get('/activity', authMiddleware, userController.getUserActivity);
router.get('/dashboard-stats', authMiddleware, userController.getDashboardStats);
router.get('/dashboard', authMiddleware, userController.getDashboardStats);

module.exports = router;
