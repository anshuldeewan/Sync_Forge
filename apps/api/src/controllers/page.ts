import { Response } from 'express';
import { AuthorizedRequest } from '../middleware/rbac';
import prisma from '@syncforge/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'syncforge_super_secret_for_collaboration_only';

export const createPage = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId, projectId } = req.params;
    const { title, parentId } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Valid title is required' } });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId, isDeleted: false }
    });

    if (!project) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found.' } });
    }

    const page = await prisma.page.create({
      data: {
        projectId,
        title: title.trim(),
        parentId: parentId || null
      }
    });

    return res.status(201).json({ page });
  } catch (error) {
    console.error('Error creating page:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create page' } });
  }
};

export const listPages = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId, projectId } = req.params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId, isDeleted: false }
    });

    if (!project) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found.' } });
    }

    const pages = await prisma.page.findMany({
      where: { projectId },
      select: {
        id: true,
        projectId: true,
        parentId: true,
        title: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'asc' }
    });

    return res.json({ pages });
  } catch (error) {
    console.error('Error listing pages:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list pages' } });
  }
};

export const getPage = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId, projectId, pageId } = req.params;

    const page = await prisma.page.findFirst({
      where: {
        id: pageId,
        projectId,
        project: { workspaceId, isDeleted: false }
      },
      select: {
        id: true,
        projectId: true,
        parentId: true,
        title: true,
        createdAt: true,
        updatedAt: true
        // we deliberately do not return `content` here as it is binary Yjs state. The editor will fetch it via WebSocket.
      }
    });

    if (!page) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found.' } });
    }

    return res.json({ page });
  } catch (error) {
    console.error('Error getting page:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get page' } });
  }
};

export const updatePage = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId, projectId, pageId } = req.params;
    const { title, parentId } = req.body;

    const existingPage = await prisma.page.findFirst({
      where: {
        id: pageId,
        projectId,
        project: { workspaceId, isDeleted: false }
      }
    });

    if (!existingPage) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found.' } });
    }

    const page = await prisma.page.update({
      where: { id: pageId },
      data: {
        ...(title && { title: title.trim() }),
        ...(parentId !== undefined && { parentId })
      }
    });

    return res.json({ page });
  } catch (error) {
    console.error('Error updating page:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update page' } });
  }
};

export const deletePage = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId, projectId, pageId } = req.params;

    const existingPage = await prisma.page.findFirst({
      where: {
        id: pageId,
        projectId,
        project: { workspaceId, isDeleted: false }
      }
    });

    if (!existingPage) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found.' } });
    }

    await prisma.page.delete({ where: { id: pageId } });

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting page:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete page' } });
  }
};

export const getCollaborationToken = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId, projectId, pageId } = req.params;
    const user = req.user!;
    const role = req.workspaceMember!.role; // Populated by RBAC middleware

    // Verify relationships
    const existingPage = await prisma.page.findFirst({
      where: {
        id: pageId,
        projectId,
        project: { workspaceId, isDeleted: false }
      }
    });

    if (!existingPage) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Page not found or access denied.' } });
    }

    // Generate short-lived JWT token securely tying this user/role to exactly this page
    const token = jwt.sign(
      {
        userId: user.id,
        workspaceId,
        projectId,
        pageId,
        role,
        purpose: 'collaboration'
      },
      JWT_SECRET,
      { expiresIn: '5m' } // Short-lived token
    );

    return res.json({ token, role });
  } catch (error) {
    console.error('Error generating token:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to generate token' } });
  }
};
