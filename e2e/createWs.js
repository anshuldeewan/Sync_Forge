
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      async function main() {
        const user = await prisma.user.create({ data: { id: 'u-ad6f7f85', email: 'normal_326ec729@test.com', displayName: 'Norm', isPlatformAdmin: false } });
        const ws = await prisma.workspace.create({ data: { name: 'Norm WS', members: { create: { userId: user.id, role: 'OWNER' } } } });
        console.log(ws.id);
      }
      main().then(() => process.exit(0));
    