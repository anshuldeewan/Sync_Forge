import request from 'supertest';
import express from 'express';
import { createPage, listPages, getPage, updatePage, deletePage, getCollaborationToken } from '../src/controllers/page';
import { requireAuth } from '../src/middleware/auth';
import { requirePermission, WorkspaceAction } from '../src/middleware/rbac';
import prisma from '@syncforge/db';
import jwt from 'jsonwebtoken';

jest.mock('@syncforge/db', () => {
  return {
    page: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
    },
    workspaceMember: {
      findUnique: jest.fn(),
    }
  };
});

jest.mock('../src/middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer VALID') {
      req.user = { id: 'user1', email: 'test@example.com' };
      next();
    } else {
      res.status(401).json({ error: { message: 'Not authenticated.' } });
    }
  }
}));

jest.mock('../src/middleware/rbac', () => ({
  WorkspaceAction: {
    MANAGE_PAGES: 'MANAGE_PAGES',
    READ_PAGES: 'READ_PAGES'
  },
  requirePermission: (action: string) => (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer VALID') {
      req.workspaceMember = {
        workspaceId: req.params.workspaceId,
        userId: 'user1',
        role: req.headers['x-mock-role'] || 'OWNER'
      };
      if (req.headers['x-mock-role'] === 'VIEWER' && action === 'MANAGE_PAGES') {
        return res.status(403).json({ error: { message: 'Insufficient permissions.' } });
      }
      next();
    } else {
      res.status(401).json({ error: { message: 'Not authenticated.' } });
    }
  }
}));

const app = express();
app.use(express.json());
app.post('/api/workspaces/:workspaceId/projects/:projectId/pages', requireAuth, requirePermission(WorkspaceAction.MANAGE_PAGES), createPage);
app.get('/api/workspaces/:workspaceId/projects/:projectId/pages', requireAuth, requirePermission(WorkspaceAction.READ_PAGES), listPages);
app.get('/api/workspaces/:workspaceId/projects/:projectId/pages/:pageId', requireAuth, requirePermission(WorkspaceAction.READ_PAGES), getPage);
app.patch('/api/workspaces/:workspaceId/projects/:projectId/pages/:pageId', requireAuth, requirePermission(WorkspaceAction.MANAGE_PAGES), updatePage);
app.delete('/api/workspaces/:workspaceId/projects/:projectId/pages/:pageId', requireAuth, requirePermission(WorkspaceAction.MANAGE_PAGES), deletePage);
app.get('/api/workspaces/:workspaceId/projects/:projectId/pages/:pageId/token', requireAuth, requirePermission(WorkspaceAction.READ_PAGES), getCollaborationToken);

describe('Page Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /pages (createPage)', () => {
    it('creates a page for authorized user', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'proj1' });
      (prisma.page.create as jest.Mock).mockResolvedValue({ id: 'page1', title: 'New Page' });

      const res = await request(app)
        .post('/api/workspaces/ws1/projects/proj1/pages')
        .set('Authorization', 'Bearer VALID')
        .send({ title: 'New Page' });

      expect(res.status).toBe(201);
      expect(res.body.page.title).toBe('New Page');
    });

    it('rejects VIEWER from creating a page', async () => {
      const res = await request(app)
        .post('/api/workspaces/ws1/projects/proj1/pages')
        .set('Authorization', 'Bearer VALID')
        .set('x-mock-role', 'VIEWER')
        .send({ title: 'New Page' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /pages (listPages)', () => {
    it('returns list of pages', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'proj1' });
      (prisma.page.findMany as jest.Mock).mockResolvedValue([{ id: 'page1', title: 'Page 1' }]);

      const res = await request(app)
        .get('/api/workspaces/ws1/projects/proj1/pages')
        .set('Authorization', 'Bearer VALID');

      expect(res.status).toBe(200);
      expect(res.body.pages.length).toBe(1);
    });
  });

  describe('GET /pages/:pageId (getPage)', () => {
    it('returns a specific page', async () => {
      (prisma.page.findFirst as jest.Mock).mockResolvedValue({ id: 'page1', title: 'Page 1' });

      const res = await request(app)
        .get('/api/workspaces/ws1/projects/proj1/pages/page1')
        .set('Authorization', 'Bearer VALID');

      expect(res.status).toBe(200);
      expect(res.body.page.title).toBe('Page 1');
    });

    it('returns 404 if page does not exist or mismatch', async () => {
      (prisma.page.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/workspaces/ws1/projects/proj1/pages/page1')
        .set('Authorization', 'Bearer VALID');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /pages/:pageId/token (getCollaborationToken)', () => {
    it('generates a valid collaboration token with exact payload binding', async () => {
      (prisma.page.findFirst as jest.Mock).mockResolvedValue({ id: 'page1', title: 'Page 1' });

      const res = await request(app)
        .get('/api/workspaces/ws1/projects/proj1/pages/page1/token')
        .set('Authorization', 'Bearer VALID')
        .set('x-mock-role', 'EDITOR');

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();

      const decoded = jwt.decode(res.body.token) as any;
      expect(decoded.purpose).toBe('collaboration');
      expect(decoded.workspaceId).toBe('ws1');
      expect(decoded.projectId).toBe('proj1');
      expect(decoded.pageId).toBe('page1');
      expect(decoded.userId).toBe('user1');
      expect(decoded.role).toBe('EDITOR');
    });

    it('rejects token generation if page mismatch', async () => {
      (prisma.page.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/workspaces/ws1/projects/proj1/pages/wrong-page/token')
        .set('Authorization', 'Bearer VALID');

      expect(res.status).toBe(404);
    });
  });
});
