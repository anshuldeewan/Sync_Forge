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

describe('Project API', () => {
  let editor: any;
  let viewer: any;
  let workspace: any;
  let project: any;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.page.deleteMany();
    await prisma.project.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();

    editor = await prisma.user.create({ data: { id: 'editor-proj-id', email: 'editor@test.com', displayName: 'Editor' } });
    viewer = await prisma.user.create({ data: { id: 'viewer-proj-id', email: 'viewer@test.com', displayName: 'Viewer' } });

    workspace = await prisma.workspace.create({
      data: {
        name: 'Project Test WS',
        members: {
          createMany: {
            data: [
              { userId: editor.id, role: Role.EDITOR },
              { userId: viewer.id, role: Role.VIEWER }
            ]
          }
        }
      }
    });

    // Add an owner and admin for testing project deletion
    await prisma.user.createMany({
      data: [
        { id: 'owner-proj-id', email: 'owner@test.com', displayName: 'Owner' },
        { id: 'admin-proj-id', email: 'admin@test.com', displayName: 'Admin' }
      ]
    });

    await prisma.workspaceMember.createMany({
      data: [
        { workspaceId: workspace.id, userId: 'owner-proj-id', role: Role.OWNER },
        { workspaceId: workspace.id, userId: 'admin-proj-id', role: Role.ADMIN }
      ]
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/workspaces/:workspaceId/projects', () => {
    it('should prevent VIEWER from creating project', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: viewer.id });
      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects`)
        .set('Authorization', 'Bearer token')
        .send({ name: 'Secret Project' });

      expect(res.status).toBe(403);
    });

    it('should allow EDITOR to create project and generate Getting Started page', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: editor.id });
      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects`)
        .set('Authorization', 'Bearer token')
        .send({ name: 'New Project' });

      expect(res.status).toBe(201);
      expect(res.body.project.name).toBe('New Project');

      project = res.body.project;

      const page = await prisma.page.findFirst({ where: { projectId: project.id } });
      expect(page).toBeDefined();
      expect(page?.title).toBe('Getting Started');

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'PROJECT_CREATED', resource: project.id }
      });
      expect(audit).toBeTruthy();
      expect((audit!.metadata as any).name).toBe('New Project');
    });

    it('should reject duplicate project names within the same workspace', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: editor.id });
      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects`)
        .set('Authorization', 'Bearer token')
        .send({ name: 'New Project' }); // Same name

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('DELETE /api/workspaces/:workspaceId/projects/:projectId', () => {
    let projectToDelete: any;

    beforeAll(async () => {
      // Create a fresh project for deletion tests
      projectToDelete = await prisma.project.create({
        data: { workspaceId: workspace.id, name: 'Project To Delete' }
      });
    });

    it('EDITOR cannot delete project → 403', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: editor.id });
      const res = await request(app)
        .delete(`/api/workspaces/${workspace.id}/projects/${projectToDelete.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('VIEWER cannot delete project → 403', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: viewer.id });
      const res = await request(app)
        .delete(`/api/workspaces/${workspace.id}/projects/${projectToDelete.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('OWNER can delete project → 200', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'owner-proj-id' });
      const res = await request(app)
        .delete(`/api/workspaces/${workspace.id}/projects/${projectToDelete.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);

      const deletedProj = await prisma.project.findFirst({ where: { id: projectToDelete.id } });
      expect(deletedProj?.isDeleted).toBe(true);

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'PROJECT_DELETED', resource: projectToDelete.id }
      });
      expect(audit).toBeTruthy();
    });

    it('ADMIN can delete project → 200', async () => {
      // Create a new project since OWNER already deleted the previous one
      const p2 = await prisma.project.create({
        data: { workspaceId: workspace.id, name: 'Admin Delete Project' }
      });

      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'admin-proj-id' });
      const res = await request(app)
        .delete(`/api/workspaces/${workspace.id}/projects/${p2.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);

      const deletedProj = await prisma.project.findFirst({ where: { id: p2.id } });
      expect(deletedProj?.isDeleted).toBe(true);
    });
  });

  describe('Cross-Workspace Tenant Isolation', () => {
    it('should prevent user from accessing project in another workspace', async () => {
      const otherUser = await prisma.user.create({ data: { id: 'other', email: 'other@test.com', displayName: 'Other' } });
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: otherUser.id });

      const res = await request(app)
        .get(`/api/workspaces/${workspace.id}/projects`)
        .set('Authorization', 'Bearer token');

      // Member not found in this workspace => 404
      expect(res.status).toBe(404);
    });
  });
});
