
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      async function main() {
        await prisma.user.update({ where: { email: 'admin_00f9ae43@test.com' }, data: { isPlatformAdmin: true } });
      }
      main().then(() => process.exit(0));
    