import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Database Schema Verification', () => {
  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.fileAsset.deleteMany();
    await prisma.issue.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.mention.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.revision.deleteMany();
    await prisma.documentSnapshot.deleteMany();
    await prisma.page.deleteMany();
    await prisma.project.deleteMany();
    await prisma.workspaceInvitation.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create a user', async () => {
    const user = await prisma.user.create({
      data: {
        id: 'test-user-1',
        email: 'test1@example.com',
        displayName: 'Test User 1',
      },
    });
    expect(user.id).toBe('test-user-1');
  });

  it('should create a workspace and assign user as OWNER', async () => {
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Test Workspace',
        members: {
          create: {
            userId: 'test-user-1',
            role: 'OWNER',
          },
        },
      },
      include: { members: true },
    });
    expect(workspace.name).toBe('Test Workspace');
    expect(workspace.members.length).toBe(1);
    expect(workspace.members[0].role).toBe('OWNER');
  });

  it('should restrict WorkspaceMember uniqueness', async () => {
    const workspace = await prisma.workspace.findFirst();
    // Attempting to add the same user again to the same workspace should fail
    await expect(
      prisma.workspaceMember.create({
        data: {
          workspaceId: workspace!.id,
          userId: 'test-user-1',
          role: 'ADMIN',
        },
      })
    ).rejects.toThrow();
  });

  it('should cascade delete projects when workspace is deleted (hard delete)', async () => {
    const workspace = await prisma.workspace.findFirst();
    await prisma.project.create({
      data: {
        name: 'Test Project',
        workspaceId: workspace!.id,
      },
    });

    const projectCountBefore = await prisma.project.count();
    expect(projectCountBefore).toBe(1);

    await prisma.workspace.delete({ where: { id: workspace!.id } });

    const projectCountAfter = await prisma.project.count();
    expect(projectCountAfter).toBe(0);
  });
});
