const express = require('express');
const router = express.Router();
const rentalApplicationController = require('../controllers/rentalApplicationController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', rentalApplicationController.submitApplication);
router.get('/my-applications', rentalApplicationController.getMyApplications);
router.get('/seller', rentalApplicationController.getSellerApplications);
router.put('/:id/status', rentalApplicationController.updateApplicationStatus);
router.patch('/:id/status', rentalApplicationController.updateApplicationStatus);

module.exports = router;
