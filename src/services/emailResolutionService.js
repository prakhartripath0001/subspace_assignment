'use strict';

/**
 * @file emailResolutionService.js
 * @description Stage 3: Email Resolution using the Eazyreach API.
 *
 * Auth flow – OAuth 2.0 Client Credentials Grant:
 *   POST https://api.eazyreach.io/oauth/token
 *   Body: { client_id, client_secret, grant_type: 'client_credentials' }
 *   Response: { access_token, token_type, expires_in }
 *
 * Email resolution:
 *   POST https://api.eazyreach.io/v1/email/resolve
 *   Header: Authorization: Bearer <access_token>
 *   Body:   { linkedin_url: "https://www.linkedin.com/in/..." }
 *   Response: { email, verified, confidence, source }
 *
 * Environment variables consumed:
 *   EAZYREACH_CLIENT_ID     – OAuth client ID
 *   EAZYREACH_CLIENT_SECRET – OAuth client secret
 */

const axios = require('axios');
const logger = require('../utils/logger');
const EmailContact = require('../models/EmailContact');
const config = require('../config');

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Seconds before expiry at which we proactively refresh the token. */
const TOKEN_REFRESH_BUFFER_S = 60;

/** Max retries for the email-resolve endpoint on transient errors (5xx). */
const MAX_RETRIES = 2;

/** Milliseconds to wait between retries (exponential backoff base). */
const RETRY_BASE_DELAY_MS = 1_000;

// ─── Service ───────────────────────────────────────────────────────────────────

class EmailResolutionService {
  constructor() {
    this.clientId     = config.EAZYREACH_CLIENT_ID;
    this.clientSecret = config.EAZYREACH_CLIENT_SECRET;
    this.baseUrl      = config.EAZYREACH_API_BASE; // https://api.eazyreach.io
    this.timeout      = config.REQUEST_TIMEOUT_MS;

    // ── Token cache (in-process) ──────────────────────────────────────────────
    this._accessToken    = null;
    this._tokenExpiresAt = 0; // epoch ms
  }

  // ── Token Management ─────────────────────────────────────────────────────────

  /**
   * Returns a valid Bearer token, fetching a new one when needed.
   * Tokens are cached in-process with an automatic refresh buffer.
   *
   * @returns {Promise<string>} A valid access token.
   */
  async getAccessToken() {
    const now = Date.now();

    // Re-use cached token if still valid
    if (
      this._accessToken &&
      now < this._tokenExpiresAt - TOKEN_REFRESH_BUFFER_S * 1_000
    ) {
      logger.debug('Eazyreach: Using cached OAuth token');
      return this._accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        'Eazyreach credentials missing. Set EAZYREACH_CLIENT_ID and EAZYREACH_CLIENT_SECRET in .env'
      );
    }

    logger.info('Eazyreach: Fetching new OAuth token via client_credentials');

    const response = await axios.post(
      `${this.baseUrl}/oauth/token`,
      {
        client_id:     this.clientId,
        client_secret: this.clientSecret,
        grant_type:    'client_credentials',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept:         'application/json',
        },
        timeout: this.timeout,
      }
    );

    const { access_token, expires_in } = response.data;

    if (!access_token) {
      throw new Error(
        'Eazyreach OAuth token endpoint did not return access_token. Check your CLIENT_ID / CLIENT_SECRET.'
      );
    }

    // Cache the token; default TTL = 3600s if API omits expires_in
    this._accessToken    = access_token;
    this._tokenExpiresAt = now + (expires_in ?? 3_600) * 1_000;

    logger.info('Eazyreach: OAuth token obtained', {
      expiresInSeconds: expires_in ?? 3_600,
    });

    return this._accessToken;
  }

  /** Invalidate cached token (called on 401 responses). */
  _clearToken() {
    this._accessToken    = null;
    this._tokenExpiresAt = 0;
  }

  // ── Core Email Resolution ────────────────────────────────────────────────────

  /**
   * Calls the Eazyreach email-resolve endpoint with retry logic.
   *
   * @param {string} token      - Valid Bearer access token.
   * @param {string} linkedinUrl - LinkedIn profile URL to resolve.
   * @param {number} [attempt=0] - Internal retry counter.
   * @returns {Promise<Object>} Raw Eazyreach API response data.
   */
  async _callResolveEndpoint(token, linkedinUrl, attempt = 0) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/email/resolve`,
        { linkedin_url: linkedinUrl },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization:  `Bearer ${token}`,
            Accept:         'application/json',
          },
          timeout: this.timeout,
        }
      );

      return response.data;
    } catch (err) {
      const status = err.response?.status;

      // ── 401: Token expired mid-batch – clear cache and re-throw
      if (status === 401) {
        this._clearToken();
        logger.warn('Eazyreach: Received 401 – token cleared. Will refresh on next call.', {
          linkedinUrl,
        });
        throw err;
      }

      // ── 429: Rate limited – respect Retry-After header or use backoff
      if (status === 429) {
        const retryAfter = parseInt(err.response?.headers?.['retry-after'] ?? '2', 10) * 1_000;
        logger.warn('Eazyreach: Rate limited (429). Waiting before retry.', {
          linkedinUrl,
          waitMs: retryAfter,
        });
        await this.sleep(retryAfter);
        if (attempt < MAX_RETRIES) {
          return this._callResolveEndpoint(token, linkedinUrl, attempt + 1);
        }
        throw err;
      }

      // ── 5xx: Transient server errors – exponential backoff retry
      if (status >= 500 && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        logger.warn(`Eazyreach: Server error ${status}. Retrying in ${delay}ms...`, {
          linkedinUrl,
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
        });
        await this.sleep(delay);
        return this._callResolveEndpoint(token, linkedinUrl, attempt + 1);
      }

      throw err;
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Resolves a single contact's LinkedIn URL to a verified work email.
   *
   * @param {import('../models/Contact')} contact - Contact object with linkedinUrl.
   * @returns {Promise<EmailContact>} Contact enriched with email (or without if unresolvable).
   */
  async resolveEmail(contact) {
    if (!contact || !contact.linkedinUrl) {
      logger.warn('Stage 3: Skipping contact with no LinkedIn URL', {
        contact: contact?.name,
      });
      const fallback = EmailContact.fromContact(contact || {});
      fallback.verificationSource = 'skipped_no_linkedin';
      return fallback;
    }

    logger.info('Stage 3: Resolving email for contact', {
      contact:    contact.name,
      linkedinUrl: contact.linkedinUrl,
    });

    // ── Graceful degradation: no credentials configured ───────────────────────
    if (!this.clientId || !this.clientSecret) {
      logger.warn('Eazyreach credentials not configured – skipping email resolution.', {
        contact: contact.name,
        hint:    'Set EAZYREACH_CLIENT_ID + EAZYREACH_CLIENT_SECRET in .env',
      });
      const emailContact = EmailContact.fromContact(contact);
      emailContact.verificationSource = 'none';
      return emailContact;
    }

    try {
      // Step 1 – obtain a valid Bearer token
      const token = await this.getAccessToken();

      // Step 2 – resolve the LinkedIn URL to an email
      logger.debug('Eazyreach: Sending resolve request', {
        linkedinUrl: contact.linkedinUrl,
      });

      const data = await this._callResolveEndpoint(token, contact.linkedinUrl);

      logger.info('Eazyreach: Email resolved', {
        contact:    contact.name,
        emailFound: !!data?.email,
        verified:   data?.verified,
        confidence: data?.confidence,
        source:     data?.source,
      });

      // Step 3 – populate the EmailContact model
      const emailContact = EmailContact.fromContact(contact);
      emailContact.email              = data?.email    || null;
      emailContact.emailVerified      = data?.verified || false;
      emailContact.emailConfidence    = data?.confidence ?? null;
      emailContact.verificationSource = 'eazyreach';

      if (!emailContact.email) {
        logger.warn('Eazyreach: No email returned for contact', {
          contact:    contact.name,
          linkedinUrl: contact.linkedinUrl,
        });
      }

      return emailContact;
    } catch (error) {
      const status   = error.response?.status;
      const errBody  = error.response?.data;

      logger.warn('Stage 3: Email resolution failed (non-blocking)', {
        contact:     contact.name,
        linkedinUrl: contact.linkedinUrl,
        httpStatus:  status ?? 'N/A',
        message:     error.message,
        responseBody: errBody,
      });

      // Return the contact without an email so the pipeline continues
      const emailContact = EmailContact.fromContact(contact);
      emailContact.verificationSource = 'failed';
      return emailContact;
    }
  }

  /**
   * Resolves emails for a batch of contacts.
   * Pre-fetches the OAuth token once before the loop to minimize round-trips.
   *
   * @param {import('../models/Contact')[]} contacts
   * @returns {Promise<EmailContact[]>}
   */
  async resolveEmailsBatch(contacts) {
    logger.info('Stage 3 Batch: Resolving emails', { count: contacts.length });

    if (contacts.length === 0) {
      logger.warn('Stage 3 Batch: No contacts to resolve.');
      return [];
    }

    // Pre-warm the token for the whole batch
    if (this.clientId && this.clientSecret) {
      try {
        await this.getAccessToken();
        logger.info('Eazyreach: Token pre-warmed for batch');
      } catch (err) {
        logger.warn('Eazyreach: Pre-warm failed; will retry token per contact.', {
          error: err.message,
        });
      }
    }

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
      } catch (error) {
        failureCount++;
        logger.warn('Stage 3: Unexpected error for contact (skipping)', {
          contact: contact.name,
          error:   error.message,
        });
        // Push a blank EmailContact so the pipeline never loses the record
        const emailContact = EmailContact.fromContact(contact);
        emailContact.verificationSource = 'error';
        emailContacts.push(emailContact);
      }

      // Respect Eazyreach rate limits between calls
      await this.sleep(config.RATE_LIMIT_DELAY_MS);
    }

    logger.info('Stage 3 Batch Complete', {
      total:          emailContacts.length,
      emailsVerified: successCount,
      noEmail:        failureCount,
    });

    return emailContacts;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = EmailResolutionService;
