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
