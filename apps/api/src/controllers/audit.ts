import { Response } from 'express';
import { AuthorizedRequest } from '../middleware/rbac';
import prisma from '@syncforge/db';

export const listWorkspaceAuditLogs = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    let { limit = '50', page = '1' } = req.query;

    const limitNumber = Math.max(1, Math.min(parseInt(limit as string, 10) || 50, 100));
    const pageNumber = Math.max(1, parseInt(page as string, 10) || 1);
    const skip = (pageNumber - 1) * limitNumber;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: limitNumber,
        skip,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
            }
          }
        }
      }),
      prisma.auditLog.count({
        where: { workspaceId }
      })
    ]);

    return res.json({
      auditLogs: logs,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error) {
    console.error('Error listing audit logs:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch audit logs' } });
  }
};
