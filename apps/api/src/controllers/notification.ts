import { Response } from 'express';
import { AuthorizedRequest } from '../middleware/rbac';
import prisma from '@syncforge/db';

export const listNotifications = async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return res.json({ notifications });
  } catch (error) {
    console.error('Error listing notifications:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch notifications' } });
  }
};

export const markNotificationRead = async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const notification = await prisma.notification.findFirst({
      where: { id, userId }
    });

    if (!notification) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notification not found or unauthorized' } });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    return res.json({ notification: updated });
  } catch (error) {
    console.error('Error marking notification read:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update notification' } });
  }
};

export const markAllNotificationsRead = async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });

    return res.json({ status: 'ok' });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update notifications' } });
  }
};
