// Load environment variables for tests
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envTestPath = path.resolve(__dirname, '.env.test');
if (fs.existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath });
} else {
  // Fallback if .env.test is missing
  process.env.DATABASE_URL = "postgresql://syncforge:password@localhost:5432/syncforge_test?schema=public";
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || !dbUrl.includes('syncforge_test')) {
  throw new Error(`FATAL: Database tests MUST use syncforge_test database to prevent data loss. Current DATABASE_URL: ${dbUrl}`);
}
