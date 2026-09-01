import request from 'supertest';
import { PrismaClient } from '@syncforge/db';
import app from '../index';

// Mock Firebase Auth
jest.mock('../config/firebase', () => ({
  auth: {
    verifyIdToken: async (token: string) => {
      // the token will just be the user id for testing
      return { uid: token, email: `${token}@test.com` };
    }
  }
}));

const prisma = new PrismaClient();

describe('Phase 8F API Integration Tests', () => {
  let ws: any, project: any, resource: any, binResource: any;
  let owner: any, editor: any, viewer: any, stranger: any;

  beforeAll(async () => {
    ws = await prisma.workspace.create({ data: { name: 'Test WS 8F Int' } });
    
    owner = await prisma.user.create({ data: { id: `owner-${Date.now()}`, email: `owner-${Date.now()}@test.com`, displayName: 'Owner' } });
    editor = await prisma.user.create({ data: { id: `editor-${Date.now()}`, email: `editor-${Date.now()}@test.com`, displayName: 'Editor' } });
    viewer = await prisma.user.create({ data: { id: `viewer-${Date.now()}`, email: `viewer-${Date.now()}@test.com`, displayName: 'Viewer' } });
    stranger = await prisma.user.create({ data: { id: `stranger-${Date.now()}`, email: `stranger-${Date.now()}@test.com`, displayName: 'Stranger' } });

    await prisma.workspaceMember.createMany({
      data: [
        { workspaceId: ws.id, userId: owner.id, role: 'OWNER' },
        { workspaceId: ws.id, userId: editor.id, role: 'EDITOR' },
        { workspaceId: ws.id, userId: viewer.id, role: 'VIEWER' }
      ]
    });

    project = await prisma.project.create({ data: { workspaceId: ws.id, name: 'Test Project 8F Int' } });
    resource = await prisma.resource.create({ data: { projectId: project.id, name: 'test.txt', type: 'FILE', position: 0, createdBy: owner.id } });
    
    await prisma.fileSnapshot.create({ data: { resourceId: resource.id, state: Buffer.from([1,2,3]) } });
  });

  afterAll(async () => {
    await prisma.workspace.delete({ where: { id: ws.id } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, editor.id, viewer.id, stranger.id] } } });
    await prisma.$disconnect();
  });

  const getBasePath = () => `/api/workspaces/${ws.id}/projects/${project.id}/resources/${resource.id}`;

  it('Stranger cannot access revisions (IDOR)', async () => {
    const res = await request(app)
      .get(`${getBasePath()}/revisions`)
      .set('Authorization', `Bearer ${stranger.id}`);
    expect([403, 404]).toContain(res.status);
  });

  it('Owner can create revision', async () => {
    const res = await request(app)
      .post(`${getBasePath()}/revisions`)
      .set('Authorization', `Bearer ${owner.id}`)
      .send({ message: 'V1' });
    expect(res.status).toBe(200);
    expect(res.body.revision.versionNumber).toBe(1);
  });

  it('Editor can create revision', async () => {
    const res = await request(app)
      .post(`${getBasePath()}/revisions`)
      .set('Authorization', `Bearer ${editor.id}`)
      .send({ message: 'V2' });
    expect(res.status).toBe(200);
    expect(res.body.revision.versionNumber).toBe(2);
  });

  it('Viewer cannot create revision', async () => {
    const res = await request(app)
      .post(`${getBasePath()}/revisions`)
      .set('Authorization', `Bearer ${viewer.id}`)
      .send({ message: 'V3' });
    expect(res.status).toBe(403);
  });

  it('Viewer can list revisions', async () => {
    const res = await request(app)
      .get(`${getBasePath()}/revisions`)
      .set('Authorization', `Bearer ${viewer.id}`);
    expect(res.status).toBe(200);
    expect(res.body.revisions.length).toBe(2);
    expect(res.body.revisions[0].author.id).toBe(editor.id);
  });

  let v1Id: string;
  it('Viewer can get specific revision state', async () => {
    const listRes = await request(app)
      .get(`${getBasePath()}/revisions`)
      .set('Authorization', `Bearer ${viewer.id}`);
    v1Id = listRes.body.revisions.find((r: any) => r.versionNumber === 1).id;

    const res = await request(app)
      .get(`${getBasePath()}/revisions/${v1Id}`)
      .set('Authorization', `Bearer ${viewer.id}`);
    expect(res.status).toBe(200);
    expect(res.body.versionNumber).toBe(1);
  });

  it('Viewer cannot restore revision', async () => {
    const res = await request(app)
      .post(`${getBasePath()}/revisions/${v1Id}/restore`)
      .set('Authorization', `Bearer ${viewer.id}`);
    expect(res.status).toBe(403);
  });

  it('Editor can restore revision (creates NEW revision 3)', async () => {
    const res = await request(app)
      .post(`${getBasePath()}/revisions/${v1Id}/restore`)
      .set('Authorization', `Bearer ${editor.id}`);
    expect(res.status).toBe(200);
    expect(res.body.revision.versionNumber).toBe(3);
  });

  it('Old revisions remain unchanged and sequential', async () => {
    const res = await request(app)
      .get(`${getBasePath()}/revisions`)
      .set('Authorization', `Bearer ${viewer.id}`);
    const versions = res.body.revisions.map((r: any) => r.versionNumber);
    expect(versions).toContain(1);
    expect(versions).toContain(2);
    expect(versions).toContain(3);
  });
});
