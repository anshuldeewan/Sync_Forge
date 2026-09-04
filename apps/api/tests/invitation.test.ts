import request from 'supertest';
import app from '../src/index';
import prisma from '@syncforge/db';
import { Role, InvitationStatus } from '@syncforge/db';
import { auth } from '../src/config/firebase';
import crypto from 'crypto';

jest.mock('../src/config/firebase', () => ({
  auth: {
    verifyIdToken: jest.fn(),
  },
}));

describe('Invitation API', () => {
  let admin: any;
  let invitee: any;
  let workspace: any;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.workspaceInvitation.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();

    admin = await prisma.user.create({ data: { id: 'admin-id', email: 'admin@test.com', displayName: 'Admin' } });
    invitee = await prisma.user.create({ data: { id: 'invitee-id', email: 'invitee@test.com', displayName: 'Invitee' } });

    workspace = await prisma.workspace.create({
      data: {
        name: 'Invite Test WS',
        members: {
          create: { userId: admin.id, role: Role.ADMIN }
        }
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/workspaces/:workspaceId/invitations', () => {
    it('should allow ADMIN to create invitation', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: admin.id });
      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/invitations`)
        .set('Authorization', 'Bearer token')
        .send({ email: 'new@test.com', role: Role.EDITOR });

      expect(res.status).toBe(201);
      expect(res.body.invitation.email).toBe('new@test.com');
      expect(res.body.invitation.token).toBeDefined();
      expect(res.body.inviteUrl).toContain('/invite/');

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'MEMBER_INVITED', workspaceId: workspace.id }
      });
      expect(audit).toBeTruthy();
      expect((audit!.metadata as any).email).toBe('new@test.com');
    });

    it('should reject inviting as OWNER', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: admin.id });
      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/invitations`)
        .set('Authorization', 'Bearer token')
        .send({ email: 'owner2@test.com', role: Role.OWNER });

      expect(res.status).toBe(400);
    });

    it('should prevent duplicate pending invitations', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: admin.id });
      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/invitations`)
        .set('Authorization', 'Bearer token')
        .send({ email: 'new@test.com', role: Role.VIEWER });

      expect(res.status).toBe(409); // Conflict
    });
  });

  describe('POST /api/invitations/accept', () => {
    let validToken: string;

    beforeAll(async () => {
      const token = crypto.randomBytes(32).toString('hex');
      validToken = token;
      await prisma.workspaceInvitation.create({
        data: {
          workspaceId: workspace.id,
          email: invitee.email,
          role: Role.EDITOR,
          token,
          expiresAt: new Date(Date.now() + 100000),
          status: InvitationStatus.PENDING
        }
      });
    });

    it('should reject if wrong email', async () => {
      const wrongUser = await prisma.user.create({ data: { id: 'wrong-id', email: 'wrong@test.com', displayName: 'Wrong' } });
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: wrongUser.id });

      const res = await request(app)
        .post('/api/invitations/accept')
        .set('Authorization', 'Bearer token')
        .send({ token: validToken });

      expect(res.status).toBe(403);
    });

    it('should accept valid invitation and create membership', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: invitee.id });

      const res = await request(app)
        .post('/api/invitations/accept')
        .set('Authorization', 'Bearer token')
        .send({ token: validToken });

      expect(res.status).toBe(200);

      // Verify membership
      const member = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: invitee.id } }
      });
      expect(member).toBeDefined();
      expect(member?.role).toBe(Role.EDITOR);

      // Verify invitation is consumed
      const inv = await prisma.workspaceInvitation.findFirst({ where: { token: validToken } });
      expect(inv?.status).toBe(InvitationStatus.ACCEPTED);
    });

    it('should reject reused token', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: invitee.id });

      const res = await request(app)
        .post('/api/invitations/accept')
        .set('Authorization', 'Bearer token')
        .send({ token: validToken });

      expect(res.status).toBe(400); // Already used
    });
  });
});
