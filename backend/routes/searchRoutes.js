const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

router.get('/suggestions', searchController.getSearchSuggestions);
router.get('/filter-options', searchController.getFilterOptions);
router.get('/geocode', searchController.geocodeQuery);
router.get('/reverse-geocode', searchController.reverseGeocodeQuery);

module.exports = router;

