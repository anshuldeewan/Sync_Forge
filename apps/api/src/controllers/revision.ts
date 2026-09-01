import { Request, Response } from 'express';
import prisma from '@syncforge/db';
import { z } from 'zod';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export const listRevisions = async (req: Request, res: Response) => {
  try {
    const { projectId, resourceId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Verify resource belongs to project
    const resource = await prisma.resource.findFirst({
      where: { id: resourceId, projectId, isDeleted: false }
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    const [revisions, total] = await Promise.all([
      prisma.revision.findMany({
        where: { resourceId },
        orderBy: { versionNumber: 'desc' },
        skip,
        take: limit,
        include: {
          author: { select: { id: true, displayName: true, email: true } }
        }
      }),
      prisma.revision.count({ where: { resourceId } })
    ]);

    // Omit heavy binary state snapshots in list view
    const cleanedRevisions = revisions.map(rev => {
      const { stateSnapshot, ...rest } = rev;
      return rest;
    });

    res.json({
      revisions: cleanedRevisions,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('List revisions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getRevision = async (req: Request, res: Response) => {
  try {
    const { projectId, resourceId, versionId } = req.params;

    const resource = await prisma.resource.findFirst({
      where: { id: resourceId, projectId, isDeleted: false }
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    const revision = await prisma.revision.findFirst({
      where: { id: versionId, resourceId },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
        fileAsset: true
      }
    });

    if (!revision) {
      return res.status(404).json({ error: 'Revision not found' });
    }

    res.json(revision);
  } catch (error) {
    console.error('Get revision error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const restoreRevision = async (req: Request, res: Response) => {
  try {
    const { projectId, resourceId, versionId } = req.params;
    const userId = (req as any).user.id;

    const resource = await prisma.resource.findFirst({
      where: { id: resourceId, projectId, isDeleted: false }
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    const revisionToRestore = await prisma.revision.findFirst({
      where: { id: versionId, resourceId }
    });

    if (!revisionToRestore) {
      return res.status(404).json({ error: 'Revision not found' });
    }

    // Get max version number to create a new revision
    const lastRevision = await prisma.revision.findFirst({
      where: { resourceId },
      orderBy: { versionNumber: 'desc' }
    });

    const newVersionNumber = (lastRevision?.versionNumber || 0) + 1;

    // Create the new revision representing the restore
    const newRevision = await prisma.revision.create({
      data: {
        resourceId,
        authorId: userId,
        versionNumber: newVersionNumber,
        stateSnapshot: revisionToRestore.stateSnapshot,
        fileAssetId: revisionToRestore.fileAssetId,
        size: revisionToRestore.size,
        message: `Restored from version ${revisionToRestore.versionNumber}`
      }
    });

    // Update active snapshot if it's a text/code file (Yjs state)
    if (newRevision.stateSnapshot) {
      if (resource.type === 'FILE') {
        await prisma.fileSnapshot.upsert({
          where: { resourceId },
          update: { state: newRevision.stateSnapshot },
          create: { resourceId, state: newRevision.stateSnapshot }
        });
      } else if (resource.type === 'PAGE') {
        // Handle page snapshot updates if needed, though PAGEs use DocumentSnapshot with pageId.
        // Wait, pages have resourceId but DocumentSnapshot links to pageId. We must find the page.
        const page = await prisma.page.findUnique({ where: { resourceId } });
        if (page) {
          await prisma.documentSnapshot.create({
            data: {
              pageId: page.id,
              state: newRevision.stateSnapshot
            }
          });
        }
      }

      // Notify WebSocket clients to reload this document
      const docName = resource.type === 'PAGE' 
        ? `page:${(await prisma.page.findUnique({where:{resourceId}}))?.id}` 
        : `resource:${resourceId}`;
      
      await redis.publish(`restore:${docName}`, Buffer.from([1]));
    } else if (newRevision.fileAssetId) {
      // If it's a binary file, just update the resource relation if necessary, 
      // but actually the resource FileAsset relation points to ONE fileAsset.
      // We should update the resource to point to the restored fileAssetId.
      await prisma.fileAsset.updateMany({
        where: { resourceId },
        data: { resourceId: null } // Unlink old
      });
      await prisma.fileAsset.update({
        where: { id: newRevision.fileAssetId },
        data: { resourceId } // Link restored
      });
    }

    res.json({ success: true, revision: newRevision });
  } catch (error) {
    console.error('Restore revision error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createRevision = async (req: Request, res: Response) => {
  try {
    const { projectId, resourceId } = req.params;
    const { message } = req.body;
    const userId = (req as any).user.id;

    const resource = await prisma.resource.findFirst({
      where: { id: resourceId, projectId, isDeleted: false }
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Determine current state
    let stateSnapshot: Buffer | null = null;
    let fileAssetId: string | null = null;
    let size = 0;

    if (resource.type === 'FILE') {
      // For code/text files, use the fileSnapshot
      const snap = await prisma.fileSnapshot.findUnique({ where: { resourceId } });
      if (snap) {
        stateSnapshot = snap.state;
        size = stateSnapshot.length;
      }
      
      // If no fileSnapshot exists, it might be a binary file, so check fileAsset
      if (!snap) {
         const asset = await prisma.fileAsset.findUnique({ where: { resourceId } });
         if (asset) {
           fileAssetId = asset.id;
           size = asset.size;
         } else {
           return res.status(400).json({ error: 'No content to version' });
         }
      }
    } else if (resource.type === 'PAGE') {
      const page = await prisma.page.findUnique({ where: { resourceId } });
      if (page) {
        const snap = await prisma.documentSnapshot.findFirst({
          where: { pageId: page.id },
          orderBy: { createdAt: 'desc' }
        });
        if (snap) {
          stateSnapshot = snap.state;
          size = stateSnapshot.length;
        } else {
           return res.status(400).json({ error: 'No content to version' });
        }
      } else {
        return res.status(400).json({ error: 'Page not found' });
      }
    }

    // Get max version number
    const lastRevision = await prisma.revision.findFirst({
      where: { resourceId },
      orderBy: { versionNumber: 'desc' }
    });

    const newVersionNumber = (lastRevision?.versionNumber || 0) + 1;

    // Create the new revision
    const newRevision = await prisma.revision.create({
      data: {
        resourceId,
        authorId: userId,
        versionNumber: newVersionNumber,
        stateSnapshot,
        fileAssetId,
        size,
        message: message || `Autosaved version ${newVersionNumber}`
      }
    });

    res.json({ success: true, revision: { id: newRevision.id, versionNumber: newRevision.versionNumber } });
  } catch (error) {
    console.error('Create revision error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
