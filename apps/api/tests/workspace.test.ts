import request from 'supertest';
import app from '../src/index';
import prisma from '@syncforge/db';
import { Role } from '@syncforge/db';
import { auth } from '../src/config/firebase';

// Mock Firebase Admin Auth
jest.mock('../src/config/firebase', () => ({
  auth: {
    verifyIdToken: jest.fn(),
  },
}));

describe('Workspace API', () => {
  let user1: any;
  let user2: any;
  let workspace1: any;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();

    // Create 2 test users
    user1 = await prisma.user.create({
      data: {
        id: 'test-user-1',
        email: 'user1@example.com',
        displayName: 'User One',
      }
    });

    user2 = await prisma.user.create({
      data: {
        id: 'test-user-2',
        email: 'user2@example.com',
        displayName: 'User Two',
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/workspaces', () => {
    it('should create a workspace and make user OWNER', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: user1.id });

      const res = await request(app)
        .post('/api/workspaces')
        .set('Authorization', 'Bearer fake-token-1')
        .send({ name: 'User 1 Workspace' });

      expect(res.status).toBe(201);
      expect(res.body.workspace.name).toBe('User 1 Workspace');
      expect(res.body.workspace.members[0].userId).toBe(user1.id);
      expect(res.body.workspace.members[0].role).toBe(Role.OWNER);

      workspace1 = res.body.workspace;

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'WORKSPACE_CREATED', workspaceId: workspace1.id }
      });
      expect(audit).toBeTruthy();
      expect(audit!.userId).toBe(user1.id);
      expect(audit!.resource).toBe(workspace1.id);
      expect((audit!.metadata as any).name).toBe('User 1 Workspace');
    });

    it('should reject invalid names', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: user1.id });

      const res = await request(app)
        .post('/api/workspaces')
        .set('Authorization', 'Bearer fake-token-1')
        .send({ name: '' });

      expect(res.status).toBe(400);
    });

    it('should reject duplicate workspace names', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: user1.id });

      const res = await request(app)
        .post('/api/workspaces')
        .set('Authorization', 'Bearer fake-token-1')
        .send({ name: 'User 1 Workspace' }); // Same name as before

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('GET /api/workspaces', () => {
    it('should list only user1 workspaces for user1', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: user1.id });

      const res = await request(app)
        .get('/api/workspaces')
        .set('Authorization', 'Bearer fake-token-1');

      expect(res.status).toBe(200);
      expect(res.body.workspaces).toHaveLength(1);
      expect(res.body.workspaces[0].id).toBe(workspace1.id);
    });

    it('should return empty list for user2 initially', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: user2.id });

      const res = await request(app)
        .get('/api/workspaces')
        .set('Authorization', 'Bearer fake-token-2');

      expect(res.status).toBe(200);
      expect(res.body.workspaces).toHaveLength(0);
    });
  });

  describe('GET /api/workspaces/:workspaceId', () => {
    it('should allow OWNER to get workspace', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: user1.id });

      const res = await request(app)
        .get(`/api/workspaces/${workspace1.id}`)
        .set('Authorization', 'Bearer fake-token-1');

      expect(res.status).toBe(200);
      expect(res.body.workspace.id).toBe(workspace1.id);
    });

    it('should block non-member from getting workspace', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: user2.id });

      const res = await request(app)
        .get(`/api/workspaces/${workspace1.id}`)
        .set('Authorization', 'Bearer fake-token-2');

      expect(res.status).toBe(404); // Returns 404 to avoid leaking existence
    });
  });

  describe('PATCH /api/workspaces/:workspaceId', () => {
    it('should allow OWNER to update workspace', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: user1.id });

      const res = await request(app)
        .patch(`/api/workspaces/${workspace1.id}`)
        .set('Authorization', 'Bearer fake-token-1')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.workspace.name).toBe('Updated Name');

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'WORKSPACE_UPDATED', workspaceId: workspace1.id }
      });
      expect(audit).toBeTruthy();
      expect((audit!.metadata as any).newName).toBe('Updated Name');
    });
  });

  describe('DELETE /api/workspaces/:workspaceId', () => {
    let editorUser: any;
    let viewerUser: any;
    let wsToDelete: any;

    beforeAll(async () => {
      // Create additional users for EDITOR/VIEWER tests
      editorUser = await prisma.user.create({
        data: { id: 'editor-del-id', email: 'editor-del@test.com', displayName: 'Editor Del' }
      });
      viewerUser = await prisma.user.create({
        data: { id: 'viewer-del-id', email: 'viewer-del@test.com', displayName: 'Viewer Del' }
      });

      // Create a fresh workspace for deletion tests (workspace1 is needed for other tests)
      wsToDelete = await prisma.workspace.create({
        data: {
          name: 'WS To Delete',
          members: {
            create: [
              { userId: user1.id, role: Role.OWNER },
              { userId: editorUser.id, role: Role.EDITOR },
              { userId: viewerUser.id, role: Role.VIEWER },
            ]
          }
        }
      });
    });

    it('EDITOR cannot delete workspace → 403', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: editorUser.id });

      const res = await request(app)
        .delete(`/api/workspaces/${wsToDelete.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('VIEWER cannot delete workspace → 403', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: viewerUser.id });

      const res = await request(app)
        .delete(`/api/workspaces/${wsToDelete.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('OWNER cannot delete workspace they do NOT belong to → 404 (IDOR protection)', async () => {
      // user2 is not a member of wsToDelete
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: user2.id });

      const res = await request(app)
        .delete(`/api/workspaces/${wsToDelete.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });

    it('OWNER can delete workspace → 200', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: user1.id });

      const res = await request(app)
        .delete(`/api/workspaces/${wsToDelete.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);

      // Verify it is soft-deleted (excluded from list)
      const listRes = await request(app)
        .get('/api/workspaces')
        .set('Authorization', 'Bearer token');
      expect(listRes.body.workspaces.find((w: any) => w.id === wsToDelete.id)).toBeUndefined();

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'WORKSPACE_DELETED', workspaceId: wsToDelete.id }
      });
      expect(audit).toBeTruthy();
    });

    it('ADMIN can delete workspace → 200', async () => {
      // Create a second workspace with user1 as ADMIN
      const ws2 = await prisma.workspace.create({
        data: {
          name: 'WS Admin Delete',
          members: { create: { userId: user1.id, role: Role.ADMIN } }
        }
      });

      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: user1.id });

      const res = await request(app)
        .delete(`/api/workspaces/${ws2.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
    });
  });
});
