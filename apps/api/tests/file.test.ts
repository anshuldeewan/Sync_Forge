import request from 'supertest';
import app from '../src/index';
import prisma from '@syncforge/db';
import { Role } from '@syncforge/db';
import { auth } from '../src/config/firebase';
import * as fs from 'fs/promises';
import * as path from 'path';

jest.mock('../src/config/firebase', () => ({
  auth: {
    verifyIdToken: jest.fn(),
  },
}));

describe('File API', () => {
  let editor: any;
  let viewer: any;
  let workspace: any;
  let project: any;
  let fileAssetId: string;

  beforeAll(async () => {
    // Override storage root for tests
    process.env.FILE_STORAGE_ROOT = path.join(__dirname, 'test-storage');
    await fs.mkdir(process.env.FILE_STORAGE_ROOT, { recursive: true });

    await prisma.fileAsset.deleteMany();
    await prisma.project.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();

    editor = await prisma.user.create({ data: { id: 'file-editor-id', email: 'editorf@test.com', displayName: 'Editor' } });
    viewer = await prisma.user.create({ data: { id: 'file-viewer-id', email: 'viewerf@test.com', displayName: 'Viewer' } });

    workspace = await prisma.workspace.create({
      data: {
        name: 'File Test WS',
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

    project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: 'File Project'
      }
    });
  });

  afterAll(async () => {
    // Cleanup physical files
    if (process.env.FILE_STORAGE_ROOT) {
      await fs.rm(process.env.FILE_STORAGE_ROOT, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/workspaces/:workspaceId/projects/:projectId/files', () => {
    it('should prevent VIEWER from uploading a file', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: viewer.id });
      const buffer = Buffer.from('test content');

      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects/${project.id}/files`)
        .set('Authorization', 'Bearer token')
        .attach('file', buffer, 'test.txt');

      expect(res.status).toBe(403);
    });

    it('should allow EDITOR to upload a valid file', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: editor.id });
      const buffer = Buffer.from('test content');

      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects/${project.id}/files`)
        .set('Authorization', 'Bearer token')
        .attach('file', buffer, 'test.txt');

      expect(res.status).toBe(201);
      expect(res.body.file.filename).toBe('test.txt');
      expect(res.body.file.mimeType).toBe('text/plain');
      fileAssetId = res.body.file.id;

      // Verify DB
      const asset = await prisma.fileAsset.findUnique({ where: { id: fileAssetId } });
      expect(asset).toBeDefined();
    });

    it('should reject dangerous executable files', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: editor.id });
      const buffer = Buffer.from('test content');

      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects/${project.id}/files`)
        .set('Authorization', 'Bearer token')
        .attach('file', buffer, 'malware.exe');

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/File type not allowed/);
    });
    
    it('should reject files exceeding MAX_FILE_SIZE_BYTES', async () => {
      process.env.MAX_FILE_SIZE_BYTES = '10'; // 10 bytes limit
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: editor.id });
      const buffer = Buffer.from('this is way too large content');

      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/projects/${project.id}/files`)
        .set('Authorization', 'Bearer token')
        .attach('file', buffer, 'large.txt');

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/File size exceeds/);
      process.env.MAX_FILE_SIZE_BYTES = '5242880'; // reset
    });
  });

  describe('GET /api/workspaces/:workspaceId/projects/:projectId/files/:fileId', () => {
    it('should allow VIEWER to download the file', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: viewer.id });

      const res = await request(app)
        .get(`/api/workspaces/${workspace.id}/projects/${project.id}/files/${fileAssetId}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.text).toBe('test content');
    });

    it('should return 404 for missing file in the project', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: editor.id });

      const res = await request(app)
        .get(`/api/workspaces/${workspace.id}/projects/${project.id}/files/missing-id`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });
  
  describe('GET /api/workspaces/:workspaceId/projects/:projectId/files', () => {
    it('should allow VIEWER to list files', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: viewer.id });

      const res = await request(app)
        .get(`/api/workspaces/${workspace.id}/projects/${project.id}/files`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.files.length).toBeGreaterThanOrEqual(1);
      expect(res.body.files.some((f: any) => f.id === fileAssetId)).toBe(true);
    });
  });

  describe('DELETE /api/workspaces/:workspaceId/projects/:projectId/files/:fileId', () => {
    it('should prevent VIEWER from deleting a file', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: viewer.id });

      const res = await request(app)
        .delete(`/api/workspaces/${workspace.id}/projects/${project.id}/files/${fileAssetId}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(403);
    });

    it('should allow EDITOR to delete a file', async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: editor.id });

      const res = await request(app)
        .delete(`/api/workspaces/${workspace.id}/projects/${project.id}/files/${fileAssetId}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(204);

      // Verify DB
      const asset = await prisma.fileAsset.findUnique({ where: { id: fileAssetId } });
      expect(asset).toBeNull();
    });
  });
});
