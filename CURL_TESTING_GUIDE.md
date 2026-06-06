# CURL Testing Guide - Automated B2B Outreach Pipeline

Complete collection of curl commands to test all pipeline stages and API endpoints.

## Prerequisites

```bash
# Start the server
npm run server

# Keep server running in first terminal, use curl in another terminal
```

## 1. Health Check

### Test API is Running
```bash
curl http://localhost:3000
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "Automated B2B Outreach Pipeline API",
  "version": "2.0.0",
  "endpoints": {
    "discovery": "GET /discover?domain=google.com",
    "contact_enrichment": "POST /api/contact/enrich",
    "pipeline_execute": "POST /api/pipeline/execute"
  }
}
```

---

## 2. Stage 1: Company Discovery

### Discover Similar Companies
```bash
curl -X GET "http://localhost:3000/discover?domain=google.com&limit=10"
```

**With Variables:**
```bash
DOMAIN="microsoft.com"
LIMIT=5

curl -X GET "http://localhost:3000/discover?domain=${DOMAIN}&limit=${LIMIT}"
```

**Expected Response:**
```json
{
  "success": true,
  "seedDomain": "google.com",
  "count": 8,
  "companies": [
    {
      "id": "org_123",
      "name": "Microsoft",
      "domain": "microsoft.com",
      "primaryDomain": "microsoft.com",
      "website": "http://www.microsoft.com",
      "industry": "Technology",
      "employeeCount": 221000
    }
  ]
}
```

---

## 3. Stage 2: Contact Enrichment

### Enrich Single LinkedIn Profile
```bash
curl -X POST "http://localhost:3000/api/contact/enrich" \
  -H "Content-Type: application/json" \
  -d '{
    "linkedinUrl": "https://www.linkedin.com/in/satya-nadella/",
    "saveToFile": false
  }'
```

### Enrich Multiple Contacts (Batch)
```bash
curl -X POST "http://localhost:3000/api/contact/enrich-batch" \
  -H "Content-Type: application/json" \
  -d '{
    "linkedinUrls": [
      "https://www.linkedin.com/in/satya-nadella/",
      "https://www.linkedin.com/in/sundar-pichai/"
    ],
    "saveToFile": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "totalProcessed": 2,
  "successCount": 2,
  "failureCount": 0,
  "data": [
    {
      "name": "satya-nadella",
      "title": "N/A",
      "company": "N/A",
      "email": null,
      "linkedinUrl": "https://www.linkedin.com/in/satya-nadella/",
      "linkedinHandle": "satya-nadella",
      "dataSource": "linkedin_url_extraction_only"
    }
  ],
  "failed": [],
  "savedToFile": true
}
```

---

## 4. Full Pipeline Execution

### Execute Complete Pipeline with Confirmation
```bash
curl -X POST "http://localhost:3000/api/pipeline/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "seedDomain": "google.com",
    "companyLimit": 10,
    "skipConfirmation": false
  }'
```

### Execute Pipeline with Auto-Confirmation
```bash
curl -X POST "http://localhost:3000/api/pipeline/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "seedDomain": "microsoft.com",
    "companyLimit": 5,
    "skipConfirmation": true
  }'
```

### Execute Pipeline with Variables
```bash
SEED_DOMAIN="amazon.com"
COMPANY_LIMIT=8
SKIP_CONFIRMATION=true

curl -X POST "http://localhost:3000/api/pipeline/execute" \
  -H "Content-Type: application/json" \
  -d "{
    \"seedDomain\": \"${SEED_DOMAIN}\",
    \"companyLimit\": ${COMPANY_LIMIT},
    \"skipConfirmation\": ${SKIP_CONFIRMATION}
  }"
```

**Expected Response:**
```json
{
  "success": true,
  "pipelineId": "pipeline_1717689600000",
  "summary": {
    "success": true,
    "totalTime": 45230,
    "companiesDiscovered": 8,
    "contactsFound": 24,
    "emailsResolved": 18,
    "emailsSent": 18,
    "errors": []
  },
  "stages": {
    "companiesDiscovered": 8,
    "contactsFound": 24,
    "emailsResolved": 18,
    "emailsSent": 18
  }
}
```

---

## 5. Pipeline Preview (Without Sending Emails)

### Preview Pipeline Results
```bash
curl -X POST "http://localhost:3000/api/pipeline/preview" \
  -H "Content-Type: application/json" \
  -d '{
    "seedDomain": "google.com",
    "companyLimit": 10
  }'
```

### Preview with Different Domain
```bash
curl -X POST "http://localhost:3000/api/pipeline/preview" \
  -H "Content-Type: application/json" \
  -d '{
    "seedDomain": "salesforce.com",
    "companyLimit": 5
  }'
```

**Expected Response:**
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
  },
  "summary": {
    "companiesDiscovered": 8,
    "contactsFound": 24,
    "emailsResolved": 18
  }
}
```

---

## 6. Pipeline Status

### Get Specific Pipeline Status
```bash
PIPELINE_ID="pipeline_1717689600000"

curl "http://localhost:3000/api/pipeline/status/${PIPELINE_ID}"
```

### List All Active Pipelines
```bash
curl "http://localhost:3000/api/pipeline/list"
```

**Expected Response:**
```json
{
  "total": 3,
  "pipelines": [
    {
      "id": "pipeline_1717689600000",
      "seedDomain": "google.com",
      "status": "completed",
      "companiesDiscovered": 8,
      "contactsFound": 24,
      "emailsResolved": 18,
      "emailsSent": 18,
      "totalTime": "45.23s"
    }
  ]
}
```

---

## CLI Testing Commands

### Basic Execution
```bash
npm run pipeline -- google.com
```

### With Company Limit
```bash
npm run pipeline -- microsoft.com --company-limit 5
```

### Skip Confirmation
```bash
npm run pipeline -- amazon.com --skip-confirmation
```

### Dry Run (Test without sending emails)
```bash
npm run pipeline -- apple.com --dry-run
```

### All Options Combined
```bash
npm run pipeline -- salesforce.com --company-limit 8 --skip-confirmation --dry-run
```

---

## Advanced Testing Scenarios

### Scenario 1: Test Error Handling (Invalid Domain)
```bash
curl -X POST "http://localhost:3000/api/pipeline/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "seedDomain": "invalid..domain",
    "companyLimit": 10
  }'
```

**Expected Response:**
```json
{
  "error": "Pipeline Execution Failed",
  "message": "Invalid domain format"
}
```

### Scenario 2: Test Missing Required Field
```bash
curl -X POST "http://localhost:3000/api/pipeline/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "companyLimit": 10
  }'
```

**Expected Response:**
```json
{
  "error": "Bad Request",
  "message": "seedDomain is required and must be a string"
}
```

### Scenario 3: Test Batch Enrichment with Multiple Profiles
```bash
curl -X POST "http://localhost:3000/api/contact/enrich-batch" \
  -H "Content-Type: application/json" \
  -d '{
    "linkedinUrls": [
      "https://www.linkedin.com/in/satya-nadella/",
      "https://www.linkedin.com/in/sundar-pichai/",
      "https://www.linkedin.com/in/bill-gates/",
      "https://www.linkedin.com/in/steve-jobs/"
    ],
    "saveToFile": true
  }'
```

---

## Monitoring and Verification

### View Application Logs
```bash
tail -f logs/application.log
```

### Check Saved Contacts
```bash
cat contacts.json | jq '.' # Pretty print JSON
```

### Count Pipeline Executions
```bash
grep "OUTREACH PIPELINE COMPLETED" logs/application.log | wc -l
```

---

## Performance Testing

### Test with Large Company Limit
```bash
time curl -X POST "http://localhost:3000/api/pipeline/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "seedDomain": "google.com",
    "companyLimit": 50,
    "skipConfirmation": true
  }'
```

### Load Test Multiple Domains Sequentially
```bash
for domain in google.com microsoft.com amazon.com apple.com; do
  echo "Testing $domain..."
  curl -X POST "http://localhost:3000/api/pipeline/preview" \
    -H "Content-Type: application/json" \
    -d "{\"seedDomain\": \"$domain\", \"companyLimit\": 3}"
  echo "\n"
done
```

---

## Troubleshooting Curl Requests

### Pretty Print JSON Response
```bash
curl -s "http://localhost:3000" | jq '.'
```

### Show Response Headers
```bash
curl -i "http://localhost:3000"
```

### Show Request and Response
```bash
curl -v -X POST "http://localhost:3000/api/pipeline/execute" \
  -H "Content-Type: application/json" \
  -d '{"seedDomain":"google.com"}'
```

### Save Response to File
```bash
curl "http://localhost:3000/api/pipeline/preview" \
  -o response.json
```

### Test with Different Content-Type
```bash
curl -X POST "http://localhost:3000/api/pipeline/execute" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'seedDomain=google.com&companyLimit=10'
```

---

## Shell Script for Automated Testing

### Save as `test_pipeline.sh`
```bash
#!/bin/bash

echo "🧪 Testing Automated B2B Outreach Pipeline"
echo "==========================================="

# Test 1: Health Check
echo -e "\n✅ Test 1: Health Check"
curl -s http://localhost:3000 | jq '.status'

# Test 2: Company Discovery
echo -e "\n✅ Test 2: Company Discovery"
curl -s "http://localhost:3000/discover?domain=google.com&limit=3" | jq '.count'

# Test 3: Pipeline Preview
echo -e "\n✅ Test 3: Pipeline Preview"
curl -s -X POST "http://localhost:3000/api/pipeline/preview" \
  -H "Content-Type: application/json" \
  -d '{"seedDomain":"google.com","companyLimit":3}' | jq '.preview.companies | length'

# Test 4: List Pipelines
echo -e "\n✅ Test 4: List Active Pipelines"
curl -s "http://localhost:3000/api/pipeline/list" | jq '.total'

echo -e "\n✅ All tests completed!\n"
```

### Run Script
```bash
chmod +x test_pipeline.sh
./test_pipeline.sh
```

---

## Common Issues & Solutions

### Connection Refused
```bash
# Make sure server is running
npm run server

# Test connection
curl -v http://localhost:3000
```

### Invalid JSON Response
```bash
# Check server logs
tail -f logs/application.log

# Test with simpler request
curl http://localhost:3000
```

### Rate Limit Errors (429)
```bash
# Pipeline automatically handles rate limits with delays
# Monitor logs for retry attempts
grep "rate limit" logs/application.log
```

### Missing API Keys
```bash
# Verify .env file
cat .env | grep API_KEY

# Update with your actual keys
echo "APOLLO_API_KEY=your_key" >> .env
```

---

## Summary

Use these curl commands to test:
- ✅ API health and availability
- ✅ Company discovery functionality
- ✅ Contact enrichment
- ✅ Full pipeline execution
- ✅ Error handling and validation
- ✅ Pipeline status and history

For additional help or to report issues, check `logs/application.log`
