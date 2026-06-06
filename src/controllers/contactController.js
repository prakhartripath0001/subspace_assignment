/**
 * @file contactController.js
 * @description Controller for handling contact enrichment requests
 */

const { enrichPerson } = require('../services/contactService');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

// ─── Enrich Contact Endpoint ───────────────────────────────────────────────────

/**
 * POST /api/contact/enrich
 * Enriches a LinkedIn profile with contact information
 *
 * Body:
 *   - linkedinUrl (required): LinkedIn profile URL
 *   - saveToFile (optional): Save result to contacts.json file (default: false)
 */
async function enrichContact(req, res) {
  try {
    const { linkedinUrl, saveToFile = false } = req.body;

    // Validate required parameter
    if (!linkedinUrl || typeof linkedinUrl !== 'string' || !linkedinUrl.trim()) {
      return res.status(400).json({
        error: 'Bad Request',
        message:
          'Parameter "linkedinUrl" is required and must be a non-empty string.',
      });
    }

    logger.info('Contact enrichment request received', {
      linkedinUrl,
      saveToFile,
    });

    // Enrich the profile
    const enrichedContact = await enrichPerson(linkedinUrl);

    // Optionally save to file
    if (saveToFile) {
      await saveContactToFile(enrichedContact);
    }

    return res.status(200).json({
      success: true,
      data: enrichedContact,
      savedToFile: saveToFile,
    });
  } catch (error) {
    logger.error('Contact enrichment failed', {
      message: error.message,
    });

    // Handle specific error cases
    if (error.message.includes('Invalid LinkedIn URL')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message,
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
    }

    if (error.message.includes('rate limit')) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: error.message,
      });
    }

    if (error.message.includes('Plan Limitation')) {
      return res.status(402).json({
        error: 'Payment Required',
        message: error.message,
        upgradeUrl: 'https://app.apollo.io/pricing',
      });
    }

    if (error.message.includes('authentication')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message:
          'Invalid Apollo API key. Please check your APOLLO_API_KEY.',
      });
    }

    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to enrich contact',
    });
  }
}

// ─── Batch Enrich Contacts Endpoint ────────────────────────────────────────────

/**
 * POST /api/contact/enrich-batch
 * Enriches multiple LinkedIn profiles
 *
 * Body:
 *   - linkedinUrls (required): Array of LinkedIn URLs
 *   - saveToFile (optional): Save results to contacts.json file (default: false)
 */
async function enrichBatchContacts(req, res) {
  try {
    const { linkedinUrls = [], saveToFile = false } = req.body;

    // Validate input
    if (!Array.isArray(linkedinUrls) || linkedinUrls.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Parameter "linkedinUrls" must be a non-empty array.',
      });
    }

    logger.info('Batch contact enrichment request received', {
      count: linkedinUrls.length,
      saveToFile,
    });

    const enrichedContacts = [];
    const failedUrls = [];

    // Process each URL sequentially to avoid rate limits
    for (const linkedinUrl of linkedinUrls) {
      try {
        const enrichedContact = await enrichPerson(linkedinUrl);
        enrichedContacts.push({
          ...enrichedContact,
          status: 'success',
        });

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        failedUrls.push({
          url: linkedinUrl,
          error: error.message,
          status: 'failed',
        });
      }
    }

    // Optionally save to file
    if (saveToFile && enrichedContacts.length > 0) {
      await saveContactsToFile(enrichedContacts);
    }

    return res.status(200).json({
      success: true,
      totalProcessed: linkedinUrls.length,
      successCount: enrichedContacts.length,
      failureCount: failedUrls.length,
      data: enrichedContacts,
      failed: failedUrls,
      savedToFile: saveToFile && enrichedContacts.length > 0,
    });
  } catch (error) {
    logger.error('Batch contact enrichment failed', {
      message: error.message,
    });

    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to enrich contacts batch',
    });
  }
}

// ─── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Saves a single contact to contacts.json file
 */
async function saveContactToFile(contact) {
  try {
    const contactsPath = path.join(__dirname, '../../contacts.json');

    // Read existing contacts
    let contacts = [];
    try {
      const fileContent = await fs.readFile(contactsPath, 'utf-8');
      contacts = JSON.parse(fileContent);
    } catch (err) {
      // File doesn't exist or is invalid JSON, start with empty array
      contacts = [];
    }

    // Add new contact (avoid duplicates by email)
    const existingIndex = contacts.findIndex(
      (c) => c.email === contact.email,
    );
    if (existingIndex >= 0) {
      contacts[existingIndex] = contact;
    } else {
      contacts.push(contact);
    }

    // Write back to file
    await fs.writeFile(
      contactsPath,
      JSON.stringify(contacts, null, 2),
      'utf-8',
    );

    logger.info('Contact saved to file', {
      email: contact.email,
      filePath: contactsPath,
    });
  } catch (err) {
    logger.error('Failed to save contact to file', {
      error: err.message,
    });
    throw new Error(`Failed to save contact to file: ${err.message}`);
  }
}

/**
 * Saves multiple contacts to contacts.json file
 */
async function saveContactsToFile(contacts) {
  try {
    const contactsPath = path.join(__dirname, '../../contacts.json');

    // Read existing contacts
    let allContacts = [];
    try {
      const fileContent = await fs.readFile(contactsPath, 'utf-8');
      allContacts = JSON.parse(fileContent);
    } catch (err) {
      // File doesn't exist or is invalid JSON, start with empty array
      allContacts = [];
    }

    // Add new contacts (avoid duplicates by email)
    contacts.forEach((newContact) => {
      const existingIndex = allContacts.findIndex(
        (c) => c.email === newContact.email,
      );
      if (existingIndex >= 0) {
        allContacts[existingIndex] = newContact;
      } else {
        allContacts.push(newContact);
      }
    });

    // Write back to file
    await fs.writeFile(
      contactsPath,
      JSON.stringify(allContacts, null, 2),
      'utf-8',
    );

    logger.info('Contacts saved to file', {
      count: contacts.length,
      totalCount: allContacts.length,
      filePath: contactsPath,
    });
  } catch (err) {
    logger.error('Failed to save contacts to file', {
      error: err.message,
    });
    throw new Error(`Failed to save contacts to file: ${err.message}`);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  enrichContact,
  enrichBatchContacts,
};
