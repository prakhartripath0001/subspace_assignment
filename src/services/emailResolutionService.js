/**
 * @file emailResolutionService.js
 * @description Stage 3: Email Resolution using Eazyreach API
 * Resolves LinkedIn profiles to verified work emails
 */

const axios = require('axios');
const logger = require('../utils/logger');
const EmailContact = require('../models/EmailContact');
const Contact = require('../models/Contact');
const config = require('../config');

class EmailResolutionService {
  constructor() {
    this.apiKey = config.EAZYREACH_API_KEY;
    this.baseUrl = config.EAZYREACH_API_BASE;
    this.timeout = config.REQUEST_TIMEOUT_MS;
  }

  /**
   * Resolve email for a single contact
   * @param {Contact} contact - Contact with LinkedIn URL
   * @returns {Promise<EmailContact>} Contact with verified email
   */
  async resolveEmail(contact) {
    if (!contact || !contact.linkedinUrl) {
      throw new Error('Contact with LinkedIn URL is required');
    }

    logger.info('Stage 3: Email Resolution Started', {
      contact: contact.name,
      linkedinUrl: contact.linkedinUrl,
    });

    try {
      // If no Eazyreach API key, return contact as-is (graceful degradation)
      if (!this.apiKey) {
        logger.warn(
          'EAZYREACH_API_KEY not configured. Skipping email resolution.',
          {
            contact: contact.name,
          }
        );

        const emailContact = EmailContact.fromContact(contact);
        emailContact.verificationSource = 'none';
        return emailContact;
      }

      const payload = {
        linkedin_url: contact.linkedinUrl,
        company_domain: contact.companyDomain,
      };

      logger.debug('Eazyreach Email Resolution Request', payload);

      const response = await axios.post(
        `${this.baseUrl}/email/resolve`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            Accept: 'application/json',
          },
          timeout: this.timeout,
        }
      );

      logger.info('Eazyreach Email Resolution Response', {
        status: response.status,
        emailFound: !!response.data?.email,
      });

      const emailContact = EmailContact.fromContact(contact);
      emailContact.email = response.data?.email || null;
      emailContact.emailVerified = response.data?.verified || false;
      emailContact.verificationSource = 'eazyreach';

      return emailContact;
    } catch (error) {
      logger.warn('Stage 3 Email Resolution Failed (Non-blocking)', {
        contact: contact.name,
        status: error.response?.status,
        message: error.message,
      });

      // Return contact without email (graceful degradation)
      const emailContact = EmailContact.fromContact(contact);
      emailContact.verificationSource = 'failed';
      return emailContact;
    }
  }

  /**
   * Resolve emails for multiple contacts (batch)
   * @param {Contact[]} contacts - Array of contacts with LinkedIn URLs
   * @returns {Promise<EmailContact[]>} Contacts with resolved emails
   */
  async resolveEmailsBatch(contacts) {
    logger.info('Stage 3 Batch: Resolving emails for contacts', {
      count: contacts.length,
    });

    const emailContacts = [];
    let successCount = 0;
    let failureCount = 0;

    for (const contact of contacts) {
      try {
        const emailContact = await this.resolveEmail(contact);
        emailContacts.push(emailContact);

        if (emailContact.email && emailContact.emailVerified) {
          successCount++;
        } else {
          failureCount++;
        }

        // Rate limiting
        await this.sleep(config.RATE_LIMIT_DELAY_MS);
      } catch (error) {
        failureCount++;
        logger.warn('Failed to resolve email for contact', {
          contact: contact.name,
          error: error.message,
        });

        // Add contact without email anyway (don't break pipeline)
        const emailContact = EmailContact.fromContact(contact);
        emailContacts.push(emailContact);
      }
    }

    logger.info('Stage 3 Batch Complete', {
      processedContacts: emailContacts.length,
      emailsResolved: successCount,
      noEmailFound: failureCount,
    });

    return emailContacts;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = EmailResolutionService;
