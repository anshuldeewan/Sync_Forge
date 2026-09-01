const path = require('path');
const dotenv = require('dotenv');

// Load .env.test from the api directory first, THEN fall back
const envTestPath = path.resolve(__dirname, '.env.test');
const fs = require('fs');

if (fs.existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath });
} else {
  // Force syncforge_test to protect dev database
  process.env.DATABASE_URL = 'postgresql://syncforge:password@localhost:5432/syncforge_test?schema=public';
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || !dbUrl.includes('syncforge_test')) {
  throw new Error(
    `FATAL: API tests MUST use syncforge_test database to prevent data loss in syncforge_dev.\n` +
    `Current DATABASE_URL: ${dbUrl}\n` +
    `Create apps/api/.env.test with DATABASE_URL pointing to syncforge_test.`
  );
}

