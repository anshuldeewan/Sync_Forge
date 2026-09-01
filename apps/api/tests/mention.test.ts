import request from 'supertest';
import express from 'express';
import { listMembers } from '../src/controllers/member';
import { requireAuth } from '../src/middleware/auth';
import prisma from '@syncforge/db';

jest.mock('@syncforge/db', () => ({
  workspaceMember: { findMany: jest.fn() }
}));

jest.mock('../src/middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { id: 'user-owner' };
    req.workspaceMember = { role: 'OWNER' };
    return next();
  }
}));

const app = express();
app.use(express.json());
app.get('/api/workspaces/:workspaceId/members', requireAuth, listMembers);

describe('Mentions API (listMembers search)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters members by q', async () => {
    (prisma.workspaceMember.findMany as jest.Mock).mockResolvedValue([
      { user: { displayName: 'Alice' } }
    ]);

    const res = await request(app).get('/api/workspaces/ws1/members?q=alice');

    expect(res.status).toBe(200);
    expect(res.body.members[0].user.displayName).toBe('Alice');
    
    // Verify Prisma was called with correct OR clause
    expect(prisma.workspaceMember.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: 'ws1',
        user: {
          OR: [
            { displayName: { contains: 'alice', mode: 'insensitive' } },
            { email: { contains: 'alice', mode: 'insensitive' } }
          ]
        }
      },
      include: expect.any(Object)
    });
  });
});
