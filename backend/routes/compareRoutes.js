const express = require('express');
const router = express.Router();
const compareController = require('../controllers/compareController');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/authMiddleware');

router.get('/', optionalAuthMiddleware, compareController.compareProperties);
router.post('/save', authMiddleware, compareController.saveComparison);

module.exports = router;
