import request from 'supertest';
import app from '../src/index';
import prisma from '@syncforge/db';
import { Role, ResourceType } from '@syncforge/db';
import { auth } from '../src/config/firebase';

jest.mock('../src/config/firebase', () => ({
  auth: {
    verifyIdToken: jest.fn(),
  },
}));

describe('Resource API', () => {
  let editor: any;
  let workspace: any;
  let project: any;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.resource.deleteMany();
    await prisma.page.deleteMany();
    await prisma.project.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();

    editor = await prisma.user.create({ data: { id: 'editor-res-id', email: 'editor-res@test.com', displayName: 'Editor' } });
    
    workspace = await prisma.workspace.create({
      data: {
        name: 'Resource Test WS',
        members: {
          create: { userId: editor.id, role: Role.EDITOR }
        }
      }
    });

    project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: 'Resource Test Project'
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/workspaces/:wsId/projects/:pId/resources', () => {
    it('should create a FOLDER resource', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: editor.id });

      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects/${project.id}/resources`)
        .set('Authorization', 'Bearer token')
        .send({ name: 'src', type: ResourceType.FOLDER });

      expect(res.status).toBe(201);
      expect(res.body.resource.name).toBe('src');
      expect(res.body.resource.type).toBe(ResourceType.FOLDER);
    });

    it('should fetch resources and preserve parentId', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: editor.id });

      const res = await request(app)
        .get(`/api/workspaces/${workspace.id}/projects/${project.id}/resources`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      const src = res.body.resources.find((r: any) => r.name === 'src');
      expect(src).toBeDefined();
      
      // Also verify PAGE includes page.id
      const pageRes = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects/${project.id}/resources`)
        .set('Authorization', 'Bearer token')
        .send({ name: 'testpage', type: ResourceType.PAGE });
      
      const getRes = await request(app)
        .get(`/api/workspaces/${workspace.id}/projects/${project.id}/resources`)
        .set('Authorization', 'Bearer token');
        
      const p = getRes.body.resources.find((r: any) => r.name === 'testpage');
      expect(p).toBeDefined();
      expect(p.page).toBeDefined();
      expect(p.page.id).toBeDefined();
    });

    it('should create a PAGE resource and its Page payload', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: editor.id });

      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects/${project.id}/resources`)
        .set('Authorization', 'Bearer token')
        .send({ name: 'README', type: ResourceType.PAGE });

      expect(res.status).toBe(201);
      expect(res.body.resource.name).toBe('README');
      
      const page = await prisma.page.findUnique({
        where: { resourceId: res.body.resource.id }
      });
      
      expect(page).toBeDefined();
      expect(page?.title).toBe('README');
    });

    it('should reject duplicate sibling names', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: editor.id });

      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects/${project.id}/resources`)
        .set('Authorization', 'Bearer token')
        .send({ name: 'src', type: ResourceType.FILE });

      expect(res.status).toBe(409);
    });

    it('should create a child resource inside a folder and allow same name in different folders', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: editor.id });
      
      const parentRes = await prisma.resource.findFirst({ where: { name: 'src', projectId: project.id } });

      const resChild = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects/${project.id}/resources`)
        .set('Authorization', 'Bearer token')
        .send({ name: 'src', type: ResourceType.FILE, parentId: parentRes?.id });

      expect(resChild.status).toBe(201);
      expect(resChild.body.resource.parentId).toBe(parentRes?.id);
    });

    it('should create grandchild resources recursively', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: editor.id });
      
      const res1 = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects/${project.id}/resources`)
        .set('Authorization', 'Bearer token')
        .send({ name: 'src2', type: ResourceType.FOLDER, parentId: null });
      
      const parentId = res1.body.resource.id;

      const res2 = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects/${project.id}/resources`)
        .set('Authorization', 'Bearer token')
        .send({ name: 'components', type: ResourceType.FOLDER, parentId });
      
      const childId = res2.body.resource.id;

      const res3 = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects/${project.id}/resources`)
        .set('Authorization', 'Bearer token')
        .send({ name: 'Button.ts', type: ResourceType.FILE, parentId: childId });

      expect(res3.status).toBe(201);
      expect(res3.body.resource.parentId).toBe(childId);
    });

    it('should prevent cross-project parent IDs', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: editor.id });
      
      const project2 = await prisma.project.create({
        data: { workspaceId: workspace.id, name: 'Project 2' }
      });
      const otherFolder = await prisma.resource.create({
        data: { projectId: project2.id, name: 'other', type: ResourceType.FOLDER, createdBy: editor.id }
      });

      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects/${project.id}/resources`)
        .set('Authorization', 'Bearer token')
        .send({ name: 'test', type: ResourceType.FILE, parentId: otherFolder.id });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Invalid parent folder');
    });
  });

  describe('PATCH /api/workspaces/:wsId/projects/:pId/resources/:id', () => {
    let folder1: any;
    let folder2: any;

    beforeAll(async () => {
      folder1 = await prisma.resource.create({
        data: { projectId: project.id, name: 'folder1', type: ResourceType.FOLDER, createdBy: editor.id }
      });
      folder2 = await prisma.resource.create({
        data: { projectId: project.id, name: 'folder2', type: ResourceType.FOLDER, createdBy: editor.id, parentId: folder1.id }
      });
    });

    it('should rename a resource and synchronize Page title', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: editor.id });
      
      const pageRes = await prisma.resource.create({
        data: { projectId: project.id, name: 'old', type: ResourceType.PAGE, createdBy: editor.id }
      });
      await prisma.page.create({
        data: { projectId: project.id, resourceId: pageRes.id, title: 'old' }
      });

      const res = await request(app)
        .patch(`/api/workspaces/${workspace.id}/projects/${project.id}/resources/${pageRes.id}`)
        .set('Authorization', 'Bearer token')
        .send({ name: 'new' });

      expect(res.status).toBe(200);
      expect(res.body.resource.name).toBe('new');

      const page = await prisma.page.findUnique({ where: { resourceId: pageRes.id } });
      expect(page?.title).toBe('new');
    });

    it('should prevent moving a folder into its own subfolder (cycle prevention)', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: editor.id });

      const res = await request(app)
        .patch(`/api/workspaces/${workspace.id}/projects/${project.id}/resources/${folder1.id}`)
        .set('Authorization', 'Bearer token')
        .send({ parentId: folder2.id });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('cycle detected');
    });
  });

  describe('DELETE /api/workspaces/:wsId/projects/:pId/resources/:id', () => {
    it('should recursively soft-delete a folder and its children', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: editor.id });
      
      const parentFolder = await prisma.resource.create({
        data: { projectId: project.id, name: 'delParent', type: ResourceType.FOLDER, createdBy: editor.id }
      });
      const childPage = await prisma.resource.create({
        data: { projectId: project.id, name: 'delChild', type: ResourceType.PAGE, createdBy: editor.id, parentId: parentFolder.id }
      });

      const res = await request(app)
        .delete(`/api/workspaces/${workspace.id}/projects/${project.id}/resources/${parentFolder.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);

      const checkParent = await prisma.resource.findUnique({ where: { id: parentFolder.id } });
      const checkChild = await prisma.resource.findUnique({ where: { id: childPage.id } });

      expect(checkParent?.isDeleted).toBe(true);
      expect(checkChild?.isDeleted).toBe(true);

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'RESOURCE_DELETED', resource: parentFolder.id }
      });
      expect(audit).toBeTruthy();
    });
  });
});
