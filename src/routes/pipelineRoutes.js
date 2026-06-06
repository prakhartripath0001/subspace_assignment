/**
 * @file pipelineRoutes.js
 * @description Routes for pipeline endpoints
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const PipelineService = require('../services/pipelineService');

// Store active pipelines
const activePipelines = new Map();

/**
 * POST /api/pipeline/execute
 * Execute the complete outreach pipeline
 */
router.post('/execute', async (req, res) => {
  try {
    const { seedDomain, skipConfirmation = false, companyLimit = 10 } = req.body;

    if (!seedDomain || typeof seedDomain !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'seedDomain is required and must be a string',
      });
    }

    logger.info('Pipeline Execute Request', {
      seedDomain,
      skipConfirmation,
      companyLimit,
    });

    const pipelineService = new PipelineService();
    const result = await pipelineService.executePipeline(seedDomain, {
      skipConfirmation,
      companyLimit,
    });

    // Store pipeline result
    const pipelineId = `pipeline_${Date.now()}`;
    activePipelines.set(pipelineId, result);

    logger.info('Pipeline Execution Complete', {
      pipelineId,
      success: result.summary.success,
    });

    return res.json({
      success: result.summary.success,
      pipelineId,
      summary: result.summary,
      stages: {
        companiesDiscovered: result.stages.companies ? result.stages.companies.length : 0,
        contactsFound: result.stages.contacts ? result.stages.contacts.length : 0,
        emailsResolved: result.stages.emailContacts
          ? result.stages.emailContacts.filter((c) => c.email).length
          : 0,
        emailsSent: result.stages.emailResults
          ? result.stages.emailResults.filter((r) => r.success).length
          : 0,
      },
    });
  } catch (error) {
    logger.error('Pipeline Execution Failed', {
      error: error.message,
    });

    return res.status(500).json({
      error: 'Pipeline Execution Failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/pipeline/preview
 * Preview pipeline results without sending emails
 */
router.post('/preview', async (req, res) => {
  try {
    const { seedDomain, companyLimit = 10 } = req.body;

    if (!seedDomain || typeof seedDomain !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'seedDomain is required and must be a string',
      });
    }

    logger.info('Pipeline Preview Request', {
      seedDomain,
      companyLimit,
    });

    const pipelineService = new PipelineService();
    const result = await pipelineService.executePipeline(seedDomain, {
      skipConfirmation: true,
      companyLimit,
      skipEmails: true, // Don't send emails in preview
    });

    logger.info('Pipeline Preview Complete', {
      seedDomain,
      companiesFound: result.stages.companies?.length || 0,
    });

    return res.json({
      success: true,
      preview: {
        companies: (result.stages.companies || []).map((c) => ({
          name: c.name,
          domain: c.domain,
          industry: c.industry,
          employees: c.employeeCount,
        })),
        contacts: (result.stages.contacts || []).map((c) => ({
          name: c.name,
          title: c.title,
          company: c.company,
          linkedinUrl: c.linkedinUrl,
        })),
        emailReady: (result.stages.emailContacts || [])
          .filter((c) => c.email)
          .map((c) => ({
            name: c.name,
            email: c.email,
            company: c.company,
          })),
      },
      summary: result.summary,
    });
  } catch (error) {
    logger.error('Pipeline Preview Failed', {
      error: error.message,
    });

    return res.status(500).json({
      error: 'Pipeline Preview Failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/pipeline/status/:id
 * Get pipeline execution status
 */
router.get('/status/:id', (req, res) => {
  const { id } = req.params;

  const pipeline = activePipelines.get(id);

  if (!pipeline) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Pipeline ${id} not found`,
    });
  }

  return res.json({
    pipelineId: id,
    status: pipeline.summary.success ? 'completed' : 'failed',
    summary: pipeline.summary,
  });
});

/**
 * GET /api/pipeline/list
 * List all active pipelines
 */
router.get('/list', (req, res) => {
  const pipelines = Array.from(activePipelines.entries()).map(([id, result]) => ({
    id,
    seedDomain: result.seedDomain,
    status: result.summary.success ? 'completed' : 'failed',
    companiesDiscovered: result.summary.companiesDiscovered,
    contactsFound: result.summary.contactsFound,
    emailsResolved: result.summary.emailsResolved,
    emailsSent: result.summary.emailsSent,
    totalTime: `${(result.summary.totalTime / 1000).toFixed(2)}s`,
  }));

  return res.json({
    total: pipelines.length,
    pipelines,
  });
});

module.exports = router;
