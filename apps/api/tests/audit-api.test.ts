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

describe('Audit API', () => {
  let owner: any;
  let admin: any;
  let editor: any;
  let viewer: any;
  let otherUser: any;
  let workspace: any;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();

    owner = await prisma.user.create({ data: { id: 'audit-owner', email: 'owner@test.com', displayName: 'Owner' } });
    admin = await prisma.user.create({ data: { id: 'audit-admin', email: 'admin@test.com', displayName: 'Admin' } });
    editor = await prisma.user.create({ data: { id: 'audit-editor', email: 'editor@test.com', displayName: 'Editor' } });
    viewer = await prisma.user.create({ data: { id: 'audit-viewer', email: 'viewer@test.com', displayName: 'Viewer' } });
    otherUser = await prisma.user.create({ data: { id: 'audit-other', email: 'other@test.com', displayName: 'Other' } });

    workspace = await prisma.workspace.create({
      data: {
        name: 'Audit Test WS',
        members: {
          createMany: {
            data: [
              { userId: owner.id, role: Role.OWNER },
              { userId: admin.id, role: Role.ADMIN },
              { userId: editor.id, role: Role.EDITOR },
              { userId: viewer.id, role: Role.VIEWER },
            ]
          }
        }
      }
    });

    // Create some audit logs
    await prisma.auditLog.createMany({
      data: [
        { workspaceId: workspace.id, userId: owner.id, action: 'WORKSPACE_CREATED', resource: workspace.id, metadata: { name: 'Audit Test WS' } },
        { workspaceId: workspace.id, userId: admin.id, action: 'PROJECT_CREATED', resource: 'proj-1', metadata: { name: 'Test Proj' } },
        { workspaceId: workspace.id, userId: editor.id, action: 'RESOURCE_UPLOADED', resource: 'res-1', metadata: { filename: 'test.txt' } },
      ]
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/workspaces/:workspaceId/audit', () => {
    it('should allow OWNER to retrieve audit logs', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: owner.id });
      const res = await request(app)
        .get(`/api/workspaces/${workspace.id}/audit`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.auditLogs).toHaveLength(3);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 50,
        total: 3,
        totalPages: 1
      });
      expect(res.body.auditLogs.map((l: any) => l.action)).toEqual(
        expect.arrayContaining(['WORKSPACE_CREATED', 'PROJECT_CREATED', 'RESOURCE_UPLOADED'])
      );
      const editorLog = res.body.auditLogs.find((l: any) => l.action === 'RESOURCE_UPLOADED');
      expect(editorLog.user.displayName).toBe('Editor');
    });

    it('should allow ADMIN to retrieve audit logs', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: admin.id });
      const res = await request(app)
        .get(`/api/workspaces/${workspace.id}/audit?limit=2`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.auditLogs).toHaveLength(2);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2
      });
    });

    it('should prevent EDITOR from retrieving audit logs', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: editor.id });
      const res = await request(app)
        .get(`/api/workspaces/${workspace.id}/audit`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(403);
    });

    it('should prevent VIEWER from retrieving audit logs', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: viewer.id });
      const res = await request(app)
        .get(`/api/workspaces/${workspace.id}/audit`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-members (IDOR protection)', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: otherUser.id });
      const res = await request(app)
        .get(`/api/workspaces/${workspace.id}/audit`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });
});
