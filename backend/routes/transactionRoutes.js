const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/express-interest', transactionController.expressInterest);
router.post('/schedule-visit', transactionController.scheduleVisit);
router.post('/offer', transactionController.submitOffer);
router.get('/my-deals', transactionController.getMyDeals);
router.get('/:id', transactionController.getTransactionById);
router.put('/:id/milestone', transactionController.updateMilestone);
router.put('/:id/status', transactionController.updateTransactionStatus);
router.patch('/:id/status', transactionController.updateTransactionStatus);

module.exports = router;
