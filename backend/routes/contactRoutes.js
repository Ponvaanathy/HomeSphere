const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

router.post('/', optionalAuthMiddleware, contactController.submitInquiry);
router.get('/my-inquiries', authMiddleware, contactController.getMyInquiries);
router.get('/seller/received', authMiddleware, contactController.getSellerInquiries);
router.put('/:id/status', authMiddleware, contactController.updateInquiryStatus);
router.get('/admin/all', authMiddleware, adminMiddleware, contactController.getAllInquiries);

module.exports = router;
