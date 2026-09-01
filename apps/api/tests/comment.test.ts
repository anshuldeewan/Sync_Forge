import request from 'supertest';
import express from 'express';
import { listComments, createComment, updateComment, deleteComment } from '../src/controllers/comment';
import { requireAuth } from '../src/middleware/auth';
import prisma from '@syncforge/db';

jest.mock('@syncforge/db', () => ({
  page: { findFirst: jest.fn() },
  comment: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  mention: { create: jest.fn() },
  notification: { create: jest.fn() },
  workspaceMember: { findUnique: jest.fn(), findFirst: jest.fn() }
}));

jest.mock('../src/middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer VALID') {
      req.user = { id: 'user-owner' };
      req.workspaceMember = { role: 'OWNER' };
      return next();
    }
    if (req.headers.authorization === 'Bearer VIEWER') {
      req.user = { id: 'user-viewer' };
      req.workspaceMember = { role: 'VIEWER' };
      return next();
    }
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }
}));

const app = express();
app.use(express.json());
app.get('/api/workspaces/:workspaceId/projects/:projectId/pages/:pageId/comments', requireAuth, listComments);
app.post('/api/workspaces/:workspaceId/projects/:projectId/pages/:pageId/comments', requireAuth, createComment);
app.patch('/api/workspaces/:workspaceId/projects/:projectId/pages/:pageId/comments/:commentId', requireAuth, updateComment);
app.delete('/api/workspaces/:workspaceId/projects/:projectId/pages/:pageId/comments/:commentId', requireAuth, deleteComment);

describe('Comments API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows OWNER to create a comment', async () => {
    (prisma.page.findFirst as jest.Mock).mockResolvedValue({ id: 'page1' });
    (prisma.comment.create as jest.Mock).mockResolvedValue({ id: 'comment1', content: 'test', author: { displayName: 'Owner' } });

    const res = await request(app)
      .post(`/api/workspaces/ws1/projects/proj1/pages/page1/comments`)
      .set('Authorization', `Bearer VALID`)
      .send({ content: 'test' });

    expect(res.status).toBe(201);
    expect(res.body.comment.content).toBe('test');
  });

  it('prevents VIEWER from creating a comment', async () => {
    (prisma.page.findFirst as jest.Mock).mockResolvedValue({ id: 'page1' });

    const res = await request(app)
      .post(`/api/workspaces/ws1/projects/proj1/pages/page1/comments`)
      .set('Authorization', `Bearer VIEWER`)
      .send({ content: 'test' });

    expect(res.status).toBe(403);
  });
});
