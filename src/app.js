const express = require('express');
const axios = require('axios');
const { discoverCompanies } = require('./services/discoveryService');
const contactRoutes = require('./routes/contactRoutes');
const pipelineRoutes = require('./routes/pipelineRoutes');
const logger = require('./utils/logger');

const app = express();

// Middleware
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Automated B2B Outreach Pipeline API',
    version: '2.0.0',
    endpoints: {
      discovery: 'GET /discover?domain=google.com',
      contact_enrichment: 'POST /api/contact/enrich',
      pipeline_execute: 'POST /api/pipeline/execute',
      pipeline_preview: 'POST /api/pipeline/preview',
    },
  });
});

app.get('/discover', async (req, res) => {
  const { domain, limit } = req.query;

  if (!domain || typeof domain !== 'string' || !domain.trim()) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Query parameter "domain" is required and must be a non-empty string.',
    });
  }

  try {
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const domains = await discoverCompanies(domain, limitNum);
    return res.json({
      success: true,
      seedDomain: domain,
      count: domains.length,
      companies: domains,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

/**
 * POST /companies/search
 * Search for companies using Apollo.io API
 * Accepts parameters via query string OR request body
 * Returns full Apollo response with organizations, pagination, and metadata
 */
app.post('/companies/search', async (req, res) => {
  // Accept parameters from both query string and request body
  const q_organization_domains = req.query.q_organization_domains || req.body?.q_organization_domains;
  const page = req.query.page || req.body?.page || 1;
  const per_page = req.query.per_page || req.body?.per_page || 10;

  // Validate required parameters
  if (!q_organization_domains || typeof q_organization_domains !== 'string' || !q_organization_domains.trim()) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Parameter "q_organization_domains" is required (send via query string or JSON body).',
    });
  }

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'APOLLO_API_KEY environment variable is not set.',
    });
  }

  try {
    // Clamp per_page to Apollo's max of 100
    const pageSize = Math.min(Math.max(1, Number(per_page) || 10), 100);
    const pageNum = Math.max(1, Number(page) || 1);

    // Build request payload - use X-Api-Key header method (like discoveryService)
    const requestPayload = {
      q_organization_domains: q_organization_domains.trim().toLowerCase(),
      per_page: pageSize,
      page: pageNum,
    };

    logger.info('Apollo company search initiated', {
      domain: requestPayload.q_organization_domains,
      page: pageNum,
      perPage: pageSize,
    });

    // Call Apollo.io API using organizations/search endpoint with X-Api-Key header
    const response = await axios.post(
      'https://api.apollo.io/api/v1/organizations/search',
      requestPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
          Accept: 'application/json',
        },
        timeout: 10_000,
      }
    );

    logger.info('Apollo company search completed', {
      status: response.status,
      domain: q_organization_domains,
      resultCount: response.data?.organizations?.length ?? 0,
      endpoint: 'organizations/search',
    });

    return res.json(response.data);
  } catch (error) {
    const httpStatus = error.response?.status;
    const apolloMessage = error.response?.data?.message ?? error.response?.data ?? error.message;

    logger.error('Apollo company search failed', {
      domain: q_organization_domains,
      status: httpStatus ?? 'N/A',
      message: apolloMessage,
      requestPayload: { q_organization_domains, page, per_page },
    });

    // Handle specific error cases
    if (httpStatus === 401 || httpStatus === 403) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid Apollo API key or insufficient permissions. Please check your APOLLO_API_KEY.',
      });
    }

    if (httpStatus === 422) {
      return res.status(422).json({
        error: 'Unprocessable Entity',
        message: 'Invalid request parameters. ' + JSON.stringify(apolloMessage),
      });
    }

    if (httpStatus === 429) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Apollo.io rate limit exceeded. Please try again later.',
      });
    }

    return res.status(500).json({
      error: 'Internal Server Error',
      message: apolloMessage || 'Failed to search companies',
    });
  }
});

// Register contact enrichment routes
app.use('/api/contact', contactRoutes);

// Register pipeline routes
app.use('/api/pipeline', pipelineRoutes);

module.exports = app;