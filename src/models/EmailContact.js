/**
 * @class EmailContact
 * @description Represents a contact with verified email (Stage 3)
 */
class EmailContact {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || 'N/A';
    this.title = data.title || 'N/A';
    this.company = data.company || 'N/A';
    this.companyDomain = data.companyDomain || null;
    this.linkedinUrl = data.linkedinUrl || null;
    this.email = data.email || null;
    this.emailVerified = data.emailVerified || false;
    this.verificationSource = data.verificationSource || null; // 'eazyreach', 'manual', etc.
    this.emailSentAt = data.emailSentAt || null;
    this.emailSentStatus = data.emailSentStatus || null; // 'pending', 'sent', 'failed'
    this.campaignId = data.campaignId || null;
  }

  static fromContact(contact) {
    return new EmailContact({
      id: contact.id,
      name: contact.name,
      title: contact.title,
      company: contact.company,
      companyDomain: contact.companyDomain,
      linkedinUrl: contact.linkedinUrl,
      email: contact.email,
      emailVerified: contact.emailVerified,
    });
  }

  isReadyForOutreach() {
    return this.email && this.emailVerified && this.name && this.company;
  }

  toString() {
    return `${this.name} (${this.email}) at ${this.company}`;
  }
}

module.exports = EmailContact;
