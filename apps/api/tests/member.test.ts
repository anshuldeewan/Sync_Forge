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

describe('Member API', () => {
  let owner: any;
  let admin: any;
  let editor: any;
  let workspace: any;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();

    owner = await prisma.user.create({ data: { id: 'owner-id', email: 'owner@test.com', displayName: 'Owner' } });
    admin = await prisma.user.create({ data: { id: 'admin-id', email: 'admin@test.com', displayName: 'Admin' } });
    editor = await prisma.user.create({ data: { id: 'editor-id', email: 'editor@test.com', displayName: 'Editor' } });

    workspace = await prisma.workspace.create({
      data: {
        name: 'Member Test WS',
        members: {
          createMany: {
            data: [
              { userId: owner.id, role: Role.OWNER },
              { userId: admin.id, role: Role.ADMIN },
              { userId: editor.id, role: Role.EDITOR }
            ]
          }
        }
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('PATCH /api/workspaces/:workspaceId/members/:userId', () => {
    it('should prevent ADMIN from demoting OWNER', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: admin.id });
      const res = await request(app)
        .patch(`/api/workspaces/${workspace.id}/members/${owner.id}`)
        .set('Authorization', 'Bearer token')
        .send({ role: Role.EDITOR });

      expect(res.status).toBe(403);
    });

    it('should allow OWNER to promote EDITOR to ADMIN', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: owner.id });
      const res = await request(app)
        .patch(`/api/workspaces/${workspace.id}/members/${editor.id}`)
        .set('Authorization', 'Bearer token')
        .send({ role: Role.ADMIN });

      expect(res.status).toBe(200);

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'MEMBER_ROLE_UPDATED', resource: editor.id }
      });
      expect(audit).toBeTruthy();
      expect((audit!.metadata as any).newRole).toBe(Role.ADMIN);
    });

    it('should prevent OWNER from demoting themselves if last OWNER', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: owner.id });
      const res = await request(app)
        .patch(`/api/workspaces/${workspace.id}/members/${owner.id}`)
        .set('Authorization', 'Bearer token')
        .send({ role: Role.ADMIN });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/workspaces/:workspaceId/members/:userId', () => {
    it('should prevent ADMIN from removing OWNER', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: admin.id });
      const res = await request(app)
        .delete(`/api/workspaces/${workspace.id}/members/${owner.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(403);
    });

    it('should prevent OWNER from removing themselves if last OWNER', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: owner.id });
      const res = await request(app)
        .delete(`/api/workspaces/${workspace.id}/members/${owner.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(400);
    });

    it('should allow ADMIN to remove EDITOR', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: admin.id });
      const res = await request(app)
        .delete(`/api/workspaces/${workspace.id}/members/${editor.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'MEMBER_REMOVED', resource: editor.id }
      });
      expect(audit).toBeTruthy();
    });
  });
});
