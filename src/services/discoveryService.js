'use strict';

/**
 * @file discoveryService.js
 * @description Discovers "lookalike" companies by querying the Apollo.io
 *   Organization Search API with a seed domain and returning a clean, deduplicated
 *   list of competitor/similar primary domains.
 *
 * Apollo.io API reference:
 *   POST https://api.apollo.io/api/v1/organizations/search
 *
 * Environment variables consumed:
 *   APOLLO_API_KEY   - required; your Apollo.io V1 API key
 *
 * Public API of this module:
 *   discoverCompanies(seedDomain, limit?) -> Promise<string[]>
 */

const axios = require('axios');
const logger = require('../utils/logger');

// --- Constants ----------------------------------------------------------------

/** Base URL for the Apollo.io V1 REST API. */
const APOLLO_API_BASE = 'https://api.apollo.io/api/v1';

/** Endpoint path for the Organization Search resource. */
const SEARCH_ENDPOINT = `${APOLLO_API_BASE}/organizations/search`;

/**
 * Default page size sent to Apollo.io.
 * Callers can override this per-invocation via the `limit` parameter.
 * Apollo's documented maximum for this endpoint is 100.
 */
const DEFAULT_PER_PAGE = 10;

// --- Apollo Response Shape (JSDoc only - for IDE assistance) ------------------

/**
 * @typedef {Object} ApolloOrganization
 * @property {string|null} primary_domain   - The canonical domain of the company,
 *                                            e.g. "stripe.com". May be null when
 *                                            Apollo lacks domain data for an org.
 * @property {string}      name             - Human-readable company name.
 * @property {string}      id               - Apollo's internal UUID for the org.
 * // ... Apollo returns ~50 more fields (industry, employee_count, etc.) that we
 * //     deliberately ignore to keep the output lean.
 */

/**
 * @typedef {Object} ApolloSearchResponse
 * @property {ApolloOrganization[]} organizations - Array of matched organisations.
 * @property {Object}               pagination    - Cursor / page metadata.
 * @property {number}               total_entries - Total results available server-side.
 */

// --- Core Service Function ----------------------------------------------------

/**
 * Discovers lookalike companies for a given seed domain via Apollo.io.
 *
 * Algorithm:
 *  1. POST to Apollo's Organization Search endpoint with the seed domain as the
 *     `q_organization_domains` query parameter.
 *  2. Receive an array of `ApolloOrganization` objects.
 *  3. Pluck only the `primary_domain` field from each object.
 *  4. Filter out entries where `primary_domain` is null, undefined, or empty.
 *  5. Deduplicate using a JavaScript Set (Apollo can return the same domain via
 *     multiple subsidiary/alias records).
 *  6. Return the clean flat array of unique domain strings.
 *
 * @param   {string}  seedDomain  The domain whose lookalikes you want to discover,
 *                                e.g. "stripe.com". Do NOT include "https://".
 * @param   {number}  [limit=10]  Number of results to request from Apollo.
 *                                Clamped to Apollo's max of 100.
 * @returns {Promise<string[]>}   Unique, non-empty domain strings.
 *
 * @example
 *   const domains = await discoverCompanies('stripe.com', 20);
 *   // -> ['braintreepayments.com', 'square.com', 'adyen.com', ...]
 */
async function discoverCompanies(seedDomain, limit = DEFAULT_PER_PAGE) {
  // --- Input guard ------------------------------------------------------------
  if (!seedDomain || typeof seedDomain !== 'string' || !seedDomain.trim()) {
    throw new TypeError(
      `discoverCompanies: seedDomain must be a non-empty string. Received: ${JSON.stringify(seedDomain)}`,
    );
  }

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    // Fail fast at call-time; do not leak missing-key info in HTTP responses.
    throw new Error(
      'discoverCompanies: APOLLO_API_KEY environment variable is not set.',
    );
  }

  // Apollo max is 100 per page; silently clamp to avoid a 400 error.
  const perPage = Math.min(Math.max(1, Number(limit) || DEFAULT_PER_PAGE), 100);

  // --- Build request payload --------------------------------------------------
  /**
   * Apollo Organisation Search request body.
   *
   * Key fields:
   *   api_key              - V1 auth mechanism (bearer tokens also supported but
   *                          V1 still accepts key-in-body for backward compat).
   *   q_organization_domains - Comma-separated domain string Apollo uses to find
   *                          organisations operating on or similar to this domain.
   *   per_page             - Result page size (1-100).
   *   page                 - 1-indexed page number (we only fetch page 1).
   */
  const requestPayload = {
    q_organization_domains: seedDomain.trim().toLowerCase(),
    per_page: perPage,
    page: 1,
  };

  logger.info('Apollo search initiated', {
    seedDomain: requestPayload.q_organization_domains,
    perPage,
  });

  // --- Network request --------------------------------------------------------
  try {
    const response = await axios.post(SEARCH_ENDPOINT, requestPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        Accept: 'application/json',
      },
      // 10-second timeout to prevent hanging the caller's request lifecycle
      timeout: 10_000,
    });

    // Log the HTTP status code for observability / audit trails.
    logger.info('Apollo search responded', {
      status: response.status,
      seedDomain: requestPayload.q_organization_domains,
    });

    // --- Data extraction ------------------------------------------------------
    /**
     * response.data  -> ApolloSearchResponse
     * response.data.organizations -> ApolloOrganization[]
     *
     * Defensive fallback to [] guards against:
     *   - Apollo returning a 200 with an empty body
     *   - Apollo omitting the `organizations` key when results are empty
     */
    const organisations = response.data?.organizations ?? [];

    if (!Array.isArray(organisations)) {
      logger.warn('Apollo returned an unexpected `organizations` shape', {
        receivedType: typeof organisations,
      });
      return [];
    }

    // --- Data cleaning pipeline -----------------------------------------------
    const uniqueDomains = [
      ...new Set(
        organisations
          // Step 1 – pluck only the primary_domain field
          .map((org) => org?.primary_domain)

          // Step 2 – remove null / undefined / empty-string values
          //   null    : Apollo has no domain data for this org
          //   undefined: malformed record missing the field altogether
          //   ''      : Apollo stored an empty string (rare but observed)
          .filter((domain) => domain != null && domain.trim() !== ''),
      ),
    ];

    logger.info('Apollo search complete', {
      seedDomain: requestPayload.q_organization_domains,
      rawCount: organisations.length,
      uniqueCount: uniqueDomains.length,
    });

    return uniqueDomains; // e.g. ['competitor1.com', 'competitor2.com']

    // --- Error handling -------------------------------------------------------
  } catch (err) {
    // axios wraps HTTP-level errors inside err.response when the server replied
    const httpStatus = err.response?.status;
    const apolloMessage = err.response?.data?.message ?? err.message;

    // --- Rate-limit handling (HTTP 429) -------------------------------------
    if (httpStatus === 429) {
      logger.warn('Apollo.io rate limit hit - backing off gracefully', {
        seedDomain,
        retryAfter: err.response?.headers?.['retry-after'] ?? 'unknown',
        apolloMessage,
      });
      // Return empty array rather than crashing the app; the caller can decide
      // whether to retry with exponential back-off or surface a user-facing message.
      return [];
    }

    // --- Authentication / authorisation errors ------------------------------
    if (httpStatus === 401 || httpStatus === 403) {
      logger.error('Apollo.io authentication failed - check APOLLO_API_KEY', {
        status: httpStatus,
        apolloMessage,
      });
      throw new Error(`Apollo authentication error (HTTP ${httpStatus}): ${apolloMessage}`);
    }

    // --- Timeout / network-level errors -------------------------------------
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      logger.error('Apollo.io request timed out', {
        seedDomain,
        timeoutMs: 10_000,
        errCode: err.code,
      });
      throw new Error(`Apollo request timed out after 10 seconds for domain: ${seedDomain}`);
    }

    // --- Unexpected / unclassified errors -----------------------------------
    logger.error('Unexpected error while querying Apollo.io', {
      seedDomain,
      status: httpStatus ?? 'N/A',
      apolloMessage,
      stack: err.stack,
    });

    // Re-throw so the calling layer (controller / route) can return an
    // appropriate HTTP 500 to the API consumer without swallowing the error.
    throw err;
  }
}

// --- Exports ------------------------------------------------------------------

class DiscoveryService {
  async discoverCompanies(seedDomain, limit) {
    return discoverCompanies(seedDomain, limit);
  }
}

module.exports = DiscoveryService;
module.exports.discoverCompanies = discoverCompanies;
