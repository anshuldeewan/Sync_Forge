import request from 'supertest';
import app from '../src/index';
import prisma from '@syncforge/db';
import { Role, ResourceType } from '@syncforge/db';
import { auth } from '../src/config/firebase';

jest.mock('../src/config/firebase', () => ({
  auth: {
    verifyIdToken: jest.fn(),
  },
}));

/**
 * Persistence Regression Test
 * 
 * Verifies that data created through the API persists across multiple requests
 * (simulating server restart → re-query), and that the dev database (syncforge_dev)
 * is NEVER the target of destructive test operations.
 */
describe('Persistence Regression Tests', () => {
  let user: any;
  let workspace: any;
  let project: any;

  beforeAll(async () => {
    // SAFETY CHECK: This test MUST use syncforge_test
    const dbUrl = process.env.DATABASE_URL || '';
    if (!dbUrl.includes('syncforge_test')) {
      throw new Error(
        `FATAL: Persistence tests must use syncforge_test, not ${dbUrl}. ` +
        `This would destroy development data!`
      );
    }

    // Clean slate for this test file
    await prisma.resource.deleteMany();
    await prisma.page.deleteMany();
    await prisma.project.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();

    user = await prisma.user.create({
      data: { id: 'persist-user-id', email: 'persist@test.com', displayName: 'Persist User' }
    });

    workspace = await prisma.workspace.create({
      data: {
        name: 'PersistenceTest',
        members: { create: { userId: user.id, role: Role.OWNER } }
      }
    });

    project = await prisma.project.create({
      data: { workspaceId: workspace.id, name: 'PersistenceProject' }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should persist workspace after creation (simulate server restart via re-query)', async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: user.id });

    const res = await request(app)
      .get('/api/workspaces')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.workspaces.some((w: any) => w.name === 'PersistenceTest')).toBe(true);
  });

  it('should persist project after creation', async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: user.id });

    const res = await request(app)
      .get(`/api/workspaces/${workspace.id}/projects`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.projects.some((p: any) => p.name === 'PersistenceProject')).toBe(true);
  });

  it('should persist nested resource hierarchy', async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: user.id });

    // Create src/
    const srcRes = await request(app)
      .post(`/api/workspaces/${workspace.id}/projects/${project.id}/resources`)
      .set('Authorization', 'Bearer token')
      .send({ name: 'src', type: ResourceType.FOLDER });

    expect(srcRes.status).toBe(201);
    const srcId = srcRes.body.resource.id;

    // Create src/components/
    const compRes = await request(app)
      .post(`/api/workspaces/${workspace.id}/projects/${project.id}/resources`)
      .set('Authorization', 'Bearer token')
      .send({ name: 'components', type: ResourceType.FOLDER, parentId: srcId });

    expect(compRes.status).toBe(201);
    const compId = compRes.body.resource.id;

    // Create src/components/Button.tsx
    const btnRes = await request(app)
      .post(`/api/workspaces/${workspace.id}/projects/${project.id}/resources`)
      .set('Authorization', 'Bearer token')
      .send({ name: 'Button.tsx', type: ResourceType.FILE, parentId: compId });

    expect(btnRes.status).toBe(201);
    expect(btnRes.body.resource.parentId).toBe(compId);

    // Simulate "server restart" by re-fetching all resources
    const getRes = await request(app)
      .get(`/api/workspaces/${workspace.id}/projects/${project.id}/resources`)
      .set('Authorization', 'Bearer token');

    expect(getRes.status).toBe(200);
    const resources = getRes.body.resources;
    
    const src = resources.find((r: any) => r.name === 'src');
    const comp = resources.find((r: any) => r.name === 'components');
    const btn = resources.find((r: any) => r.name === 'Button.tsx');

    // Verify complete hierarchy is intact
    expect(src).toBeDefined();
    expect(src.parentId).toBeNull();
    expect(comp).toBeDefined();
    expect(comp.parentId).toBe(srcId);
    expect(btn).toBeDefined();
    expect(btn.parentId).toBe(compId);
  });

  it('should persist PAGE resource with associated Page record', async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: user.id });

    const pageRes = await request(app)
      .post(`/api/workspaces/${workspace.id}/projects/${project.id}/resources`)
      .set('Authorization', 'Bearer token')
      .send({ name: 'README.md', type: ResourceType.PAGE });

    expect(pageRes.status).toBe(201);
    expect(pageRes.body.resource.page).toBeDefined();
    expect(pageRes.body.resource.page.id).toBeDefined();

    // Verify Page exists in DB directly
    const page = await prisma.page.findUnique({
      where: { resourceId: pageRes.body.resource.id }
    });
    expect(page).toBeDefined();
    expect(page?.title).toBe('README.md');

    // Re-fetch all resources and verify page.id is present
    const getRes = await request(app)
      .get(`/api/workspaces/${workspace.id}/projects/${project.id}/resources`)
      .set('Authorization', 'Bearer token');

    const readme = getRes.body.resources.find((r: any) => r.name === 'README.md');
    expect(readme).toBeDefined();
    expect(readme.page?.id).toBeDefined();
    expect(readme.page.id).toBe(pageRes.body.resource.page.id);
  });

  it('should prove DATABASE_URL uses syncforge_test and not syncforge_dev', () => {
    const dbUrl = process.env.DATABASE_URL || '';
    expect(dbUrl).toContain('syncforge_test');
    expect(dbUrl).not.toContain('syncforge_dev');
  });
});
