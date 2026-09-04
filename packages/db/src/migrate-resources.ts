import { PrismaClient, ResourceType } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('Starting Resource migration...');

  try {
    // 1. Migrate Pages
    const pages = await prisma.page.findMany({
      where: { resourceId: null }
    });

    for (const page of pages) {
      console.log(`Migrating Page: ${page.id} - ${page.title}`);
      
      const resource = await prisma.resource.create({
        data: {
          projectId: page.projectId,
          name: page.title,
          type: ResourceType.PAGE,
          createdBy: '00000000-0000-0000-0000-000000000000', // Default system user
          createdAt: page.createdAt,
          updatedAt: page.updatedAt,
        }
      });

      await prisma.page.update({
        where: { id: page.id },
        data: { resourceId: resource.id }
      });
    }

    // 2. Map Page hierarchy to Resource hierarchy
    const migratedPages = await prisma.page.findMany({
      where: { parentId: { not: null }, resourceId: { not: null } }
    });

    for (const page of migratedPages) {
      if (!page.parentId) continue;
      
      const parentPage = await prisma.page.findUnique({ where: { id: page.parentId } });
      if (parentPage && parentPage.resourceId && page.resourceId) {
        await prisma.resource.update({
          where: { id: page.resourceId },
          data: { parentId: parentPage.resourceId }
        });
      }
    }

    // 3. Migrate FileAssets
    const fileAssets = await prisma.fileAsset.findMany({
      where: { resourceId: null }
    });

    for (const file of fileAssets) {
      console.log(`Migrating FileAsset: ${file.id} - ${file.filename}`);
      
      const resource = await prisma.resource.create({
        data: {
          projectId: file.projectId,
          name: file.filename,
          type: ResourceType.FILE,
          createdBy: file.uploaderId,
          createdAt: file.createdAt,
          updatedAt: file.createdAt,
        }
      });

      await prisma.fileAsset.update({
        where: { id: file.id },
        data: { resourceId: resource.id }
      });
    }

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
