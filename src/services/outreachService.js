/**
 * @file outreachService.js
 * @description Stage 4: Outreach - Send personalized emails via Brevo
 */

const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config');

class OutreachService {
  constructor() {
    this.apiKey = config.BREVO_API_KEY;
    this.baseUrl = config.BREVO_API_BASE;
    this.timeout = config.REQUEST_TIMEOUT_MS;
    this.senderEmail = process.env.SENDER_EMAIL || 'noreply@outreach.io';
    this.senderName = process.env.SENDER_NAME || 'Outreach Pipeline';
  }

  /**
   * Generate personalized email content
   * @param {EmailContact} contact - Contact with verified email
   * @returns {Object} Email content
   */
  generateEmailContent(contact) {
    const firstName = contact.name.split(' ')[0];

    const subject = `Connecting with ${contact.company} - Strategic Partnership`;

    const htmlContent = `
    <html>
      <body style="font-family: Arial, sans-serif; color: #333;">
        <p>Hi ${firstName},</p>
        
        <p>I've been impressed by what ${contact.company} is doing in the market, especially your focus on innovation and growth.</p>
        
        <p>As a ${contact.title} at ${contact.company}, I think there could be a great opportunity for us to connect and explore ways we might support your team's objectives.</p>
        
        <p>Would you be open to a brief 15-minute conversation this week? I'm confident we can add real value to what you're building.</p>
        
        <p>Looking forward to connecting!</p>
        
        <p>Best regards,<br/>
        The Outreach Team</p>
      </body>
    </html>
    `;

    return {
      subject,
      htmlContent,
    };
  }

  /**
   * Send email via Brevo
   * @param {EmailContact} contact - Contact with verified email
   * @returns {Promise<Object>} Email send result
   */
  async sendEmail(contact) {
    if (!contact || !contact.email) {
      throw new Error('Contact with verified email is required');
    }

    logger.info('Stage 4: Email Outreach Started', {
      contact: contact.name,
      email: contact.email,
      company: contact.company,
    });

    try {
      // If no Brevo API key, simulate sending (dry run)
      if (!this.apiKey) {
        logger.warn('BREVO_API_KEY not configured. Running in DRY RUN mode.', {
          contact: contact.name,
          email: contact.email,
        });

        return {
          success: true,
          messageId: `DRY_RUN_${Date.now()}`,
          email: contact.email,
          status: 'sent_dry_run',
          contact: contact.name,
        };
      }

      const emailContent = this.generateEmailContent(contact);

      const payload = {
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        to: [
          {
            email: contact.email,
            name: contact.name,
          },
        ],
        subject: emailContent.subject,
        htmlContent: emailContent.htmlContent,
        replyTo: {
          email: this.senderEmail,
        },
      };

      logger.debug('Brevo Email Send Request', {
        to: contact.email,
        subject: emailContent.subject,
      });

      const response = await axios.post(`${this.baseUrl}/smtp/email`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
          Accept: 'application/json',
        },
        timeout: this.timeout,
      });

      logger.info('Brevo Email Send Response', {
        status: response.status,
        messageId: response.data?.messageId,
      });

      return {
        success: true,
        messageId: response.data?.messageId,
        email: contact.email,
        status: 'sent',
        contact: contact.name,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Stage 4 Email Send Failed', {
        contact: contact.name,
        email: contact.email,
        status: error.response?.status,
        message: error.message,
      });

      return {
        success: false,
        email: contact.email,
        status: 'failed',
        contact: contact.name,
        error: error.message,
      };
    }
  }

  /**
   * Send emails to multiple contacts (batch)
   * @param {EmailContact[]} contacts - Contacts with verified emails
   * @returns {Promise<Object[]>} Email send results
   */
  async sendEmailsBatch(contacts) {
    logger.info('Stage 4 Batch: Sending emails to contacts', {
      count: contacts.length,
    });

    // Filter to only contacts with verified emails
    const readyContacts = contacts.filter((c) => c.email);

    if (readyContacts.length === 0) {
      logger.warn('No contacts with verified emails. Skipping outreach.', {
        totalContacts: contacts.length,
      });
      return [];
    }

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const contact of readyContacts) {
      try {
        const result = await this.sendEmail(contact);
        results.push(result);

        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }

        // Rate limiting
        await this.sleep(config.RATE_LIMIT_DELAY_MS);
      } catch (error) {
        failureCount++;
        logger.error('Failed to send email to contact', {
          contact: contact.name,
          error: error.message,
        });

        results.push({
          success: false,
          email: contact.email,
          status: 'failed',
          contact: contact.name,
          error: error.message,
        });
      }
    }

    logger.info('Stage 4 Batch Complete', {
      totalSent: readyContacts.length,
      successful: successCount,
      failed: failureCount,
    });

    return results;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = OutreachService;
