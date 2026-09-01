const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

// Load .env.test to ensure syncforge_test is used
const envTestPath = path.resolve(__dirname, '.env.test');
if (fs.existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath });
} else {
  process.env.DATABASE_URL = 'postgresql://syncforge:password@localhost:5432/syncforge_test?schema=public';
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || !dbUrl.includes('syncforge_test')) {
  throw new Error(
    `FATAL: WS tests MUST use syncforge_test database to prevent data loss in syncforge_dev.\n` +
    `Current DATABASE_URL: ${dbUrl}`
  );
}
