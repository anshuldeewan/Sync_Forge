import request from 'supertest';
import app from '../src/index';
import prisma from '@syncforge/db';
import { Role, ResourceType } from '@syncforge/db';
import { auth } from '../src/config/firebase';
import { LocalStorageProvider } from '../src/services/storage/LocalStorageProvider';

jest.mock('../src/config/firebase', () => ({
  auth: {
    verifyIdToken: jest.fn(),
  },
}));

describe('Resource Upload & Download API', () => {
  let owner: any;
  let viewer: any;
  let workspace: any;
  let project: any;
  let folder: any;
  const storage = new LocalStorageProvider();

  beforeAll(async () => {
    await prisma.fileAsset.deleteMany();
    await prisma.resource.deleteMany();
    await prisma.project.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();

    owner = await prisma.user.create({ data: { id: 'upload-owner', email: 'owner@upload.com', displayName: 'Owner' } });
    viewer = await prisma.user.create({ data: { id: 'upload-viewer', email: 'viewer@upload.com', displayName: 'Viewer' } });
    
    workspace = await prisma.workspace.create({
      data: {
        name: 'Upload Test WS',
        members: {
          create: [
            { userId: owner.id, role: Role.OWNER },
            { userId: viewer.id, role: Role.VIEWER }
          ]
        }
      }
    });

    project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: 'Upload Test Project'
      }
    });

    folder = await prisma.resource.create({
      data: { projectId: project.id, name: 'uploads', type: ResourceType.FOLDER, createdBy: owner.id }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /resources/.../upload', () => {
    it('should upload a file to the project root and create a FILE resource + FileAsset', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: owner.id });

      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects/${project.id}/resources/upload`)
        .set('Authorization', 'Bearer token')
        .attach('file', Buffer.from('hello world'), 'test.txt');

      expect(res.status).toBe(201);
      expect(res.body.resource.name).toBe('test.txt');
      expect(res.body.resource.type).toBe('FILE');
      expect(res.body.resource.parentId).toBeNull();

      const asset = await prisma.fileAsset.findUnique({ where: { resourceId: res.body.resource.id } });
      expect(asset).toBeDefined();
      expect(asset?.filename).toBe('test.txt');
      expect(asset?.size).toBeGreaterThan(0);
    });

    it('should upload a file into a specific folder', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: owner.id });

      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects/${project.id}/resources/${folder.id}/upload`)
        .set('Authorization', 'Bearer token')
        .attach('file', Buffer.from('image content'), 'image.png');

      expect(res.status).toBe(201);
      expect(res.body.resource.name).toBe('image.png');
      expect(res.body.resource.parentId).toBe(folder.id);
    });

    it('should prevent uploading files with forbidden extensions', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: owner.id });

      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects/${project.id}/resources/upload`)
        .set('Authorization', 'Bearer token')
        .attach('file', Buffer.from('malicious'), 'virus.exe');

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('File type not allowed.');
    });

    it('should prevent sibling duplicate names on upload', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: owner.id });

      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects/${project.id}/resources/upload`)
        .set('Authorization', 'Bearer token')
        .attach('file', Buffer.from('hello world 2'), 'test.txt'); // Same name as first test

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('already exists');
    });

    it('should reject upload if user is a VIEWER', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: viewer.id });

      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects/${project.id}/resources/upload`)
        .set('Authorization', 'Bearer token')
        .attach('file', Buffer.from('data'), 'viewer.txt');

      expect(res.status).toBe(403);
    });
  });

  describe('GET /resources/:resourceId/download', () => {
    it('should download a valid file with correct Content-Disposition and Content-Type', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: viewer.id }); // Viewers can download

      const resource = await prisma.resource.findFirst({ where: { name: 'test.txt', projectId: project.id } });
      expect(resource).toBeDefined();

      const res = await request(app)
        .get(`/api/workspaces/${workspace.id}/projects/${project.id}/resources/${resource!.id}/download`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.header['content-disposition']).toBe('inline; filename="test.txt"');
      expect(res.header['content-type']).toContain('text/plain');
      expect(res.text).toBe('hello world');
    });

    it('should return 404 for non-existent file', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: viewer.id });

      const res = await request(app)
        .get(`/api/workspaces/${workspace.id}/projects/${project.id}/resources/00000000-0000-0000-0000-000000000000/download`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });

    it('should allow downloading/previewing a PDF file with inline Content-Disposition', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: owner.id });

      // First upload a dummy PDF
      const uploadRes = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects/${project.id}/resources/upload`)
        .set('Authorization', 'Bearer token')
        .attach('file', Buffer.from('fake pdf data'), { filename: 'doc.pdf', contentType: 'application/pdf' });
      
      const pdfResourceId = uploadRes.body.resource.id;

      // Now fetch it as viewer to verify authenticated preview access
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: viewer.id });

      const res = await request(app)
        .get(`/api/workspaces/${workspace.id}/projects/${project.id}/resources/${pdfResourceId}/download`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toBe('application/pdf');
      expect(res.header['content-disposition']).toBe('inline; filename="doc.pdf"');
    });

    it('should reject unauthorized/IDOR access to download endpoint', async () => {
      // Create an unknown user that is not in the workspace
      const stranger = await prisma.user.create({ data: { id: 'stranger', email: 'stranger@upload.com', displayName: 'Stranger' } });
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: stranger.id });
      
      const resource = await prisma.resource.findFirst({ where: { name: 'test.txt', projectId: project.id } });

      const res = await request(app)
        .get(`/api/workspaces/${workspace.id}/projects/${project.id}/resources/${resource!.id}/download`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /resources/:resourceId', () => {
    it('should soft-delete the FILE resource and retain physical storage object', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: owner.id });

      const resource = await prisma.resource.findFirst({ where: { name: 'test.txt', projectId: project.id } });
      const asset = await prisma.fileAsset.findUnique({ where: { resourceId: resource!.id } });
      expect(asset).toBeDefined();

      // Check file exists physically
      const existsBefore = await storage.exists(asset!.path);
      expect(existsBefore).toBe(true);

      const res = await request(app)
        .delete(`/api/workspaces/${workspace.id}/projects/${project.id}/resources/${resource!.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);

      // Verify soft deletion
      const checkRes = await prisma.resource.findUnique({ where: { id: resource!.id } });
      expect(checkRes?.isDeleted).toBe(true);

      // Verify physical file was NOT deleted (soft delete safety)
      const exists = await storage.exists(asset!.path);
      expect(exists).toBe(true);
    });
  });
});
