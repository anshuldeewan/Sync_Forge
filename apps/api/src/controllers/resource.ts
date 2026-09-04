import { Response } from 'express';
import { AuthorizedRequest } from '../middleware/rbac';
import prisma from '@syncforge/db';
import { ResourceType } from '@syncforge/db';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { AuditService, AuditEventAction } from '../services/audit';

const JWT_SECRET = process.env.JWT_SECRET || 'syncforge_super_secret_for_collaboration_only';

const createResourceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  type: z.nativeEnum(ResourceType),
  parentId: z.string().uuid().optional().nullable()
});

const updateResourceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parentId: z.string().uuid().optional().nullable(),
  position: z.number().optional()
});

// GET /resources
export const listResources = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const resources = await prisma.resource.findMany({
      where: { projectId, isDeleted: false },
      orderBy: [
        { type: 'asc' }, // FOLDER first
        { position: 'asc' },
        { name: 'asc' }
      ],
      include: {
        page: { select: { id: true } }
      }
    });

    res.json({ resources });
  } catch (error) {
    console.error('Error listing resources:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list resources' } });
  }
};

// POST /resources
export const createResource = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const user = req.user!;

    const parsed = createResourceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0].message } });
    }

    const { name, type, parentId } = parsed.data;
    const trimmedName = name.trim();

    // Check sibling uniqueness
    const existing = await prisma.resource.findFirst({
      where: {
        projectId,
        parentId: parentId || null,
        name: { equals: trimmedName, mode: 'insensitive' },
        isDeleted: false
      }
    });

    if (existing) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'A resource with this name already exists in this folder' } });
    }

    if (parentId) {
      const parent = await prisma.resource.findUnique({ where: { id: parentId } });
      if (!parent || parent.projectId !== projectId) {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid parent folder' } });
      }
    }

    const resource = await prisma.$transaction(async (tx) => {
      const resNode = await tx.resource.create({
        data: {
          projectId,
          parentId: parentId || null,
          name: trimmedName,
          type,
          createdBy: user.id
        }
      });

      if (type === ResourceType.PAGE) {
        await tx.page.create({
          data: {
            projectId,
            resourceId: resNode.id,
            title: trimmedName,
            parentId: null // Legacy field, keeping null
          }
        });
      }
      
      // If FILE, just create metadata node. FileAsset logic handled in upload endpoint later.

      const populated = await tx.resource.findUnique({
        where: { id: resNode.id },
        include: { page: { select: { id: true } } }
      });
      return populated;
    });

    res.status(201).json({ resource });
  } catch (error) {
    console.error('Error creating resource:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create resource' } });
  }
};

// PATCH /resources/:id
export const updateResource = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { projectId, id } = req.params;

    const parsed = updateResourceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0].message } });
    }

    const { name, parentId, position } = parsed.data;
    
    const resource = await prisma.resource.findFirst({
      where: { id, projectId, isDeleted: false }
    });

    if (!resource) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
    }

    const updateData: any = {};

    if (name !== undefined) {
      const trimmedName = name.trim();
      const checkParentId = parentId !== undefined ? (parentId || null) : resource.parentId;

      // Check unique name
      const existing = await prisma.resource.findFirst({
        where: {
          id: { not: id },
          projectId,
          parentId: checkParentId,
          name: { equals: trimmedName, mode: 'insensitive' },
          isDeleted: false
        }
      });

      if (existing) {
        return res.status(409).json({ error: { code: 'CONFLICT', message: 'A resource with this name already exists in the target folder' } });
      }
      
      updateData.name = trimmedName;
    }

    if (parentId !== undefined) {
      const newParentId = parentId || null;
      if (newParentId === id) {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Resource cannot be its own parent' } });
      }

      // Cycle prevention and cross-project check
      if (newParentId) {
        let currentParent = await prisma.resource.findUnique({ where: { id: newParentId } });
        if (!currentParent || currentParent.projectId !== projectId) {
          return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid parent folder' } });
        }
        while (currentParent) {
          if (currentParent.id === id) {
            return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Cannot move a folder into its own subfolder (cycle detected)' } });
          }
          if (!currentParent.parentId) break;
          currentParent = await prisma.resource.findUnique({ where: { id: currentParent.parentId } });
        }
      }
      
      updateData.parentId = newParentId;
    }

    if (position !== undefined) {
      updateData.position = position;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const resNode = await tx.resource.update({
        where: { id },
        data: updateData
      });

      // Synchronize legacy Page title if name was updated
      if (updateData.name && resNode.type === ResourceType.PAGE) {
        await tx.page.updateMany({
          where: { resourceId: resNode.id },
          data: { title: updateData.name }
        });
      }

      return resNode;
    });

    res.json({ resource: updated });
  } catch (error) {
    console.error('Error updating resource:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update resource' } });
  }
};

// DELETE /resources/:id
export const deleteResource = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { projectId, id } = req.params;

    const resource = await prisma.resource.findFirst({
      where: { id, projectId, isDeleted: false }
    });

    if (!resource) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
    }

    // Since we need to physically delete files, we'll instantiate LocalStorageProvider here
    const { LocalStorageProvider } = await import('../services/storage/LocalStorageProvider');
    const storage = new LocalStorageProvider();

    // Helper for recursive soft delete
    const deleteRecursively = async (resourceId: string, tx: any) => {
      // 1. Mark resource as deleted
      await tx.resource.update({
        where: { id: resourceId },
        data: { isDeleted: true }
      });

      // Removed physical deletion. Physical files should only be deleted during a hard "Empty Trash" operation
      // to ensure historical revisions and soft-deleted files remain recoverable.

      // 3. Recurse for children
      const children = await tx.resource.findMany({
        where: { parentId: resourceId, isDeleted: false }
      });

      for (const child of children) {
        await deleteRecursively(child.id, tx);
      }
    };

    await prisma.$transaction(async (tx) => {
      await deleteRecursively(id, tx);
      
      await AuditService.logEvent({
        workspaceId: req.workspaceMember!.workspaceId,
        userId: req.user!.id,
        action: AuditEventAction.RESOURCE_DELETED,
        resource: id
      }, tx);
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting resource:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete resource' } });
  }
};

export const getCollaborationToken = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId, projectId, id } = req.params;
    const user = req.user!;
    const role = req.workspaceMember!.role; // Populated by RBAC middleware

    // Verify relationships and ownership
    const resource = await prisma.resource.findFirst({
      where: {
        id,
        projectId,
        project: { workspaceId, isDeleted: false },
        isDeleted: false
      }
    });

    if (!resource) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found or access denied.' } });
    }

    if (resource.type === ResourceType.FOLDER) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Cannot collaborate on a folder.' } });
    }

    // Generate short-lived JWT token securely tying this user/role to exactly this resource
    const token = jwt.sign(
      {
        userId: user.id,
        workspaceId,
        projectId,
        resourceId: id, // Notice we use resourceId instead of pageId for modern flow
        // To remain compatible, we can still pass pageId if it's a PAGE.
        ...(resource.type === ResourceType.PAGE ? { pageId: resource.id } : {}),
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
