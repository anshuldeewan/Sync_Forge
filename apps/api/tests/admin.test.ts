import request from 'supertest';
import app from '../src/index';
import prisma from '@syncforge/db';
import { Role } from '@syncforge/db';
import { auth } from '../src/config/firebase';

jest.mock('../src/config/firebase', () => ({
  auth: {
    verifyIdToken: jest.fn(),
  },
}));

describe('Admin API', () => {
  let platformAdmin: any;
  let normalUser: any;
  let demoUser: any;
  let workspaceOwner: any;
  let ws1: any;
  let ws2: any;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();

    platformAdmin = await prisma.user.create({ data: { id: 'admin-1', email: 'platform@admin.com', displayName: 'Platform Admin', isPlatformAdmin: true } });
    normalUser = await prisma.user.create({ data: { id: 'user-1', email: 'normal@user.com', displayName: 'Normal User', isPlatformAdmin: false } });
    demoUser = await prisma.user.create({ data: { id: 'demo-1', email: 'user@demo.syncforge.local', displayName: 'Demo User', isPlatformAdmin: true } }); // even if set to true, it's a demo user
    workspaceOwner = await prisma.user.create({ data: { id: 'owner-1', email: 'owner@ws.com', displayName: 'WS Owner', isPlatformAdmin: false } });

    ws1 = await prisma.workspace.create({
      data: {
        name: 'Workspace 1',
        members: { create: { userId: workspaceOwner.id, role: Role.OWNER } }
      }
    });

    ws2 = await prisma.workspace.create({
      data: {
        name: 'Workspace 2',
      }
    });

    await prisma.auditLog.createMany({
      data: [
        { workspaceId: ws1.id, userId: workspaceOwner.id, action: 'WS1_ACTION', resource: ws1.id, metadata: { secret: 'hidden' } },
        { workspaceId: ws2.id, userId: normalUser.id, action: 'WS2_ACTION', resource: ws2.id, metadata: { safe: 'yes' } },
      ]
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Authorization', () => {
    it('allows platform admin to access /api/admin/stats', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: platformAdmin.id, email: platformAdmin.email });
      const res = await request(app).get('/api/admin/stats').set('Authorization', 'Bearer token');
      expect(res.status).toBe(200);
    });

    it('denies normal user with 403', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: normalUser.id, email: normalUser.email });
      const res = await request(app).get('/api/admin/stats').set('Authorization', 'Bearer token');
      expect(res.status).toBe(403);
    });

    it('denies workspace owner (not platform admin) with 403', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: workspaceOwner.id, email: workspaceOwner.email });
      const res = await request(app).get('/api/admin/stats').set('Authorization', 'Bearer token');
      expect(res.status).toBe(403);
    });

    it('denies demo user with 403 (even if they have isPlatformAdmin set in db for some reason)', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: demoUser.id, email: demoUser.email });
      const res = await request(app).get('/api/admin/stats').set('Authorization', 'Bearer token');
      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Demo users cannot access');
    });

    it('denies unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/admin/stats');
      expect(res.status).toBe(401);
    });
  });

  describe('Endpoints', () => {
    beforeEach(() => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: platformAdmin.id, email: platformAdmin.email });
    });

    it('GET /api/admin/users lists all users safely', async () => {
      const res = await request(app).get('/api/admin/users').set('Authorization', 'Bearer token');
      expect(res.status).toBe(200);
      expect(res.body.users.length).toBe(4);
      // Ensure no passwords or firebase tokens are leaked
      expect(res.body.users[0]).not.toHaveProperty('password');
      expect(res.body.users[0]).not.toHaveProperty('firebaseToken');
    });

    it('GET /api/admin/workspaces lists all workspaces safely', async () => {
      const res = await request(app).get('/api/admin/workspaces').set('Authorization', 'Bearer token');
      expect(res.status).toBe(200);
      expect(res.body.workspaces.length).toBe(2);
      expect(res.body.workspaces[0]).toHaveProperty('_count');
    });

    it('GET /api/admin/audit returns global audit logs', async () => {
      const res = await request(app).get('/api/admin/audit').set('Authorization', 'Bearer token');
      expect(res.status).toBe(200);
      expect(res.body.auditLogs.length).toBe(2);
      
      const actions = res.body.auditLogs.map((l: any) => l.action);
      expect(actions).toContain('WS1_ACTION');
      expect(actions).toContain('WS2_ACTION');
    });
    
    it('pagination works for audit logs', async () => {
      const res = await request(app).get('/api/admin/audit?limit=1').set('Authorization', 'Bearer token');
      expect(res.status).toBe(200);
      expect(res.body.auditLogs.length).toBe(1);
      expect(res.body.pagination.totalPages).toBe(2);
    });
  });
});
