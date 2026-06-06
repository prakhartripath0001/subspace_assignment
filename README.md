# Subspace Assignment - Apollo.io Company Discovery API

A Node.js/Express server that integrates with the Apollo.io API to search for and discover companies by domain.

## Overview

This application provides REST endpoints to search for companies and discover lookalike competitors using the Apollo.io Organization Search API. It includes features like pagination, rate-limit handling, and comprehensive logging.

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Apollo.io API key (get one from [apollo.io](https://www.apollo.io))

## Installation

1. **Clone/navigate to the project directory:**
   ```bash
   cd subspace\ assignment
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create a `.env` file** with your Apollo API key:
   ```bash
   echo "APOLLO_API_KEY=your_api_key_here" > .env
   ```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```
APOLLO_API_KEY=your_apollo_io_api_key
PORT=3000
```

- **APOLLO_API_KEY** (required): Your Apollo.io API key for both company search and person enrichment
- **PORT** (optional): Server port, defaults to 3000

**Get Your API Key:**
- Apollo.io: [https://www.apollo.io/api-docs](https://www.apollo.io/api-docs)

## Running the Server

```bash
npm start
```

The server will start listening at `http://localhost:3000`

You'll see:
```
Server listening at http://localhost:3000
```

## API Endpoints

### 1. Health Check
```
GET /
```
Returns: `Hello World!`

### 2. Discover Companies (Simplified)
```
GET /discover?domain=<domain>&limit=<limit>
```

**Query Parameters:**
- `domain` (required): Company domain to search (e.g., `google.com`)
- `limit` (optional): Number of results, defaults to 10, max 100

**Response:**
```json
{
  "success": true,
  "seedDomain": "google.com",
  "count": 5,
  "companies": [
    "competitor1.com",
    "competitor2.com",
    "competitor3.com"
  ]
}
```

**Example:**
```bash
curl "http://localhost:3000/discover?domain=google.com&limit=10"
```

---

### 3. Company Search (Full Apollo Response)
```
POST /companies/search
```

**Parameters (Query String or JSON Body):**
- `q_organization_domains` (required): Domain to search (e.g., `google.com`)
- `page` (optional): Page number, defaults to 1
- `per_page` (optional): Results per page, defaults to 10, max 100

**Response:**
```json
{
  "organizations": [
    {
      "id": "54a22cb474657336060f0000",
      "name": "Alphabet Inc.",
      "primary_domain": "google.com",
      "website_url": "http://www.google.com"
    },
    {
      "id": "54a22e237465733606270b00",
      "name": "Microsoft",
      "primary_domain": "microsoft.com",
      "website_url": "http://www.microsoft.com"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 10,
    "total_entries": 1450
  }
}
```

**Examples:**

Using query parameters:
```bash
curl -X POST "http://localhost:3000/companies/search?q_organization_domains=google.com&page=1&per_page=10"
```

Using JSON body:
```bash
curl -X POST "http://localhost:3000/companies/search" \
  -H "Content-Type: application/json" \
  -d '{
    "q_organization_domains": "google.com",
    "page": 1,
    "per_page": 10
  }'
```

---

## Stage 02: LinkedIn Profile Enrichment (Apollo API)

### [IMPORTANT] Apollo Plan Requirements

The `/people/search` endpoint requires a **PAID Apollo.io plan**. 

**If you're on a FREE plan**, you'll get this error:
```json
{
  "error": "api/v1/people/search is not accessible with this api_key on a free plan",
  "upgradeUrl": "https://app.apollo.io/pricing"
}
```

**Solutions:**
1. **Upgrade your Apollo plan** to access person search: [https://app.apollo.io/pricing](https://app.apollo.io/pricing)
2. **Use free tier alternatives** - Extract LinkedIn handle from URL only (basic data extraction)

---

### 4. Enrich Single Contact
```
POST /api/contact/enrich
```

**Request Body:**
```json
{
  "linkedinUrl": "https://www.linkedin.com/in/williamhgates",
  "saveToFile": false
}
```

**Parameters:**
- `linkedinUrl` (required): Full LinkedIn profile URL
- `saveToFile` (optional): Save enriched contact to `contacts.json` file (default: false)

**Response (with PAID Apollo plan):**
```json
{
  "success": true,
  "data": {
    "name": "Bill Gates",
    "title": "Co-chair",
    "company": "Bill & Melinda Gates Foundation",
    "email": "bill.gates@gatesfoundation.org",
    "linkedinUrl": "https://www.linkedin.com/in/williamhgates"
  },
  "savedToFile": false
}
```

**Response (FREE Apollo plan - limited data):**
```json
{
  "success": true,
  "data": {
    "name": "williamhgates",
    "title": "N/A",
    "company": "N/A",
    "email": null,
    "linkedinUrl": "https://www.linkedin.com/in/williamhgates",
    "linkedinHandle": "williamhgates",
    "dataSource": "linkedin_url_extraction_only",
    "note": "No enrichment available. Upgrade Apollo plan for /people/search access."
  },
  "savedToFile": false
}
```

**Response (FREE plan - when upgrade is needed):**
```json
{
  "error": "Payment Required",
  "message": "Apollo Plan Limitation: The /people/search endpoint requires a PAID Apollo plan...",
  "upgradeUrl": "https://app.apollo.io/pricing"
}
```

**Examples:**

Basic enrichment:
```bash
curl -X POST "http://localhost:3000/api/contact/enrich" \
  -H "Content-Type: application/json" \
  -d '{
    "linkedinUrl": "https://www.linkedin.com/in/williamhgates"
  }'
```

Save to file:
```bash
curl -X POST "http://localhost:3000/api/contact/enrich" \
  -H "Content-Type: application/json" \
  -d '{
    "linkedinUrl": "https://www.linkedin.com/in/williamhgates",
    "saveToFile": true
  }'
```

---

### 5. Enrich Multiple Contacts (Batch)
```
POST /api/contact/enrich-batch
```

**Request Body:**
```json
{
  "linkedinUrls": [
    "https://www.linkedin.com/in/williamhgates",
    "https://www.linkedin.com/in/sundar-pichai"
  ],
  "saveToFile": true
}
```

**Parameters:**
- `linkedinUrls` (required): Array of LinkedIn profile URLs
- `saveToFile` (optional): Save all enriched contacts to `contacts.json` file (default: false)

**Response (PAID plan):**
```json
{
  "success": true,
  "totalProcessed": 2,
  "successCount": 2,
  "failureCount": 0,
  "data": [
    {
      "name": "Bill Gates",
      "title": "Co-chair",
      "company": "Bill & Melinda Gates Foundation",
      "email": "bill.gates@gatesfoundation.org",
      "linkedinUrl": "https://www.linkedin.com/in/williamhgates",
      "status": "success"
    }
  ],
  "failed": [],
  "savedToFile": true
}
```

**Notes:**
- Requests are processed sequentially with 500ms delays to avoid rate limiting
- Failed enrichments are returned in the `failed` array
- Contacts are automatically de-duplicated by email when saving to file
- **FREE plan users**: Will get basic LinkedIn handle extraction only

## Error Handling

The API returns appropriate HTTP status codes and error messages:

### 400 - Bad Request
Missing or invalid required parameters
```json
{
  "error": "Bad Request",
  "message": "Parameter \"q_organization_domains\" is required..."
}
```

### 401 - Unauthorized
Invalid or missing Apollo API key
```json
{
  "error": "Unauthorized",
  "message": "Invalid Apollo API key or insufficient permissions..."
}
```

### 422 - Unprocessable Entity
Invalid request parameters sent to Apollo
```json
{
  "error": "Unprocessable Entity",
  "message": "Invalid request parameters..."
}
```

### 429 - Too Many Requests
Apollo.io rate limit exceeded
```json
{
  "error": "Too Many Requests",
  "message": "Apollo.io rate limit exceeded. Please try again later."
}
```

### 500 - Internal Server Error
Server error or Apollo API error
```json
{
  "error": "Internal Server Error",
  "message": "Error details..."
}
```

## Testing

Run the test suite:
```bash
npm test
```

## Project Structure

```
subspace-assignment/
├── src/
│   ├── app.js                      # Express app configuration and routes
│   ├── server.js                   # Server entry point
│   ├── services/
│   │   ├── discoveryService.js     # Apollo API integration for company discovery
│   │   └── contactService.js       # Prospeo API integration for profile enrichment
│   ├── controllers/
│   │   └── contactController.js    # Request handlers for contact enrichment
│   ├── routes/
│   │   └── contactRoutes.js        # API routes for contact endpoints
│   └── utils/
│       ├── logger.js               # Winston logger setup
│       └── discoveryService.test.js# Tests
├── logs/                           # Application logs
├── .env                            # Environment variables (not in git)
├── contacts.json                   # Enriched contacts storage
├── package.json                    # Project dependencies
└── README.md                       # This file
```

## Key Features

- **Company Discovery** - Find lookalike companies via Apollo.io  
- **LinkedIn Profile Enrichment** - Extract contact info from LinkedIn via Apollo.io  
- **Single API Key** - Use one Apollo.io API key for all operations  
- **Batch Processing** - Enrich multiple profiles in one request  
- **File Storage** - Auto-save enriched contacts to JSON file  
- **Flexible Input** - Accept parameters via query string or JSON body  
- **Comprehensive Error Handling** - Meaningful error messages for all scenarios  
- **Rate Limit Handling** - Graceful backoff with sequential processing  
- **Structured Logging** - Full audit trail with Winston logger  
- **Pagination Support** - Handle large result sets  
- **Environment Management** - Secure API key configuration  
- **Input Validation** - Required parameter checking  
- **De-duplication** - Automatically prevent duplicate contacts by email  

## Dependencies

- **express** - Web framework
- **axios** - HTTP client for Apollo API calls
- **dotenv** - Environment variable management
- **winston** - Logging library
- **jest** - Testing framework

## Logging

The application uses Winston for structured logging. Logs are output to:
- Console (stdout)
- Log files in the `logs/` directory

Log levels: `error`, `warn`, `info`, `debug`

## API Rate Limits

Apollo.io has rate limits. When hitting rate limits (HTTP 429):
- The `/discover` endpoint returns an empty array
- The `/companies/search` endpoint returns a 429 status with retry information

Implement exponential backoff for production use.

## Apollo.io Plan Limitations

### What Works on FREE Plan
- [YES] Company Search (`/organizations/search`)
- [YES] Domain discovery
- [YES] Organization employee count
- [YES] Company website & info

### What Requires PAID Plan
- [NO] Person Search (`/people/search`)
- [NO] Individual contact enrichment
- [NO] Verified email addresses
- [NO] Job title & position details

### Workaround: Free Plan Usage

If you're on a **free Apollo plan** and need to extract LinkedIn data:

1. **Get the LinkedIn URL** from company employee lists
2. **Extract the handle** automatically (e.g., `williamhgates` from the URL)
3. **Store as basic contact** with "needs enrichment" flag
4. **Upgrade later** to add full person details

### How to Upgrade

Visit: [https://app.apollo.io/pricing](https://app.apollo.io/pricing)

**Recommended for contact enrichment:**
- Apollo Pro or higher
- Includes `/people/search` access
- Verified email database
- Job title & company data

---

## Troubleshooting

### "API is not accessible with this api_key on a free plan"
**Problem:** You're trying to use the `/people/search` endpoint on a FREE Apollo plan.

**Solution:**
1. Upgrade your Apollo plan: [https://app.apollo.io/pricing](https://app.apollo.io/pricing)
2. OR use company search endpoint which is free (works for finding employees, not individual details)

### "Invalid Apollo API key"
**Problem:** APOLLO_API_KEY is not set or is incorrect.

**Solution:**
- Verify `.env` file has valid API key
- Restart the server: `npm start`
- Check your key at [https://app.apollo.io/settings](https://app.apollo.io/settings)

### Rate limit exceeded (HTTP 429)
**Problem:** Too many requests to Apollo in a short time.

**Solution:**
- Wait a few minutes before retrying
- Use batch endpoints with delays between requests
- Check your API rate limit in Apollo settings

### No results returned
**Problem:** Profile not in Apollo's database.

**Solution:**
- LinkedIn profile might be private
- Profile may not be indexed yet
- Try a different LinkedIn URL
- Try finding employees through company search first

## License

ISC

## Support

For issues with the Apollo.io API, visit [Apollo Documentation](https://www.apollo.io/api-docs)

---

## Complete Workflow: Domain → Enriched Contacts

This application supports the full workflow from company domain to enriched contact information using **only Apollo.io API**:

```
Input: Company Domain
    ↓
[1] Apollo Company Search
    ├─ Find organizations by domain
    ├─ Get company info, website, employee count
    └─ Returns: Company details + decision makers info
    ↓
[2] Find Employee LinkedIn Profiles
    ├─ Extract LinkedIn URLs from company data
    └─ Returns: LinkedIn profile URLs
    ↓
[3] Apollo Person Enrichment
    ├─ Call /api/contact/enrich for each LinkedIn URL
    ├─ Extract contact information via Apollo.io
    └─ Returns: Name, Title, Company, Email, LinkedIn URL
    ↓
[4] Store in contacts.json
    ├─ Auto-save enriched contacts
    ├─ De-duplicate by email
    └─ Output: Verified contact database
    ↓
Output: Enriched Contacts with Apollo Data
```

### Example: Full Integration Flow

**Step 1: Search for companies in a domain**
```bash
curl -X POST "http://localhost:3000/companies/search?q_organization_domains=google.com&per_page=10"
```

**Step 2: For each decision maker found, get their LinkedIn URL** (from company data)
```
Example: https://www.linkedin.com/in/sundar-pichai/
```

**Step 3: Enrich multiple LinkedIn profiles**
```bash
curl -X POST "http://localhost:3000/api/contact/enrich-batch" \
  -H "Content-Type: application/json" \
  -d '{
    "linkedinUrls": [
      "https://www.linkedin.com/in/sundar-pichai",
      "https://www.linkedin.com/in/ruth-porat",
      "https://www.linkedin.com/in/philipp-schindler"
    ],
    "saveToFile": true
  }'
```

**Step 4: View enriched contacts**
```bash
cat contacts.json
```

Output:
```json
[
  {
    "name": "Sundar Pichai",
    "title": "Chief Executive Officer",
    "company": "Google",
    "email": "sundar@google.com",
    "linkedinUrl": "https://www.linkedin.com/in/sundar-pichai",
    "emailVerified": true,
    "status": "success"
  },
  {
    "name": "Ruth Porat",
    "title": "Chief Financial Officer",
    "company": "Google",
    "email": "ruth@google.com",
    "linkedinUrl": "https://www.linkedin.com/in/ruth-porat",
    "emailVerified": true,
    "status": "success"
  }
]
```

---

## Rate Limiting & Best Practices

### Apollo.io
- Default: 100-200 requests per minute (varies by plan)
- Automatic fallback to simpler queries on rate limit
- Returns empty array instead of crashing
- Batch operations with 500ms delays recommended

### Recommendations
1. Use batch endpoints for multiple profiles
2. Cache results to avoid re-querying
3. Implement request queuing for large datasets
4. Monitor logs for rate limit warnings
5. Set up alerts for API authentication failures
6. Process profiles sequentially with delays to respect rate limits
