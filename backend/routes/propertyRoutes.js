const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/propertyController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { uploadPropertyImages, uploadVirtualTourImages, uploadDocument } = require('../middleware/uploadMiddleware');

// Public Listing Discovery, Analytics & Details
router.get('/', propertyController.getProperties);
router.get('/nearby', propertyController.getNearbyProperties);
router.get('/location-intelligence', propertyController.getLocationIntelligence);
router.get('/categories/stats', propertyController.getCategoryStats);

// Authenticated Owner Listings ("My Listings") - Must be placed BEFORE /:id
router.get('/my-listings', authMiddleware, propertyController.getMyProperties);
router.get('/seller/my-listings', authMiddleware, propertyController.getMyProperties);
router.get('/user/me', authMiddleware, propertyController.getMyProperties);

router.get('/:id/hidden-costs', propertyController.getPropertyHiddenCosts);
router.get('/:id/analytics', propertyController.getPropertyAnalytics);
router.get('/:id', propertyController.getPropertyById);


// Core Property CRUD (with Multer Property Image Upload Support)
router.post('/', authMiddleware, uploadPropertyImages.array('images', 20), propertyController.createProperty);
router.put('/:id', authMiddleware, propertyController.updateProperty);
router.delete('/:id', authMiddleware, propertyController.deleteProperty);


// Real Property Gallery Image Management
router.post('/:id/images', authMiddleware, uploadPropertyImages.array('images', 20), propertyController.uploadImages);
router.patch('/:id/images/:imageId/primary', authMiddleware, propertyController.setPrimaryImage);
router.delete('/:id/images/:imageId', authMiddleware, propertyController.deleteImage);

// Real Virtual Tour Walkthrough Room Management
router.post('/:id/virtual-tour', authMiddleware, uploadVirtualTourImages.array('tour_images', 15), propertyController.uploadVirtualTourRoom);
router.put('/:id/virtual-tour/:tourId', authMiddleware, propertyController.updateVirtualTourRoom);
router.delete('/:id/virtual-tour/:tourId', authMiddleware, propertyController.deleteVirtualTourRoom);

// Document Verification Upload
router.post('/:id/documents', authMiddleware, uploadDocument.single('document'), propertyController.uploadDocument);

module.exports = router;
