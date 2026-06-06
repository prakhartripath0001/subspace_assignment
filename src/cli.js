#!/usr/bin/env node

/**
 * @file cli.js
 * @description Command Line Interface for the Outreach Pipeline
 * Usage: node src/cli.js <seed-domain> [options]
 */

require('dotenv').config();
const logger = require('./utils/logger');
const PipelineService = require('./services/pipelineService');

const args = process.argv.slice(2);

async function main() {
  // Display banner
  displayBanner();

  // Validate input
  if (args.length === 0) {
    console.error('\n[ERROR] No seed domain provided');
    displayUsage();
    process.exit(1);
  }

  const seedDomain = args[0];
  const options = parseOptions(args);

  // Validate domain format
  if (!isValidDomain(seedDomain)) {
    console.error(`\n[ERROR] Invalid domain format: ${seedDomain}`);
    console.error('Please provide a valid domain (e.g., google.com, microsoft.com)');
    process.exit(1);
  }

  try {
    logger.info('CLI Pipeline Execution Started', {
      seedDomain,
      options,
    });

    const pipelineService = new PipelineService();
    const result = await pipelineService.executePipeline(seedDomain, options);

    if (!result.summary.success && !result.summary.cancelledByUser) {
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    logger.error('CLI Pipeline Execution Failed', {
      error: error.message,
      stack: error.stack,
    });

    console.error(`\n[ERROR] Fatal Error: ${error.message}`);
    console.error('Check logs/application.log for details');

    process.exit(1);
  }
}

/**
 * Display application banner
 */
function displayBanner() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     AUTOMATED B2B OUTREACH PIPELINE CLI                  ║
║                                                           ║
║      Transform domains into personalized campaigns       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
}

/**
 * Display usage information
 */
function displayUsage() {
  console.log(`
Usage: node src/cli.js <seed-domain> [options]

Arguments:
  <seed-domain>          The company domain to start discovery (e.g., google.com)

Options:
  --company-limit N      Maximum companies to discover (default: 10)
  --skip-confirmation    Skip safety checkpoint (use with caution)
  --dry-run              Simulate email sending without actually sending

Examples:
  node src/cli.js google.com
  node src/cli.js microsoft.com --company-limit 5
  node src/cli.js amazon.com --skip-confirmation
  node src/cli.js apple.com --dry-run

Output:
  All results and logs are saved to logs/application.log
    `);
}

/**
 * Parse CLI options
 * @param {string[]} args - CLI arguments
 * @returns {Object} Parsed options
 */
function parseOptions(args) {
  const options = {
    companyLimit: 10,
    skipConfirmation: false,
    dryRun: false,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--company-limit' && args[i + 1]) {
      options.companyLimit = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--skip-confirmation') {
      options.skipConfirmation = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

/**
 * Validate domain format
 * @param {string} domain
 * @returns {boolean}
 */
function isValidDomain(domain) {
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(domain);
}

// Run CLI
if (require.main === module) {
  main().catch((error) => {
    logger.error('Unhandled CLI Error', error);
    process.exit(1);
  });
}

module.exports = { main, parseOptions, isValidDomain };
