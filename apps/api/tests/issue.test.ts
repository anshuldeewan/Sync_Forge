import request from 'supertest';
import express from 'express';
import { listIssues, createIssue, getIssue, updateIssue, deleteIssue } from '../src/controllers/issue';
import { requireAuth } from '../src/middleware/auth';
import prisma from '@syncforge/db';

jest.mock('@syncforge/db', () => ({
  $transaction: jest.fn().mockImplementation(async (callback) => {
    return callback(require('@syncforge/db'));
  }),
  issue: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  workspaceMember: { findUnique: jest.fn() },
  notification: { create: jest.fn() },
  auditLog: { create: jest.fn() }
}));

jest.mock('../src/services/audit', () => ({
  AuditService: {
    logEvent: jest.fn()
  },
  AuditEventAction: {
    ISSUE_CREATED: 'ISSUE_CREATED'
  }
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
app.get('/api/workspaces/:workspaceId/projects/:projectId/issues', requireAuth, listIssues);
app.post('/api/workspaces/:workspaceId/projects/:projectId/issues', requireAuth, createIssue);
app.get('/api/workspaces/:workspaceId/projects/:projectId/issues/:issueId', requireAuth, getIssue);
app.patch('/api/workspaces/:workspaceId/projects/:projectId/issues/:issueId', requireAuth, updateIssue);
app.delete('/api/workspaces/:workspaceId/projects/:projectId/issues/:issueId', requireAuth, deleteIssue);

describe('Issues API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows OWNER to create an issue', async () => {
    (prisma.issue.create as jest.Mock).mockResolvedValue({ id: 'issue1', title: 'Fix bug' });

    const res = await request(app)
      .post(`/api/workspaces/ws1/projects/proj1/issues`)
      .set('Authorization', `Bearer VALID`)
      .send({ title: 'Fix bug', description: 'desc' });

    expect(res.status).toBe(201);
    expect(res.body.issue.title).toBe('Fix bug');
    
    const { AuditService } = require('../src/services/audit');
    expect(AuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ISSUE_CREATED', resource: 'issue1' }),
      expect.anything()
    );
  });

  it('prevents VIEWER from creating an issue', async () => {
    const res = await request(app)
      .post(`/api/workspaces/ws1/projects/proj1/issues`)
      .set('Authorization', `Bearer VIEWER`)
      .send({ title: 'Fix bug' });

    expect(res.status).toBe(403);
  });

  it('dispatches notification on assignment during create', async () => {
    (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue({ role: 'EDITOR' });
    (prisma.issue.create as jest.Mock).mockResolvedValue({ id: 'issue1', title: 'Fix bug' });

    const res = await request(app)
      .post(`/api/workspaces/ws1/projects/proj1/issues`)
      .set('Authorization', `Bearer VALID`)
      .send({ title: 'Fix bug', assigneeId: 'user-other' });

    expect(res.status).toBe(201);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-other',
        type: 'ISSUE_ASSIGNED',
        message: 'You were assigned to issue "Fix bug"'
      }
    });
  });
});
