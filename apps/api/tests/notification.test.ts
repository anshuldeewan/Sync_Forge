import request from 'supertest';
import express from 'express';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../src/controllers/notification';
import { requireAuth } from '../src/middleware/auth';
import prisma from '@syncforge/db';

jest.mock('@syncforge/db', () => ({
  notification: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn()
  }
}));

jest.mock('../src/middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer VALID') {
      req.user = { id: 'user-valid' };
      req.workspaceMember = { role: 'VIEWER' }; // any role can fetch their own notifications
      return next();
    }
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }
}));

const app = express();
app.use(express.json());
app.get('/api/notifications', requireAuth, listNotifications);
app.patch('/api/notifications/read-all', requireAuth, markAllNotificationsRead);
app.patch('/api/notifications/:id/read', requireAuth, markNotificationRead);

describe('Notifications API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists notifications scoped to user', async () => {
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([{ id: 'notif1' }]);

    const res = await request(app)
      .get(`/api/notifications`)
      .set('Authorization', `Bearer VALID`);

    expect(res.status).toBe(200);
    expect(res.body.notifications[0].id).toBe('notif1');
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-valid' },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  });

  it('marks all as read', async () => {
    (prisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

    const res = await request(app)
      .patch(`/api/notifications/read-all`)
      .set('Authorization', `Bearer VALID`);

    expect(res.status).toBe(200);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-valid', isRead: false },
      data: { isRead: true }
    });
  });
});
