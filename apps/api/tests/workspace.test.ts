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
    // Clear DB
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
    });

    it('should reject invalid names', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: user1.id });

      const res = await request(app)
        .post('/api/workspaces')
        .set('Authorization', 'Bearer fake-token-1')
        .send({ name: '' });

      expect(res.status).toBe(400);
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
    });
  });

  describe('DELETE /api/workspaces/:workspaceId', () => {
    it('should allow OWNER to soft delete workspace', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: user1.id });

      const res = await request(app)
        .delete(`/api/workspaces/${workspace1.id}`)
        .set('Authorization', 'Bearer fake-token-1');

      expect(res.status).toBe(200);

      // Verify it is excluded from list
      const listRes = await request(app)
        .get('/api/workspaces')
        .set('Authorization', 'Bearer fake-token-1');
      expect(listRes.body.workspaces).toHaveLength(0);
    });
  });
});
