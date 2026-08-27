const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { optionalAuthMiddleware } = require('../middleware/authMiddleware');

router.use(optionalAuthMiddleware);

// 1. Property Match
router.post('/property-match', aiController.getPropertyMatch);

// 2. AI Home Advisor Conversational
router.post('/advisor', aiController.getAdvisorResponse);

// 3. Trust Score
router.post('/trust-score/:propertyId', aiController.calculateTrustScore);
router.get('/trust-score/:propertyId', aiController.calculateTrustScore);

// 4. Property DNA Fingerprint
router.post('/property-dna/:propertyId', aiController.generatePropertyDNA);
router.get('/property-dna/:propertyId', aiController.generatePropertyDNA);

// 5. LifeScore Livability
router.post('/life-score/:propertyId', aiController.calculateLifeScore);
router.get('/life-score/:propertyId', aiController.calculateLifeScore);

// 6. Green Living Score
router.post('/green-score/:propertyId', aiController.calculateGreenScore);
router.get('/green-score/:propertyId', aiController.calculateGreenScore);

// 7. Hidden Cost Analysis
router.post('/hidden-costs/:propertyId', aiController.estimateHiddenCosts);
router.get('/hidden-costs/:propertyId', aiController.estimateHiddenCosts);

// 8. Future Value Prediction
router.post('/future-value/:propertyId', aiController.predictFutureValue);
router.get('/future-value/:propertyId', aiController.predictFutureValue);

// 9. Personalized Recommendations
router.get('/recommendations', aiController.getRecommendations);

// 10. AI Decision Summary
router.post('/decision-summary/:propertyId', aiController.generateDecisionSummary);
router.get('/decision-summary/:propertyId', aiController.generateDecisionSummary);

module.exports = router;
