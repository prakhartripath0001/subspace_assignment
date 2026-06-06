'use strict';

/**
 * @file outreachService.js
 * @description Stage 4: Personalized outreach via the Brevo Transactional Email API.
 *
 * Brevo API reference:
 *   POST https://api.brevo.com/v3/smtp/email
 *   Auth header: api-key: <BREVO_API_KEY>
 *
 * Environment variables consumed:
 *   BREVO_API_KEY         – required for live sends
 *   SENDER_EMAIL          – from address (must be a verified sender in Brevo)
 *   SENDER_NAME           – display name for the from address
 *   DRY_RUN               – "true" → logs email content but does NOT call Brevo
 *   ENABLE_EMAIL_SENDING  – "false" → same as DRY_RUN
 */

const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config');

// ─── Constants ─────────────────────────────────────────────────────────────────

const BREVO_SEND_URL = `${config.BREVO_API_BASE}/smtp/email`;

/** Max retries on transient Brevo server errors (5xx). */
const MAX_RETRIES = 2;

/** Base delay (ms) for exponential back-off on retries. */
const RETRY_BASE_MS = 1_000;

// ─── Email Template ─────────────────────────────────────────────────────────────

/**
 * Generates a rich personalized HTML email + plain-text fallback.
 *
 * @param {import('../models/EmailContact')} contact
 * @returns {{ subject: string, htmlContent: string, textContent: string }}
 */
function buildEmailContent(contact) {
  const firstName = (contact.name || 'there').split(' ')[0];
  const company   = contact.company  || 'your company';
  const title     = contact.title    || 'leader';

  const subject = `Quick question for you, ${firstName}`;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body  { margin: 0; padding: 0; background: #f4f6f8; font-family: Arial, sans-serif; color: #333; }
    .wrap { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,.08); overflow: hidden; }
    .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
              padding: 36px 40px; }
    .header h1 { margin: 0; color: #fff; font-size: 22px; font-weight: 600;
                 letter-spacing: -0.3px; }
    .header p  { margin: 6px 0 0; color: rgba(255,255,255,.75); font-size: 13px; }
    .body  { padding: 36px 40px; line-height: 1.7; font-size: 15px; }
    .body p { margin: 0 0 18px; }
    .cta   { display: inline-block; margin-top: 8px; padding: 14px 28px;
             background: #4F46E5; color: #fff !important; border-radius: 6px;
             text-decoration: none; font-weight: 600; font-size: 15px; }
    .footer { padding: 20px 40px; background: #f8f9fb;
              border-top: 1px solid #eaedf1; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>Automated B2B Outreach</h1>
      <p>Strategic Partnership Inquiry</p>
    </div>
    <div class="body">
      <p>Hi ${firstName},</p>

      <p>
        I came across <strong>${company}</strong> while researching innovative companies in
        your space, and I was genuinely impressed by what your team has been building.
      </p>

      <p>
        As a <strong>${title}</strong> at ${company}, you're probably juggling a lot — which
        is exactly why I wanted to reach out. We help companies like yours streamline their
        B2B outreach and close more pipeline without adding headcount.
      </p>

      <p>
        Would you be open to a <strong>15-minute call</strong> this week to explore if there's
        a fit? No pitch deck, just a quick conversation.
      </p>

      <a href="mailto:${config.SENDER_EMAIL || 'noreply@outreach.io'}?subject=Re: ${encodeURIComponent(subject)}"
         class="cta">Reply to Connect →</a>

      <p style="margin-top:28px;">
        Looking forward to hearing from you!<br><br>
        Best,<br>
        <strong>${config.SENDER_NAME || 'The Outreach Team'}</strong>
      </p>
    </div>
    <div class="footer">
      You received this email because we believe there's a potential fit between our
      offerings and ${company}'s goals. If this isn't relevant, simply ignore this message.
    </div>
  </div>
</body>
</html>`;

  const textContent =
    `Hi ${firstName},\n\n` +
    `I came across ${company} while researching companies in your space and was impressed ` +
    `by what your team has been building.\n\n` +
    `As a ${title} at ${company}, I think there could be a great opportunity for us to ` +
    `connect and explore how we might support your objectives.\n\n` +
    `Would you be open to a quick 15-minute call this week?\n\n` +
    `Best regards,\n${config.SENDER_NAME || 'The Outreach Team'}`;

  return { subject, htmlContent, textContent };
}

// ─── Service Class ─────────────────────────────────────────────────────────────

class OutreachService {
  constructor() {
    this.apiKey      = config.BREVO_API_KEY;
    this.timeout     = config.REQUEST_TIMEOUT_MS;
    this.senderEmail = process.env.SENDER_EMAIL || 'noreply@outreach.io';
    this.senderName  = process.env.SENDER_NAME  || 'Outreach Pipeline';

    // Dry-run mode: log email content but skip actual Brevo call
    this.dryRun = config.DRY_RUN || !config.ENABLE_EMAIL_SENDING;
  }

  // ── Core Send Logic ──────────────────────────────────────────────────────────

  /**
   * Calls the Brevo /smtp/email endpoint with retry on transient errors.
   *
   * @param {Object} payload  - Full Brevo request body.
   * @param {number} [attempt=0] - Internal retry counter.
   * @returns {Promise<Object>} Brevo API response data.
   */
  async _callBrevoApi(payload, attempt = 0) {
    try {
      const response = await axios.post(BREVO_SEND_URL, payload, {
        headers: {
          'Content-Type': 'application/json',
          'api-key':      this.apiKey,
          Accept:         'application/json',
        },
        timeout: this.timeout,
      });

      return response.data;
    } catch (err) {
      const status  = err.response?.status;
      const errBody = err.response?.data;

      // ── 401/403: Bad API key – no point retrying ───────────────────────────
      if (status === 401 || status === 403) {
        logger.error('Brevo: Authentication failed – check BREVO_API_KEY', {
          status,
          body: errBody,
        });
        throw new Error(
          `Brevo authentication error (HTTP ${status}). ` +
          `Ensure BREVO_API_KEY is correct and the sender email is verified in Brevo.`
        );
      }

      // ── 400: Bad request (invalid payload, unverified sender, etc.) ────────
      if (status === 400) {
        const msg = errBody?.message || JSON.stringify(errBody);
        logger.error('Brevo: Bad request', { status, message: msg, payload });
        throw new Error(`Brevo bad request (HTTP 400): ${msg}`);
      }

      // ── 429: Rate limited ──────────────────────────────────────────────────
      if (status === 429) {
        const retryAfterMs =
          parseInt(err.response?.headers?.['retry-after'] ?? '2', 10) * 1_000;
        logger.warn('Brevo: Rate limited (429). Waiting before retry.', {
          waitMs: retryAfterMs,
          attempt,
        });
        await this.sleep(retryAfterMs);
        if (attempt < MAX_RETRIES) {
          return this._callBrevoApi(payload, attempt + 1);
        }
        throw err;
      }

      // ── 5xx: Transient – exponential back-off ──────────────────────────────
      if (status >= 500 && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt);
        logger.warn(`Brevo: Server error ${status}. Retrying in ${delay}ms…`, {
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
        });
        await this.sleep(delay);
        return this._callBrevoApi(payload, attempt + 1);
      }

      throw err;
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Sends one personalized outreach email via Brevo.
   *
   * @param {import('../models/EmailContact')} contact
   * @returns {Promise<{
   *   success: boolean,
   *   messageId: string|null,
   *   email: string,
   *   contact: string,
   *   company: string,
   *   status: string,
   *   sentAt: string|null,
   *   error: string|null
   * }>}
   */
  async sendEmail(contact) {
    if (!contact || !contact.email) {
      logger.warn('Stage 4: Skipping contact with no email', {
        contact: contact?.name,
      });
      return {
        success:   false,
        messageId: null,
        email:     contact?.email || null,
        contact:   contact?.name  || 'unknown',
        company:   contact?.company || 'unknown',
        status:    'skipped_no_email',
        sentAt:    null,
        error:     'No email address available',
      };
    }

    logger.info('Stage 4: Sending outreach email', {
      contact: contact.name,
      email:   contact.email,
      company: contact.company,
      title:   contact.title,
      dryRun:  this.dryRun,
    });

    const { subject, htmlContent, textContent } = buildEmailContent(contact);

    // ── Dry-run mode (no Brevo key or DRY_RUN=true) ──────────────────────────
    if (this.dryRun || !this.apiKey) {
      logger.info('Brevo: DRY RUN – email NOT sent', {
        to:      contact.email,
        subject,
        mode:    !this.apiKey ? 'no_api_key' : 'dry_run_flag',
      });
      return {
        success:   true,
        messageId: `DRY_RUN_${Date.now()}`,
        email:     contact.email,
        contact:   contact.name,
        company:   contact.company,
        status:    'dry_run',
        sentAt:    new Date().toISOString(),
        error:     null,
      };
    }

    // ── Build the Brevo payload ───────────────────────────────────────────────
    const payload = {
      sender: {
        name:  this.senderName,
        email: this.senderEmail,
      },
      to: [
        {
          email: contact.email,
          name:  contact.name,
        },
      ],
      replyTo: {
        email: this.senderEmail,
        name:  this.senderName,
      },
      subject,
      htmlContent,
      textContent,
      // Custom headers to help identify pipeline-generated mails
      headers: {
        'X-Outreach-Pipeline': 'automated-b2b',
        'X-Contact-Company':   contact.company || '',
      },
    };

    logger.debug('Brevo: Request payload', {
      to:      contact.email,
      subject,
      sender:  this.senderEmail,
    });

    try {
      const data = await this._callBrevoApi(payload);

      logger.info('Brevo: Email sent successfully', {
        contact:   contact.name,
        email:     contact.email,
        messageId: data?.messageId,
      });

      return {
        success:   true,
        messageId: data?.messageId || null,
        email:     contact.email,
        contact:   contact.name,
        company:   contact.company,
        status:    'sent',
        sentAt:    new Date().toISOString(),
        error:     null,
      };
    } catch (error) {
      logger.error('Stage 4: Email send failed', {
        contact:    contact.name,
        email:      contact.email,
        httpStatus: error.response?.status ?? 'N/A',
        message:    error.message,
      });

      return {
        success:   false,
        messageId: null,
        email:     contact.email,
        contact:   contact.name,
        company:   contact.company,
        status:    'failed',
        sentAt:    null,
        error:     error.message,
      };
    }
  }

  /**
   * Sends outreach emails to a batch of contacts.
   * Skips contacts without a verified email.
   *
   * @param {import('../models/EmailContact')[]} contacts
   * @returns {Promise<Object[]>} Per-contact send results.
   */
  async sendEmailsBatch(contacts) {
    logger.info('Stage 4 Batch: Starting outreach', {
      totalContacts: contacts.length,
      dryRun:        this.dryRun,
    });

    // Only send to contacts that have an email address
    const readyContacts = contacts.filter((c) => c.email);
    const skippedCount  = contacts.length - readyContacts.length;

    if (skippedCount > 0) {
      logger.warn(`Stage 4: Skipping ${skippedCount} contact(s) with no email.`);
    }

    if (readyContacts.length === 0) {
      logger.warn('Stage 4: No contacts with emails. Outreach skipped entirely.');
      return [];
    }

    const results      = [];
    let successCount   = 0;
    let failureCount   = 0;
    let dryRunCount    = 0;

    for (const contact of readyContacts) {
      const result = await this.sendEmail(contact);
      results.push(result);

      if (result.status === 'dry_run') {
        dryRunCount++;
      } else if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }

      // Respect Brevo's rate limits (300 req/min on free plan)
      await this.sleep(config.RATE_LIMIT_DELAY_MS);
    }

    logger.info('Stage 4 Batch Complete', {
      total:      readyContacts.length,
      sent:       successCount,
      dryRun:     dryRunCount,
      failed:     failureCount,
      skipped:    skippedCount,
    });

    return results;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = OutreachService;
