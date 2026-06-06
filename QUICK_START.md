# Quick Start - Copy & Paste Curl Commands

## Start the Server

```bash
npm install
npm run server
```

Server will run on `http://localhost:3000`

---

## Test 1: Health Check (Verify Server Running)

```bash
curl http://localhost:3000
```

**Expected Response:** API status `ok`

---

## Test 2: Discover Similar Companies

```bash
curl "http://localhost:3000/discover?domain=google.com&limit=10"
```

**What it does:** Finds 10 companies similar to Google

---

## Test 3: Preview Pipeline (No Emails Sent)

```bash
curl -X POST "http://localhost:3000/api/pipeline/preview" \
  -H "Content-Type: application/json" \
  -d '{
    "seedDomain": "google.com",
    "companyLimit": 5
  }'
```

**What it does:** Shows what the full pipeline would do without sending emails

---

## Test 4: Execute Full Pipeline

### Method A: Skip Safety Checkpoint
```bash
curl -X POST "http://localhost:3000/api/pipeline/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "seedDomain": "microsoft.com",
    "companyLimit": 10,
    "skipConfirmation": true
  }'
```

### Method B: With Safety Checkpoint (Requires User Input)
Run via CLI instead:
```bash
npm run pipeline -- microsoft.com --company-limit 10
```

---

## Test 5: Enrich Single LinkedIn Profile

```bash
curl -X POST "http://localhost:3000/api/contact/enrich" \
  -H "Content-Type: application/json" \
  -d '{
    "linkedinUrl": "https://www.linkedin.com/in/satya-nadella/",
    "saveToFile": true
  }'
```

**What it does:** Extracts contact info from LinkedIn profile

---

## Test 6: Enrich Multiple Profiles

```bash
curl -X POST "http://localhost:3000/api/contact/enrich-batch" \
  -H "Content-Type: application/json" \
  -d '{
    "linkedinUrls": [
      "https://www.linkedin.com/in/satya-nadella/",
      "https://www.linkedin.com/in/sundar-pichai/",
      "https://www.linkedin.com/in/bill-gates/"
    ],
    "saveToFile": true
  }'
```

**What it does:** Enriches 3 profiles and saves to contacts.json

---

## Test 7: List All Pipelines

```bash
curl "http://localhost:3000/api/pipeline/list"
```

**What it does:** Shows all pipeline executions and results

---

## CLI Commands (Recommended for Full Pipeline)

### Basic: Discover from domain
```bash
npm run pipeline -- google.com
```

### Limit companies discovered
```bash
npm run pipeline -- microsoft.com --company-limit 5
```

### Auto-confirm (skip safety check)
```bash
npm run pipeline -- amazon.com --skip-confirmation
```

### Test without sending emails
```bash
npm run pipeline -- apple.com --dry-run
```

---

## View Results

### Check saved contacts
```bash
cat contacts.json | jq '.'
```

### View application logs
```bash
tail -f logs/application.log
```

### Count successful pipelines
```bash
grep "PIPELINE COMPLETED" logs/application.log | wc -l
```

---

## Common Workflows

### Workflow 1: Complete Automation (No User Input)
```bash
npm run pipeline -- google.com --skip-confirmation
```

### Workflow 2: Preview Before Sending (Recommended)
```bash
# First preview
curl -X POST "http://localhost:3000/api/pipeline/preview" \
  -H "Content-Type: application/json" \
  -d '{"seedDomain":"google.com","companyLimit":10}'

# Then execute with confirmation
npm run pipeline -- google.com --company-limit 10
```

### Workflow 3: Test Pipeline Safely (Dry Run)
```bash
npm run pipeline -- google.com --dry-run
```

### Workflow 4: Batch Multiple Domains
```bash
for domain in google.com microsoft.com amazon.com; do
  npm run pipeline -- $domain --skip-confirmation
done
```

---

## Safety Checkpoint

When you run the full pipeline via CLI, you'll see:

```
============================================================
SAFETY CHECKPOINT - PLEASE REVIEW
============================================================

PIPELINE SUMMARY:
   ├─ Companies Discovered: 8
   ├─ Contacts Found: 24
   ├─ Emails Resolved: 18
   └─ Emails Ready to Send: 18

Do you want to PROCEED? (yes/no): █
```

Type **yes** or **y** to proceed, anything else to cancel.

---

## Environment Configuration

Make sure `.env` has:

```env
APOLLO_API_KEY=your_apollo_key_here
BREVO_API_KEY=your_brevo_key_here  (for email sending)
EAZYREACH_API_KEY=your_key_here    (optional)
PROSPEO_API_KEY=your_key_here      (optional)
```

---

## Troubleshooting

**Q: "Connection refused"**
A: Start the server first with `npm run server`

**Q: "Missing required API keys"**
A: Update `.env` with your Apollo API key

**Q: "No companies found"**
A: Increase `--company-limit` value

**Q: "Emails not sent"**
A: Check if BREVO_API_KEY is set in `.env`

---

## Run Your First Pipeline

```bash
# 1. Install dependencies
npm install

# 2. Start server (in one terminal)
npm run server

# 3. Run pipeline (in another terminal)
npm run pipeline -- google.com --company-limit 10

# 4. View results
cat contacts.json | jq '.'
tail -f logs/application.log
```

**Total time: ~2 minutes!**

---

## More Examples

### Test Different Companies
```bash
npm run pipeline -- microsoft.com
npm run pipeline -- amazon.com
npm run pipeline -- salesforce.com
npm run pipeline -- apple.com
```

### Pretty Print Results
```bash
curl -s "http://localhost:3000/api/pipeline/list" | jq '.'
```

### Filter Pipeline Results
```bash
curl -s "http://localhost:3000/api/pipeline/list" | jq '.pipelines[] | {id, seedDomain, emailsSent}'
```

---

## Ready to Go!

Pick any command above and run it. The pipeline will automatically:

1. Find similar companies
2. Discover decision makers
3. Resolve email addresses
4. Show safety checkpoint
5. Send personalized outreach

**Start here:**
```bash
npm run server &
npm run pipeline -- google.com
```

Questions? Check `logs/application.log` for detailed execution logs!
