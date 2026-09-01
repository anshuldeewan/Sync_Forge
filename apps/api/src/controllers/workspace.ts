import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AuthorizedRequest } from '../middleware/rbac';
import prisma from '@syncforge/db';
import { Role } from '@syncforge/db';
import { z } from 'zod';

const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(100)
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(100)
});

export const createWorkspace = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });

    const parsed = createWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0].message } });
    }

    const trimmedName = parsed.data.name.trim();

    const existing = await prisma.workspace.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' },
        isDeleted: false
      }
    });

    if (existing) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'A workspace with this name already exists' } });
    }

    const workspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name: trimmedName,
          members: {
            create: {
              userId: req.user!.id,
              role: Role.OWNER
            }
          }
        },
        include: {
          members: true
        }
      });
      return ws;
    });

    res.status(201).json({ workspace });
  } catch (error) {
    console.error('Error creating workspace:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create workspace' } });
  }
};

export const listWorkspaces = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });

    const workspaces = await prisma.workspace.findMany({
      where: {
        isDeleted: false,
        members: {
          some: {
            userId: req.user.id
          }
        }
      },
      include: {
        members: {
          where: { userId: req.user.id }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ workspaces });
  } catch (error) {
    console.error('Error listing workspaces:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list workspaces' } });
  }
};

export const getWorkspace = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          include: { user: true }
        },
        projects: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!workspace || workspace.isDeleted) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Workspace not found' } });
    }

    res.json({ workspace });
  } catch (error) {
    console.error('Error getting workspace:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get workspace' } });
  }
};

export const updateWorkspace = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const parsed = updateWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0].message } });
    }

    const trimmedName = parsed.data.name.trim();

    const existing = await prisma.workspace.findFirst({
      where: {
        id: { not: workspaceId },
        name: { equals: trimmedName, mode: 'insensitive' },
        isDeleted: false
      }
    });

    if (existing) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'A workspace with this name already exists' } });
    }

    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: trimmedName }
    });

    res.json({ workspace });
  } catch (error) {
    console.error('Error updating workspace:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update workspace' } });
  }
};

export const deleteWorkspace = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { isDeleted: true }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete workspace' } });
  }
};
