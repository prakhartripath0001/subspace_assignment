/**
 * @class Company
 * @description Represents a company discovered in Stage 1
 */
class Company {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || 'N/A';
    this.domain = data.domain || null;
    this.primaryDomain = data.primaryDomain || data.domain || null;
    this.website = data.website || data.website_url || null;
    this.industry = data.industry || 'N/A';
    this.employeeCount = data.employeeCount || data.employee_count || 0;
    this.founded = data.founded || null;
    this.location = data.location || 'N/A';
    this.description = data.description || null;
  }

  static fromApolloPerson(org) {
    return new Company({
      id: org.id,
      name: org.name,
      domain: org.primary_domain,
      primaryDomain: org.primary_domain,
      website: org.website_url,
      industry: org.industry,
      employeeCount: org.estimated_num_employees || 0,
    });
  }

  static fromOceanIO(org) {
    return new Company({
      id: org.id,
      name: org.name,
      domain: org.domain,
      primaryDomain: org.domain,
      website: org.url,
      industry: org.industry,
      employeeCount: org.employee_count || 0,
      founded: org.founded_year,
      location: org.location,
    });
  }

  isValid() {
    return this.domain && this.domain.trim().length > 0;
  }

  toString() {
    return `${this.name} (${this.domain})`;
  }
}

module.exports = Company;
