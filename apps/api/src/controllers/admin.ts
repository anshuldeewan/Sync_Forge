import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '@syncforge/db';

export const listGlobalUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    let { limit = '50', page = '1' } = req.query;
    const limitNumber = Math.max(1, Math.min(parseInt(limit as string, 10) || 50, 100));
    const pageNumber = Math.max(1, parseInt(page as string, 10) || 1);
    const skip = (pageNumber - 1) * limitNumber;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          displayName: true,
          isPlatformAdmin: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: limitNumber,
        skip,
      }),
      prisma.user.count()
    ]);

    return res.json({
      users,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error) {
    console.error('Error listing global users:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch global users' } });
  }
};

export const listGlobalWorkspaces = async (req: AuthenticatedRequest, res: Response) => {
  try {
    let { limit = '50', page = '1' } = req.query;
    const limitNumber = Math.max(1, Math.min(parseInt(limit as string, 10) || 50, 100));
    const pageNumber = Math.max(1, parseInt(page as string, 10) || 1);
    const skip = (pageNumber - 1) * limitNumber;

    const [workspaces, total] = await Promise.all([
      prisma.workspace.findMany({
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          isDeleted: true,
          _count: {
            select: { members: true, projects: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limitNumber,
        skip,
      }),
      prisma.workspace.count()
    ]);

    return res.json({
      workspaces,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error) {
    console.error('Error listing global workspaces:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch global workspaces' } });
  }
};

export const listGlobalAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    let { limit = '50', page = '1' } = req.query;
    const limitNumber = Math.max(1, Math.min(parseInt(limit as string, 10) || 50, 100));
    const pageNumber = Math.max(1, parseInt(page as string, 10) || 1);
    const skip = (pageNumber - 1) * limitNumber;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        include: {
          user: {
            select: { id: true, displayName: true, email: true }
          },
          workspace: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limitNumber,
        skip,
      }),
      prisma.auditLog.count()
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
    console.error('Error listing global audit logs:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch global audit logs' } });
  }
};

export const getSystemStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [usersCount, workspacesCount, projectsCount, resourcesCount] = await Promise.all([
      prisma.user.count(),
      prisma.workspace.count({ where: { isDeleted: false } }),
      prisma.project.count({ where: { isDeleted: false } }),
      prisma.resource.count({ where: { isDeleted: false } })
    ]);

    return res.json({
      stats: {
        users: usersCount,
        workspaces: workspacesCount,
        projects: projectsCount,
        resources: resourcesCount
      }
    });
  } catch (error) {
    console.error('Error fetching system stats:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch system stats' } });
  }
};
