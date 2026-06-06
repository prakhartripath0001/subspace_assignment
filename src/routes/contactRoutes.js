/**
 * @file contactRoutes.js
 * @description Routes for contact enrichment endpoints
 */

const express = require('express');
const router = express.Router();

const { enrichContact, enrichBatchContacts } = require(
  '../controllers/contactController',
);

/**
 * POST /api/contact/enrich
 * Enriches a single LinkedIn profile
 */
router.post('/enrich', enrichContact);

/**
 * POST /api/contact/enrich-batch
 * Enriches multiple LinkedIn profiles
 */
router.post('/enrich-batch', enrichBatchContacts);

module.exports = router;
