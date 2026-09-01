const prisma = require('@syncforge/db').default;
afterAll(async () => {
  if (prisma) await prisma.$disconnect();
});
