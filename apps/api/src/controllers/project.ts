import { Response } from 'express';
import { AuthorizedRequest } from '../middleware/rbac';
import prisma from '@syncforge/db';
import { z } from 'zod';
import { AuditService, AuditEventAction } from '../services/audit';

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100)
});

const updateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100)
});

export const createProject = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0].message } });
    }

    const trimmedName = parsed.data.name.trim();

    const existing = await prisma.project.findFirst({
      where: {
        workspaceId,
        name: { equals: trimmedName, mode: 'insensitive' },
        isDeleted: false
      }
    });

    if (existing) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'A project with this name already exists in the workspace' } });
    }

    const project = await prisma.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: {
          workspaceId,
          name: trimmedName
        }
      });

      // Atomically create a "Getting Started" page
      await tx.page.create({
        data: {
          projectId: p.id,
          title: 'Getting Started',
        }
      });

      await AuditService.logEvent({
        workspaceId,
        userId: req.user!.id,
        action: AuditEventAction.PROJECT_CREATED,
        resource: p.id,
        metadata: { name: trimmedName }
      }, tx);

      return p;
    });

    res.status(201).json({ project });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create project' } });
  }
};

export const listProjects = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const projects = await prisma.project.findMany({
      where: { workspaceId, isDeleted: false },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ projects });
  } catch (error) {
    console.error('Error listing projects:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list projects' } });
  }
};

export const getProject = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId, projectId } = req.params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId, isDeleted: false },
      include: {
        pages: {
          where: { parentId: null }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }

    res.json({ project });
  } catch (error) {
    console.error('Error getting project:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get project' } });
  }
};

export const updateProject = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId, projectId } = req.params;

    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0].message } });
    }

    const trimmedName = parsed.data.name.trim();

    const existing = await prisma.project.findFirst({
      where: {
        workspaceId,
        id: { not: projectId },
        name: { equals: trimmedName, mode: 'insensitive' },
        isDeleted: false
      }
    });

    if (existing) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'A project with this name already exists in the workspace' } });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId, isDeleted: false }
    });

    if (!project) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { name: trimmedName }
    });

    res.json({ project: updated });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update project' } });
  }
};

export const deleteProject = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId, projectId } = req.params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId, isDeleted: false }
    });

    if (!project) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: { isDeleted: true }
      });

      await AuditService.logEvent({
        workspaceId,
        userId: req.user!.id,
        action: AuditEventAction.PROJECT_DELETED,
        resource: projectId
      }, tx);
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete project' } });
  }
};
