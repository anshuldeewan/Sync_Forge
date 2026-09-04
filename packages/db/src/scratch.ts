import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspect() {
  try {
    const pageCount = await prisma.page.count();
    const fileCount = await prisma.fileAsset.count();
    
    console.log(`Total Pages: ${pageCount}`);
    console.log(`Total FileAssets: ${fileCount}`);
    
    if (pageCount > 0) {
      const samplePages = await prisma.page.findMany({ take: 2 });
      console.log('Sample Pages:', JSON.stringify(samplePages, null, 2));
    }
    
    if (fileCount > 0) {
      const sampleFiles = await prisma.fileAsset.findMany({ take: 2 });
      console.log('Sample Files:', JSON.stringify(sampleFiles, null, 2));
    }
    
  } catch (error) {
    console.error('Error during inspection:', error);
  } finally {
    await prisma.$disconnect();
  }
}

inspect();
