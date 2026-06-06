/**
 * @file index.js
 * @description Main entry point - Can be used as Express server or CLI
 */

require('dotenv').config();
const logger = require('./utils/logger');
const PipelineService = require('./services/pipelineService');

/**
 * Check if being run as CLI or server
 */
const args = process.argv.slice(2);
const isCliMode = args.length > 0 && !args[0].startsWith('--server');

if (isCliMode) {
  // CLI Mode
  require('./cli');
} else {
  // Server Mode
  require('./server');
}
