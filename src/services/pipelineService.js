/**
 * @file pipelineService.js
 * @description Orchestrates all 4 stages of the outreach pipeline
 */

const logger = require('../utils/logger');
const DiscoveryService = require('./discoveryService');
const ContactDiscoveryService = require('./contactDiscoveryService');
const EmailResolutionService = require('./emailResolutionService');
const OutreachService = require('./outreachService');

class PipelineService {
  constructor() {
    this.discoveryService = new DiscoveryService();
    this.contactDiscoveryService = new ContactDiscoveryService();
    this.emailResolutionService = new EmailResolutionService();
    this.outreachService = new OutreachService();
  }

  /**
   * Execute the complete outreach pipeline
   * @param {string} seedDomain - Initial company domain
   * @param {Object} options - Pipeline options
   * @returns {Promise<Object>} Pipeline execution result
   */
  async executePipeline(seedDomain, options = {}) {
    const startTime = Date.now();
    const result = {
      seedDomain,
      stages: {},
      summary: {
        success: false,
        totalTime: 0,
        companiesDiscovered: 0,
        contactsFound: 0,
        emailsResolved: 0,
        emailsSent: 0,
        errors: [],
      },
    };

    try {
      logger.info('=== OUTREACH PIPELINE STARTED ===', {
        seedDomain,
        dryRun: options.dryRun || false,
      });

      // ── Stage 1: Company Discovery ────────────────────────────────────────
      logger.info('\n[STAGE 1] COMPANY DISCOVERY');
      try {
        const companies = await this.discoveryService.discoverCompanies(
          seedDomain,
          options.companyLimit || 10
        );

        result.stages.companies = companies;
        result.summary.companiesDiscovered = companies.length;

        logger.info(`[OK] Stage 1 Complete: ${companies.length} companies discovered`);
        console.log(
          `\n[OK] Stage 1: Discovered ${companies.length} companies\n`
        );
      } catch (error) {
        result.summary.errors.push(`Stage 1 failed: ${error.message}`);
        logger.error('Stage 1 FAILED', error);
        throw error;
      }

      // ── Stage 2: Contact Discovery ────────────────────────────────────────
      logger.info('\n[STAGE 2] CONTACT DISCOVERY');
      try {
        const companies = result.stages.companies || [];
        const contacts = await this.contactDiscoveryService.discoverContactsBatch(
          companies
        );

        result.stages.contacts = contacts;
        result.summary.contactsFound = contacts.length;

        logger.info(`[OK] Stage 2 Complete: ${contacts.length} contacts found`);
        console.log(`\n[OK] Stage 2: Found ${contacts.length} contacts\n`);
      } catch (error) {
        result.summary.errors.push(`Stage 2 failed: ${error.message}`);
        logger.error('Stage 2 FAILED', error);
        // Continue with empty contacts array
        result.stages.contacts = [];
      }

      // ── Stage 3: Email Resolution ─────────────────────────────────────────
      logger.info('\n[STAGE 3] EMAIL RESOLUTION');
      try {
        const contacts = result.stages.contacts || [];
        const emailContacts = await this.emailResolutionService.resolveEmailsBatch(
          contacts
        );

        result.stages.emailContacts = emailContacts;
        result.summary.emailsResolved = emailContacts.filter(
          (c) => c.email && c.emailVerified
        ).length;

        logger.info(
          `[OK] Stage 3 Complete: ${result.summary.emailsResolved} emails resolved`
        );
        console.log(
          `\n[OK] Stage 3: Resolved ${result.summary.emailsResolved} verified emails\n`
        );
      } catch (error) {
        result.summary.errors.push(`Stage 3 failed: ${error.message}`);
        logger.error('Stage 3 FAILED', error);
        // Continue with unresolved contacts
        result.stages.emailContacts = result.stages.contacts || [];
      }

      // ── Safety Checkpoint ─────────────────────────────────────────────────
      if (!options.skipConfirmation) {
        const shouldProceed = await this.safetyCheckpoint(result.summary);
        if (!shouldProceed) {
          logger.info('Pipeline cancelled by user at safety checkpoint');
          result.summary.success = false;
          result.summary.cancelledByUser = true;
          return result;
        }
      }

      // ── Stage 4: Outreach ─────────────────────────────────────────────────
      logger.info('\n[STAGE 4] EMAIL OUTREACH');
      try {
        const emailContacts = result.stages.emailContacts || [];
        const emailResults = await this.outreachService.sendEmailsBatch(
          emailContacts
        );

        result.stages.emailResults = emailResults;
        result.summary.emailsSent = emailResults.filter(
          (r) => r.success
        ).length;

        logger.info(
          `[OK] Stage 4 Complete: ${result.summary.emailsSent} emails sent`
        );
        console.log(
          `\n[OK] Stage 4: Sent ${result.summary.emailsSent} outreach emails\n`
        );
      } catch (error) {
        result.summary.errors.push(`Stage 4 failed: ${error.message}`);
        logger.error('Stage 4 FAILED', error);
        result.stages.emailResults = [];
      }

      result.summary.success = true;
      result.summary.totalTime = Date.now() - startTime;

      logger.info('=== OUTREACH PIPELINE COMPLETED ===', result.summary);
      this.printFinalSummary(result);

      return result;
    } catch (error) {
      result.summary.success = false;
      result.summary.totalTime = Date.now() - startTime;

      logger.error('=== OUTREACH PIPELINE FAILED ===', {
        error: error.message,
        summary: result.summary,
      });

      throw error;
    }
  }

  /**
   * Safety checkpoint before sending emails
   * @param {Object} summary - Pipeline summary
   * @returns {Promise<boolean>} Whether user confirmed to proceed
   */
  async safetyCheckpoint(summary) {
    console.log('\n' + '='.repeat(60));
    console.log('[SAFETY] SAFETY CHECKPOINT - PLEASE REVIEW');
    console.log('='.repeat(60));

    console.log(`
PIPELINE SUMMARY:
   ├─ Companies Discovered: ${summary.companiesDiscovered}
   ├─ Contacts Found: ${summary.contactsFound}
   ├─ Emails Resolved: ${summary.emailsResolved}
   └─ Emails Ready to Send: ${summary.emailsResolved}

[WARNING] ACTION REQUIRED:
   This pipeline is about to send ${summary.emailsResolved} outreach emails.
   Once sent, emails cannot be recalled.

   Do you want to PROCEED? (yes/no)
    `);

    return await this.getUserConfirmation();
  }

  /**
   * Get user confirmation via CLI
   * @returns {Promise<boolean>}
   */
  getUserConfirmation() {
    return new Promise((resolve) => {
      const stdin = process.stdin;
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');

      process.stdout.write('Enter your choice: ');

      stdin.on('data', (char) => {
        char = char.toString().toLowerCase().trim();

        stdin.setRawMode(false);
        stdin.pause();

        const proceed = char === 'yes' || char === 'y';
        console.log(`\nYou entered: ${proceed ? 'YES - Proceeding' : 'NO - Cancelled'}\n`);
        resolve(proceed);
      });
    });
  }

  /**
   * Print final execution summary
   * @param {Object} result - Pipeline result
   */
  printFinalSummary(result) {
    const { summary, stages } = result;

    console.log('\n' + '='.repeat(60));
    console.log('[RESULTS] FINAL PIPELINE SUMMARY');
    console.log('='.repeat(60));

    console.log(`
[STATUS] Pipeline Status: ${summary.success ? 'SUCCESS' : 'FAILED'}
[TIME] Total Time: ${(summary.totalTime / 1000).toFixed(2)}s

RESULTS:
   ├─ Companies Discovered: ${summary.companiesDiscovered}
   ├─ Contacts Found: ${summary.contactsFound}
   ├─ Emails Resolved: ${summary.emailsResolved}
   └─ Emails Sent: ${summary.emailsSent}

${
  summary.errors.length > 0
    ? `[ERROR] Errors: ${summary.errors.length}\n   ${summary.errors.join('\n   ')}`
    : '[OK] No errors'
}

[LOG] Results saved to: logs/application.log
    `);

    console.log('='.repeat(60) + '\n');
  }
}

module.exports = PipelineService;
