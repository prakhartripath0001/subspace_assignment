# Automated B2B Outreach Pipeline

A production-ready Node.js/Express CLI and API application that automates the complete end-to-end B2B outreach workflow. Transform a single seed company domain into a personalized outreach campaign with zero human intervention.

## 🎯 Pipeline Overview

```
Input: google.com
   ↓
[Stage 1] Company Discovery (Apollo.io)
   └─→ Finds similar companies with matching firmographics
   ↓
[Stage 2] Contact Discovery (Decision Makers)
   └─→ Identifies C-suite, VP-level, Founder contacts
   ↓
[Stage 3] Email Resolution (LinkedIn Profile → Verified Email)
   └─→ Extracts and verifies work email addresses
   ↓
[Safety Checkpoint] User Confirmation Required
   └─→ Review summary before sending emails
   ↓
[Stage 4] Outreach (Brevo Email API)
   └─→ Send personalized pitch emails automatically
   ↓
Output: Verified campaign results + logs
```

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Configuration

Create a `.env` file with your API keys:

```env
# Required
APOLLO_API_KEY=your_apollo_api_key

# Optional (enable additional features)
PROSPEO_API_KEY=your_prospeo_api_key
EAZYREACH_API_KEY=your_eazyreach_api_key
BREVO_API_KEY=your_brevo_api_key

# Settings
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
SENDER_EMAIL=your-email@company.com
SENDER_NAME=Your Name
DRY_RUN=false
ENABLE_EMAIL_SENDING=true
```

### Running the Pipeline

#### As CLI (Recommended for Single Execution)

```bash
# Basic execution
npm run pipeline -- google.com

# With options
npm run pipeline -- microsoft.com --company-limit 5
npm run pipeline -- amazon.com --skip-confirmation
npm run pipeline -- apple.com --dry-run

# Direct node command
node src/cli.js <domain> [options]
```

#### As Express Server (API Mode)

```bash
npm run server
# Server runs on http://localhost:3000
```

## 📋 CLI Usage

### Basic Command

```bash
npm run pipeline -- <seed-domain> [options]
```

### Arguments

- `<seed-domain>` (required): The company domain to start discovery (e.g., `google.com`)

### Options

- `--company-limit N`: Maximum companies to discover (default: 10)
- `--skip-confirmation`: Skip safety checkpoint (use with caution)
- `--dry-run`: Simulate email sending without actually sending

### Examples

```bash
# Discover companies similar to Google
npm run pipeline -- google.com

# Limit to 5 companies
npm run pipeline -- microsoft.com --company-limit 5

# Skip confirmation (auto-proceed)
npm run pipeline -- amazon.com --skip-confirmation

# Test without sending emails
npm run pipeline -- apple.com --dry-run

# All options combined
npm run pipeline -- salesforce.com --company-limit 10 --dry-run
```

## 🌐 API Endpoints

### 1. Health Check
```
GET /
```

Response:
```json
{
  "status": "ok",
  "message": "Automated B2B Outreach Pipeline API",
  "version": "2.0.0",
  "endpoints": { ... }
}
```

### 2. Company Discovery (Stage 1 Only)
```
GET /discover?domain=google.com&limit=10
```

Response:
```json
{
  "success": true,
  "seedDomain": "google.com",
  "count": 8,
  "companies": [
    {
      "name": "Microsoft",
      "domain": "microsoft.com",
      "industry": "Technology",
      "employeeCount": 221000
    }
  ]
}
```

### 3. Execute Full Pipeline
```
POST /api/pipeline/execute
```

Request Body:
```json
{
  "seedDomain": "google.com",
  "companyLimit": 10,
  "skipConfirmation": false
}
```

Response:
```json
{
  "success": true,
  "pipelineId": "pipeline_1717689600000",
  "summary": {
    "companiesDiscovered": 8,
    "contactsFound": 24,
    "emailsResolved": 18,
    "emailsSent": 18,
    "totalTime": 45.23
  },
  "stages": {
    "companiesDiscovered": 8,
    "contactsFound": 24,
    "emailsResolved": 18,
    "emailsSent": 18
  }
}
```

### 4. Preview Pipeline (Without Sending Emails)
```
POST /api/pipeline/preview
```

Request Body:
```json
{
  "seedDomain": "google.com",
  "companyLimit": 10
}
```

Response:
```json
{
  "success": true,
  "preview": {
    "companies": [
      {
        "name": "Microsoft",
        "domain": "microsoft.com",
        "industry": "Technology",
        "employees": 221000
      }
    ],
    "contacts": [
      {
        "name": "Satya Nadella",
        "title": "CEO",
        "company": "Microsoft",
        "linkedinUrl": "https://www.linkedin.com/in/satya-nadella/"
      }
    ],
    "emailReady": [
      {
        "name": "Satya Nadella",
        "email": "satya.nadella@microsoft.com",
        "company": "Microsoft"
      }
    ]
  }
}
```

### 5. Get Pipeline Status
```
GET /api/pipeline/status/{pipelineId}
```

### 6. List Active Pipelines
```
GET /api/pipeline/list
```

## 🛡️ Safety Checkpoint

The pipeline includes a mandatory safety checkpoint **before sending any emails**:

```
============================================================
🛡️  SAFETY CHECKPOINT - PLEASE REVIEW
============================================================

📊 PIPELINE SUMMARY:
   ├─ Companies Discovered: 8
   ├─ Contacts Found: 24
   ├─ Emails Resolved: 18
   └─ Emails Ready to Send: 18

⚠️  ACTION REQUIRED:
   This pipeline is about to send 18 outreach emails.
   Once sent, emails cannot be recalled.

   Do you want to PROCEED? (yes/no)
```

User must type **yes** or **y** to proceed.

## 📊 Project Structure

```
src/
├── index.js                              # Main entry point (CLI/Server)
├── cli.js                                # CLI interface
├── server.js                             # Express server
├── app.js                                # Express app configuration
│
├── models/
│   ├── Company.js                        # Company data model
│   ├── Contact.js                        # Contact data model
│   └── EmailContact.js                   # Email-resolved contact model
│
├── services/
│   ├── discoveryService.js               # Stage 1: Company Discovery
│   ├── contactDiscoveryService.js        # Stage 2: Contact Discovery
│   ├── emailResolutionService.js         # Stage 3: Email Resolution
│   ├── outreachService.js                # Stage 4: Outreach/Email Sending
│   └── pipelineService.js                # Orchestrates all 4 stages
│
├── routes/
│   ├── contactRoutes.js                  # Contact enrichment routes
│   └── pipelineRoutes.js                 # Pipeline API routes
│
├── config/
│   └── index.js                          # Configuration management
│
└── utils/
    └── logger.js                         # Winston logging setup

logs/
└── application.log                       # Complete execution logs

.env                                      # API keys & settings
```

## 🔧 Configuration Details

### Environment Variables

```env
# Apollo.io (REQUIRED)
APOLLO_API_KEY=your_key_here              # For company and contact discovery

# Prospeo (Optional)
PROSPEO_API_KEY=your_key_here             # For decision-maker identification

# Eazyreach (Optional)
EAZYREACH_API_KEY=your_key_here           # For email verification

# Brevo (Optional)
BREVO_API_KEY=your_key_here               # For email sending

# Server Settings
PORT=3000                                 # API server port
NODE_ENV=development                      # Environment
LOG_LEVEL=info                            # Logging level

# Email Settings
SENDER_EMAIL=noreply@company.com          # From email address
SENDER_NAME=Outreach Team                 # From name

# Feature Flags
DRY_RUN=false                             # Test without side effects
ENABLE_EMAIL_SENDING=true                 # Enable/disable email sending
```

## 📝 Logging

All operations are logged to `logs/application.log`:

```
2026-06-06T10:30:45.123Z info: === OUTREACH PIPELINE STARTED ===
2026-06-06T10:30:45.234Z info: Stage 1: Company Discovery Started
2026-06-06T10:30:46.456Z info: Apollo Company Search Response
2026-06-06T10:30:46.567Z info: Stage 1 Complete
2026-06-06T10:30:47.678Z info: Stage 2: Contact Discovery Started
...
```

View logs in real-time:
```bash
tail -f logs/application.log
```

## ⚠️ Error Handling & Resilience

The pipeline implements comprehensive error handling:

- **Non-blocking failures**: Errors in one stage don't crash the pipeline
- **Graceful degradation**: Missing data continues to next stage
- **Rate limit handling**: Automatic delays between API calls
- **Retry logic**: Configurable retries for transient errors
- **Timeout protection**: All API calls have 10-second timeout

## 🧪 Testing the Pipeline

### 1. Test with Dry Run (No Emails Sent)
```bash
npm run pipeline -- google.com --dry-run
```

### 2. Test via API
```bash
# Start server
npm run server

# In another terminal, send request
curl -X POST http://localhost:3000/api/pipeline/preview \
  -H "Content-Type: application/json" \
  -d '{"seedDomain":"google.com","companyLimit":5}'
```

### 3. Test Individual Stages
```bash
# Just company discovery
curl "http://localhost:3000/discover?domain=google.com&limit=10"

# Individual contact enrichment
curl -X POST http://localhost:3000/api/contact/enrich \
  -H "Content-Type: application/json" \
  -d '{"linkedinUrl":"https://www.linkedin.com/in/satya-nadella/"}'
```

## 📊 Sample Output

### CLI Execution Output
```
╔═══════════════════════════════════════════════════════════╗
║    🚀 AUTOMATED B2B OUTREACH PIPELINE CLI 🚀             ║
║   Transform domains into personalized campaigns           ║
╚═══════════════════════════════════════════════════════════╝

✅ Stage 1: Discovered 8 companies

✅ Stage 2: Found 24 contacts

✅ Stage 3: Resolved 18 verified emails

🛡️  SAFETY CHECKPOINT - PLEASE REVIEW
   Companies Discovered: 8
   Contacts Found: 24
   Emails Ready: 18
   
   Do you want to PROCEED? (yes/no): yes

✅ Stage 4: Sent 18 outreach emails

============================================================
📈 FINAL PIPELINE SUMMARY
============================================================
✅ Pipeline Status: SUCCESS
⏱️  Total Time: 45.23s

📊 Results:
   ├─ Companies Discovered: 8
   ├─ Contacts Found: 24
   ├─ Emails Resolved: 18
   └─ Emails Sent: 18
```

## 🐛 Troubleshooting

### "Missing required API keys"
**Problem**: APOLLO_API_KEY not set in `.env`

**Solution**:
```bash
echo "APOLLO_API_KEY=your_key_here" >> .env
npm run pipeline -- google.com
```

### "HTTP 429 - Rate Limit Exceeded"
**Problem**: Too many API calls too quickly

**Solution**: Pipeline automatically adds 500ms delays. For frequent runs, upgrade API plan.

### "No contacts found for company"
**Problem**: Company has no decision-maker data in Apollo

**Solution**: Try different companies or use `--company-limit 20` to discover more

### "Emails not sending"
**Problem**: Brevo API key missing or invalid

**Solution**: 
```bash
# Test dry run first
npm run pipeline -- google.com --dry-run

# Check BREVO_API_KEY in .env
```

## 📚 API Documentation

Full API documentation available at:
- **OpenAPI/Swagger**: (Coming soon)
- **Postman Collection**: (Available in /docs)

## 🔗 Integration Points

### Stage 1: Company Discovery
- **Provider**: Apollo.io
- **Endpoint**: `/api/v1/organizations/search`
- **Auth**: X-Api-Key header

### Stage 2: Contact Discovery
- **Provider**: Apollo.io (with fallback)
- **Endpoint**: `/api/v1/organizations/search`
- **Data**: Decision-maker identification

### Stage 3: Email Resolution
- **Provider**: Eazyreach (optional)
- **Endpoint**: `/email/resolve`
- **Auth**: Bearer token

### Stage 4: Outreach
- **Provider**: Brevo
- **Endpoint**: `/v3/smtp/email`
- **Auth**: api-key header

## 📄 License

ISC

## 👨‍💻 Author

Prakhar Tripathi <gurawliprakhar@gmail.com>

## 🤝 Contributing

Contributions welcome! Please ensure:
- Code follows existing patterns
- Logging is comprehensive
- Error handling is graceful
- Documentation is updated

---

**Ready to automate your B2B outreach? Start with:**
```bash
npm install
npm run pipeline -- your-company.com
```
