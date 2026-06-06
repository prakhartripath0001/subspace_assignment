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

- **APOLLO_API_KEY** (required): Your Apollo.io V1 API key
- **PORT** (optional): Server port, defaults to 3000

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
│   ├── app.js                 # Express app configuration and routes
│   ├── server.js              # Server entry point
│   ├── services/
│   │   └── discoveryService.js # Apollo API integration logic
│   └── utils/
│       ├── logger.js          # Winston logger setup
│       └── discoveryService.test.js # Tests
├── logs/                      # Application logs
├── .env                       # Environment variables (not in git)
├── package.json               # Project dependencies
└── README.md                  # This file
```

## Key Features

✅ **Multiple endpoints** for different use cases  
✅ **Flexible parameter input** via query string or JSON body  
✅ **Comprehensive error handling** with meaningful error messages  
✅ **Rate limit handling** gracefully backs off on 429 errors  
✅ **Structured logging** using Winston logger  
✅ **Pagination support** for large result sets  
✅ **Environment variable management** using dotenv  
✅ **Input validation** for required parameters  

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

## Troubleshooting

### "APOLLO_API_KEY is not set"
Make sure your `.env` file exists in the project root with a valid API key:
```bash
export APOLLO_API_KEY=your_key_here
```

### Server won't start
1. Check if port 3000 is already in use
2. Try running on a different port: `PORT=3001 npm start`

### 403 Unauthorized from Apollo
- Verify your API key is correct in the `.env` file
- Ensure you've restarted the server after updating `.env`
- Check if your Apollo account has the required API permissions

### No results returned
- Try with a different domain
- Check rate limit headers in the response
- Verify the domain exists in Apollo's database

## License

ISC

## Support

For issues with the Apollo.io API itself, visit [Apollo Documentation](https://www.apollo.io/api-docs)
