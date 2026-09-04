import { Response } from 'express';
import { AuthorizedRequest } from '../middleware/rbac';
import prisma from '@syncforge/db';

export const listWorkspaceAuditLogs = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    let { limit = '50', page = '1', action, search, startDate, endDate } = req.query;

    const limitNumber = Math.max(1, Math.min(parseInt(limit as string, 10) || 50, 100));
    const pageNumber = Math.max(1, parseInt(page as string, 10) || 1);
    const skip = (pageNumber - 1) * limitNumber;

    // Build the dynamic where clause
    const whereClause: any = {
      workspaceId
    };

    // Filter by action (e.g. 'CREATE', 'UPDATE', 'DELETE')
    if (action && typeof action === 'string') {
      whereClause.action = {
        contains: action,
        mode: 'insensitive'
      };
    }

    // Filter by Date Range
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate && typeof startDate === 'string' && !isNaN(Date.parse(startDate))) {
        whereClause.createdAt.gte = new Date(startDate);
      }
      if (endDate && typeof endDate === 'string' && !isNaN(Date.parse(endDate))) {
        whereClause.createdAt.lte = new Date(endDate);
      }
      if (Object.keys(whereClause.createdAt).length === 0) {
        delete whereClause.createdAt;
      }
    }

    // Search across user email/name or resource
    if (search && typeof search === 'string') {
      whereClause.OR = [
        {
          resource: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          user: {
            is: {
              OR: [
                {
                  email: {
                    contains: search,
                    mode: 'insensitive'
                  }
                },
                {
                  displayName: {
                    contains: search,
                    mode: 'insensitive'
                  }
                }
              ]
            }
          }
        }
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: whereClause,
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
        where: whereClause
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
