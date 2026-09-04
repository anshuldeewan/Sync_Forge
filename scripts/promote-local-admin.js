#!/usr/bin/env node
/**
 * promote-local-admin.js
 * 
 * LOCAL DEVELOPMENT ONLY — promotes a user to Platform Admin.
 * 
 * Usage:
 *   node scripts/promote-local-admin.js <email>
 * 
 * Example:
 *   node scripts/promote-local-admin.js myuser@example.com
 * 
 * This script:
 *   - Only works against the local development/test database
 *   - Never exposes an HTTP endpoint
 *   - Requires the user to already exist in the database (i.e., they must have signed up)
 *   - Sets isPlatformAdmin = true for the specified user
 * 
 * WARNING: Do NOT use this in production. Platform admin promotion in production
 *          should use a secure, audited process.
 */

const { PrismaClient } = require('@prisma/client');

const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/promote-local-admin.js <email>');
  console.error('Example: node scripts/promote-local-admin.js admin@example.com');
  process.exit(1);
}

async function main() {
  const prisma = new PrismaClient();
  
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      console.error(`❌ User not found: ${email}`);
      console.error('   The user must sign up through the application first.');
      process.exit(1);
    }

    if (user.isPlatformAdmin) {
      console.log(`ℹ️  User "${user.displayName}" (${email}) is already a Platform Admin.`);
      process.exit(0);
    }

    await prisma.user.update({
      where: { email },
      data: { isPlatformAdmin: true }
    });

    console.log(`✅ User "${user.displayName}" (${email}) promoted to Platform Admin.`);
    console.log('   Visit http://localhost:3000/admin to access the admin dashboard.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
