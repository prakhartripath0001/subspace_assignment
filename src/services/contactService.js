/**
 * @file contactService.js
 * @description Service for processing LinkedIn profiles.
 * 
 * NOTE: Full enrichment via Apollo.io /people/search requires a PAID plan.
 * This service extracts available data from LinkedIn URLs.
 *
 * Environment variables consumed:
 *   APOLLO_API_KEY   – required; your Apollo API key
 */

const axios = require('axios');
const logger = require('../utils/logger');

// ─── Constants ────────────────────────────────────────────────────────────────

const APOLLO_API_BASE = 'https://api.apollo.io/api/v1';

// ─── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Extracts LinkedIn handle/username from LinkedIn URL
 * @param {string} linkedinUrl - Full LinkedIn URL
 * @returns {string} - LinkedIn handle (e.g., "williamhgates")
 */
function extractLinkedInHandle(linkedinUrl) {
  const match = linkedinUrl.match(/linkedin\.com\/in\/([a-z0-9\-]+)/i);
  return match ? match[1] : null;
}

/**
 * Tries to find person details by searching Apollo's organization data
 * This is a workaround for the free plan limitation
 * @param {string} linkedinUrl - LinkedIn URL
 * @param {string} apiKey - Apollo API key
 */
async function enrichPersonViaCorporateSearch(linkedinUrl, apiKey) {
  const handle = extractLinkedInHandle(linkedinUrl);
  
  if (!handle) {
    throw new Error('Could not extract LinkedIn handle from URL');
  }

  logger.info('Attempting corporate search for person', {
    linkedinUrl,
    handle,
  });

  // Try searching with the LinkedIn handle - this searches across organizations
  try {
    const response = await axios.post(
      `${APOLLO_API_BASE}/organizations/search`,
      {
        q_keywords: handle,
        per_page: 10,
        page: 1,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
          Accept: 'application/json',
        },
        timeout: 10_000,
      }
    );

    logger.info('Corporate search responded', {
      status: response.status,
    });

    return {
      name: handle,
      linkedinUrl: linkedinUrl.trim(),
      searchHandle: handle,
      dataSource: 'linkedin_url_extraction',
      note: 'Full enrichment requires Apollo paid plan. This is basic LinkedIn data.',
    };
  } catch (err) {
    logger.warn('Corporate search failed, falling back to basic extraction', {
      error: err.message,
    });

    // Fallback: Return just the extracted data
    return {
      name: handle,
      title: 'N/A',
      company: 'N/A',
      email: null,
      linkedinUrl: linkedinUrl.trim(),
      linkedinHandle: handle,
      dataSource: 'linkedin_url_extraction_only',
      note: 'No enrichment available. Upgrade Apollo plan for /people/search access.',
    };
  }
}

// ─── Core Service Function ────────────────────────────────────────────────────

/**
 * Processes a LinkedIn profile for contact information.
 * 
 * NOTE: Full person enrichment requires Apollo PAID plan.
 * Free plan users get basic data extraction from LinkedIn URL.
 *
 * @param   {string}  linkedinUrl  LinkedIn profile URL
 * @returns {Promise<Object>}  Contact information
 *
 * @example
 *   const contact = await enrichPerson('https://www.linkedin.com/in/williamhgates');
 */
async function enrichPerson(linkedinUrl) {
  // ── Input guard ────────────────────────────────────────────────────────────
  if (!linkedinUrl || typeof linkedinUrl !== 'string' || !linkedinUrl.trim()) {
    throw new TypeError(
      `enrichPerson: linkedinUrl must be a non-empty string. Received: ${JSON.stringify(linkedinUrl)}`,
    );
  }

  if (!linkedinUrl.includes('linkedin.com')) {
    throw new TypeError(
      `enrichPerson: Invalid LinkedIn URL. Must contain 'linkedin.com'. Received: ${linkedinUrl}`,
    );
  }

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error(
      'enrichPerson: APOLLO_API_KEY environment variable is not set.',
    );
  }

  logger.info('LinkedIn profile processing initiated', {
    linkedinUrl: linkedinUrl.trim(),
  });

  // ── Debug: Print request details ───────────────────────────────────────────
  console.log('========== LINKEDIN PROFILE PROCESSING ==========');
  console.log('API KEY EXISTS:', !!apiKey);
  console.log('URL:', linkedinUrl.trim());
  console.log('==============================================');

  try {
    // Try full enrichment first (requires paid plan)
    // If it fails with 403, fall back to basic extraction
    const enrichedContact = await enrichPersonViaCorporateSearch(linkedinUrl, apiKey);

    logger.info('LinkedIn profile processing complete', {
      linkedinUrl: linkedinUrl.trim(),
      name: enrichedContact.name,
      dataSource: enrichedContact.dataSource,
    });

    return enrichedContact;
  } catch (err) {
    console.log('========== LINKEDIN PROCESSING ERROR ==========');
    console.log('STATUS:', err.response?.status);
    console.log(
      'RESPONSE BODY:',
      JSON.stringify(err.response?.data, null, 2)
    );
    console.log('ERROR MESSAGE:', err.message);
    console.log('==============================================');

    const httpStatus = err.response?.status;
    const apolloMessage = err.response?.data?.message ?? err.message;

    // ── Authentication / authorisation errors ──────────────────────────────
    if (httpStatus === 401 || httpStatus === 403) {
      logger.error('Apollo API error – check plan and API key', {
        status: httpStatus,
        apolloMessage,
      });

      // Check if it's the "not accessible" error
      if (apolloMessage.includes('not accessible') || apolloMessage.includes('free plan')) {
        throw new Error(
          `Apollo Plan Limitation: The /people/search endpoint requires a PAID Apollo plan. ` +
          `Your current plan only has access to basic organization search. ` +
          `Upgrade at https://app.apollo.io/pricing`,
        );
      }

      throw new Error(
        `Apollo API error (HTTP ${httpStatus}): ${apolloMessage}`,
      );
    }

    // ── Rate-limit handling (HTTP 429) ─────────────────────────────────────
    if (httpStatus === 429) {
      logger.warn('Apollo rate limit hit', {
        linkedinUrl,
        retryAfter: err.response?.headers?.['retry-after'] ?? 'unknown',
      });
      throw new Error('Apollo rate limit exceeded. Please try again later.');
    }

    // ── Timeout / network-level errors ─────────────────────────────────────
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      logger.error('Apollo request timed out', {
        linkedinUrl,
        timeoutMs: 10_000,
        errCode: err.code,
      });
      throw new Error(
        `Apollo request timed out after 10 seconds for: ${linkedinUrl}`,
      );
    }

    // ── Unexpected / unclassified errors ───────────────────────────────────
    logger.error('Unexpected error while processing LinkedIn profile', {
      linkedinUrl,
      status: httpStatus ?? 'N/A',
      apolloMessage,
      stack: err.stack,
    });

    throw err;
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  enrichPerson,
  extractLinkedInHandle,
};
