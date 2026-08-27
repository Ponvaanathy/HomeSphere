const express = require('express');
const router = express.Router();
const savedController = require('../controllers/savedController');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/authMiddleware');

router.get('/', authMiddleware, savedController.getSavedProperties);
router.post('/', authMiddleware, savedController.saveProperty);
router.post('/:propertyId', authMiddleware, savedController.saveProperty);
router.delete('/', authMiddleware, savedController.removeSavedProperty);
router.delete('/:propertyId', authMiddleware, savedController.removeSavedProperty);
router.get('/check/:propertyId', optionalAuthMiddleware, savedController.checkIsSaved);

module.exports = router;
