/**
 * @file config.js
 * @description Configuration management for API keys and settings
 */

require('dotenv').config();
const logger = require('../utils/logger');

const config = {
  // API Keys
  APOLLO_API_KEY: process.env.APOLLO_API_KEY || '',
  PROSPEO_API_KEY: process.env.PROSPEO_API_KEY || '',
  EAZYREACH_API_KEY: process.env.EAZYREACH_API_KEY || '',
  EAZYREACH_CLIENT_ID: process.env.EAZYREACH_CLIENT_ID || '',
  EAZYREACH_CLIENT_SECRET: process.env.EAZYREACH_CLIENT_SECRET || '',
  BREVO_API_KEY: process.env.BREVO_API_KEY || '',

  // API Endpoints
  APOLLO_API_BASE: 'https://api.apollo.io/api/v1',
  PROSPEO_API_BASE: 'https://api.prospeo.io',
  EAZYREACH_API_BASE: 'https://api.eazyreach.io',
  BREVO_API_BASE: 'https://api.brevo.com/v3',

  // Settings
  PORT: process.env.PORT || 3000,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  NODE_ENV: process.env.NODE_ENV || 'development',
  RATE_LIMIT_DELAY_MS: 500, // Delay between API calls to respect rate limits
  REQUEST_TIMEOUT_MS: 10000,
  MAX_RETRIES: 3,

  // Pagination
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,

  // Feature flags
  ENABLE_EMAIL_SENDING: process.env.ENABLE_EMAIL_SENDING !== 'false',
  DRY_RUN: process.env.DRY_RUN === 'true',

  // Validate configuration
  validate() {
    const required = ['APOLLO_API_KEY'];
    const missing = required.filter((key) => !this[key]);

    if (missing.length > 0) {
      logger.error('Missing required environment variables:', missing);
      throw new Error(`Missing required API keys: ${missing.join(', ')}`);
    }

    logger.info('Configuration loaded successfully', {
      environment: this.NODE_ENV,
      apolloEnabled: !!this.APOLLO_API_KEY,
      prospeoEnabled: !!this.PROSPEO_API_KEY,
      eazyreachEnabled: !!this.EAZYREACH_API_KEY,
      brevoEnabled: !!this.BREVO_API_KEY,
    });
  },
};

// Validate on load
try {
  config.validate();
} catch (err) {
  console.error('[WARNING] Configuration Error:', err.message);
  console.error('Make sure .env file has required API keys');
}

module.exports = config;
