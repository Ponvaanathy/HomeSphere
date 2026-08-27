const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

router.get('/suggestions', searchController.getSearchSuggestions);
router.get('/filter-options', searchController.getFilterOptions);

module.exports = router;
