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

describe('Demo Mode', () => {
  let demoUser: any;
  let normalUser: any;
  let adminUser: any;
  let otherWorkspace: any;

  beforeAll(async () => {
    // Teardown before tests
    await prisma.auditLog.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();

    demoUser = await prisma.user.create({ data: { id: 'demo-u1', email: 'user@demo.syncforge.local', displayName: 'Demo User', isPlatformAdmin: false } });
    normalUser = await prisma.user.create({ data: { id: 'norm-u1', email: 'normal@user.com', displayName: 'Normal User', isPlatformAdmin: false } });
    adminUser = await prisma.user.create({ data: { id: 'adm-u1', email: 'admin@syncforge.local', displayName: 'Admin User', isPlatformAdmin: true } });

    otherWorkspace = await prisma.workspace.create({
      data: {
        name: 'Other Workspace',
        members: {
          create: { userId: normalUser.id, role: Role.OWNER }
        }
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Provisioning', () => {
    it('blocks provisioning when DEMO_MODE is not true', async () => {
      process.env.DEMO_MODE = 'false';
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: demoUser.id, email: demoUser.email });
      const res = await request(app).post('/api/demo/provision').set('Authorization', 'Bearer token');
      expect(res.status).toBe(404);
    });

    it('denies provisioning to a normal user even if DEMO_MODE=true', async () => {
      process.env.DEMO_MODE = 'true';
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: normalUser.id, email: normalUser.email });
      const res = await request(app).post('/api/demo/provision').set('Authorization', 'Bearer token');
      expect(res.status).toBe(403);
    });

    it('allows a demo user to provision a sandbox successfully', async () => {
      process.env.DEMO_MODE = 'true';
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: demoUser.id, email: demoUser.email });
      const res = await request(app).post('/api/demo/provision').set('Authorization', 'Bearer token');
      
      expect(res.status).toBe(201);
      expect(res.body.workspace.name).toBe("Demo User's Sandbox");
      
      const ws = await prisma.workspace.findUnique({
        where: { id: res.body.workspace.id },
        include: { members: true, projects: { include: { resources: true } } }
      });
      
      expect(ws).toBeDefined();
      expect(ws!.members[0].userId).toBe(demoUser.id);
      expect(ws!.members[0].role).toBe(Role.OWNER);
      expect(ws!.projects.length).toBe(1);
      expect(ws!.projects[0].name).toBe('Demo Project');
      expect(ws!.projects[0].resources.length).toBe(1);
      
      // Verify audit log was created
      const logs = await prisma.auditLog.findMany({ where: { workspaceId: ws!.id } });
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('WORKSPACE_CREATED');
    });

    it('makes provisioning idempotent for the same demo user', async () => {
      process.env.DEMO_MODE = 'true';
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: demoUser.id, email: demoUser.email });
      const res = await request(app).post('/api/demo/provision').set('Authorization', 'Bearer token');
      
      expect(res.status).toBe(200); // Because it returned early
      expect(res.body.message).toBe('Existing demo workspace found.');
      
      const workspacesCount = await prisma.workspace.count({
        where: {
          members: { some: { userId: demoUser.id } }
        }
      });
      expect(workspacesCount).toBe(1); // Still only 1 workspace
    });
  });

  describe('Isolation and Destructive Restrictions', () => {
    let demoWsId: string;
    
    beforeAll(async () => {
      const ws = await prisma.workspace.findFirst({
        where: { members: { some: { userId: demoUser.id } } }
      });
      demoWsId = ws!.id;
    });

    it('blocks demo user from accessing another workspace', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: demoUser.id, email: demoUser.email });
      const res = await request(app).get(`/api/workspaces/${otherWorkspace.id}`).set('Authorization', 'Bearer token');
      expect(res.status).toBe(404); // IDOR protection natively kicks in
    });

    it('blocks demo user from accessing global admin APIs', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: demoUser.id, email: demoUser.email });
      const res = await request(app).get(`/api/admin/users`).set('Authorization', 'Bearer token');
      expect(res.status).toBe(403);
    });

    it('blocks demo user from deleting their own workspace (Global Destructive)', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: demoUser.id, email: demoUser.email });
      const res = await request(app).delete(`/api/workspaces/${demoWsId}`).set('Authorization', 'Bearer token');
      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Demo Mode');
      
      const ws = await prisma.workspace.findUnique({ where: { id: demoWsId } });
      expect(ws!.isDeleted).toBe(false);
    });

    it('blocks demo user from removing members (Destructive)', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: demoUser.id, email: demoUser.email });
      const res = await request(app).delete(`/api/workspaces/${demoWsId}/members/${demoUser.id}`).set('Authorization', 'Bearer token');
      expect(res.status).toBe(403);
    });

    it('allows demo user to safely delete a project inside sandbox (Sandbox Destructive)', async () => {
      // First find the project
      const project = await prisma.project.findFirst({ where: { workspaceId: demoWsId } });
      
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: demoUser.id, email: demoUser.email });
      const res = await request(app).delete(`/api/workspaces/${demoWsId}/projects/${project!.id}`).set('Authorization', 'Bearer token');
      expect(res.status).toBe(200);
      
      const pAfter = await prisma.project.findUnique({ where: { id: project!.id } });
      expect(pAfter!.isDeleted).toBe(true);
    });
  });

  describe('Security', () => {
    it('normal user cannot spoof isDemo via frontend token (backend derives it from email)', async () => {
      // Suppose a normal user crafts a token, but the email doesn't match @demo.syncforge.local
      // auth middleware derives isDemo purely from the DB or email ending.
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: normalUser.id, email: normalUser.email });
      const res = await request(app).post('/api/demo/provision').set('Authorization', 'Bearer token');
      expect(res.status).toBe(403); // Backend recognized them as not demo
    });
  });
});
