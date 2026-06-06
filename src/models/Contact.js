/**
 * @class Contact
 * @description Represents a contact discovered in Stage 2
 */
class Contact {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || 'N/A';
    this.title = data.title || 'N/A';
    this.company = data.company || 'N/A';
    this.companyDomain = data.companyDomain || null;
    this.linkedinUrl = data.linkedinUrl || null;
    this.linkedinHandle = data.linkedinHandle || null;
    this.email = data.email || null;
    this.phone = data.phone || null;
    this.discovered = data.discovered || true;
    this.emailVerified = data.emailVerified || false;
  }

  static fromProspeo(person) {
    return new Contact({
      id: person.id,
      name: person.name,
      title: person.title,
      company: person.company,
      companyDomain: person.company_domain,
      linkedinUrl: person.linkedin_url,
      linkedinHandle: person.linkedin_handle,
    });
  }

  isDecisionMaker() {
    const titles = (this.title || '').toLowerCase();
    return /ceo|cfo|cto|founder|executive|vp|chief|director|president/i.test(titles);
  }

  isValid() {
    return this.name && this.linkedinUrl;
  }

  toString() {
    return `${this.name} - ${this.title} at ${this.company}`;
  }
}

module.exports = Contact;
