require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const port = process.env.PORT || 3000;

app.listen(port, () => {
  logger.info(`Server listening at http://localhost:${port}`);
  console.log(`
╔════════════════════════════════════════════════════╗
║   OUTREACH PIPELINE API SERVER STARTED            ║
╚════════════════════════════════════════════════════╝

AVAILABLE ENDPOINTS:
   GET    /                           - Health check
   GET    /discover?domain=X          - Stage 1: Company Discovery
   POST   /api/contact/enrich         - Individual contact enrichment
   POST   /api/pipeline/execute       - Run full pipeline
   GET    /api/pipeline/status/:id    - Check pipeline status
   POST   /api/pipeline/preview       - Preview pipeline results

RUN AS CLI:
   node src/cli.js <domain> [options]

EXAMPLES:
   node src/cli.js google.com
   npm run pipeline -- microsoft.com --company-limit 5

LOGS: logs/application.log
  `);
});