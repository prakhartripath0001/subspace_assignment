/**
 * @file contactDiscoveryService.js
 * @description Stage 2: Contact Discovery (Decision Makers)
 * Uses Apollo API's people search or basic LinkedIn extraction
 */

const axios = require('axios');
const logger = require('../utils/logger');
const Contact = require('../models/Contact');
const config = require('../config');

class ContactDiscoveryService {
  constructor() {
    this.apiKey = config.APOLLO_API_KEY;
    this.baseUrl = config.APOLLO_API_BASE;
    this.timeout = config.REQUEST_TIMEOUT_MS;
  }

  /**
   * Extract LinkedIn handle from LinkedIn URL
   * @param {string} linkedinUrl - Full LinkedIn URL
   * @returns {string} LinkedIn handle
   */
  extractLinkedInHandle(linkedinUrl) {
    if (!linkedinUrl) return null;
    const match = linkedinUrl.match(/linkedin\.com\/in\/([a-z0-9\-]+)/i);
    return match ? match[1] : null;
  }

  /**
   * Search for decision makers in a company
   * @param {Company} company - Company object from Stage 1
   * @returns {Promise<Contact[]>} Array of discovered contacts
   */
  async discoverContacts(company) {
    if (!company || !company.domain) {
      throw new Error('Company object with domain is required');
    }

    logger.info('Stage 2: Contact Discovery Started', {
      company: company.name,
      domain: company.domain,
    });

    try {
      const payload = {
        q_organization_domains: company.domain.trim().toLowerCase(),
        per_page: 5, // Limit to top decision makers
        page: 1,
      };

      logger.debug('Apollo Contact Search Request', payload);

      const response = await axios.post(
        `${this.baseUrl}/organizations/search`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.apiKey,
            Accept: 'application/json',
          },
          timeout: this.timeout,
        }
      );

      // Extract organizational data for contacts
      // Note: Full person enrichment requires paid plan
      // This extracts decision maker info if available in org data
      const org = response.data?.organizations?.[0];

      if (!org) {
        logger.warn('No organization found for domain', {
          domain: company.domain,
        });
        return [];
      }

      // Create contacts from organization leadership if available
      const contacts = [];
      
      // If we have founder/CEO info
      if (org.founder_name) {
        contacts.push(
          new Contact({
            name: org.founder_name,
            title: 'Founder/CEO',
            company: company.name,
            companyDomain: company.domain,
          })
        );
      }

      // If we have other leadership info
      const leadership = org.decision_makers || [];
      leadership.forEach((person) => {
        if (person.name && person.title) {
          contacts.push(
            new Contact({
              name: person.name,
              title: person.title,
              company: company.name,
              companyDomain: company.domain,
              linkedinUrl: person.linkedin_url,
            })
          );
        }
      });

      logger.info('Stage 2 Complete', {
        company: company.name,
        contactsFound: contacts.length,
      });

      return contacts;
    } catch (error) {
      logger.warn('Stage 2 Contact Discovery Failed (Non-blocking)', {
        company: company.name,
        message: error.message,
      });

      // Return empty array instead of throwing (graceful degradation)
      return [];
    }
  }

  /**
   * Discover contacts for multiple companies (batch)
   * @param {Company[]} companies - Array of company objects
   * @returns {Promise<Contact[]>} All discovered contacts
   */
  async discoverContactsBatch(companies) {
    logger.info('Stage 2 Batch: Discovering contacts for multiple companies', {
      count: companies.length,
    });

    const allContacts = [];
    let successCount = 0;
    let failureCount = 0;

    for (const company of companies) {
      try {
        const contacts = await this.discoverContacts(company);
        allContacts.push(...contacts);
        successCount++;

        // Rate limiting
        await this.sleep(config.RATE_LIMIT_DELAY_MS);
      } catch (error) {
        failureCount++;
        logger.warn('Failed to discover contacts for company', {
          company: company.name,
          error: error.message,
        });
      }
    }

    logger.info('Stage 2 Batch Complete', {
      processedCompanies: successCount,
      failedCompanies: failureCount,
      totalContacts: allContacts.length,
    });

    return allContacts;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = ContactDiscoveryService;
