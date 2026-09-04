import { Response } from 'express';
import { AuthorizedRequest } from '../middleware/rbac';
import prisma from '@syncforge/db';
import { ResourceType } from '@syncforge/db';
import { LocalStorageProvider } from '../services/storage/LocalStorageProvider';
import { extractZipToResources } from '../services/zip/extractor';
import { randomUUID } from 'crypto';
import path from 'path';
import { AuditService, AuditEventAction } from '../services/audit';

const storage = new LocalStorageProvider();
const FORBIDDEN_EXTENSIONS = ['.exe', '.bat', '.sh', '.cmd', '.msi', '.vbs', '.php'];

export const safeUploadResource = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId, projectId } = req.params;
    const parentId = req.params.parentId || null;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'No file uploaded.' } });
    }

    const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_BYTES || '52428800', 10); // 50MB default
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: `File size exceeds ${MAX_FILE_SIZE} bytes.` } });
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (FORBIDDEN_EXTENSIONS.includes(ext)) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'File type not allowed.' } });
    }
    
    const filename = path.basename(file.originalname);
    const trimmedName = filename.trim();

    if (parentId) {
      const parent = await prisma.resource.findFirst({
        where: { id: parentId, projectId, isDeleted: false, type: ResourceType.FOLDER }
      });
      if (!parent) {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Target folder is invalid or deleted.' } });
      }
    }

    // IDOR / RBAC Check: Ensure projectId genuinely belongs to workspaceId
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId, isDeleted: false }
    });
    if (!project) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found in this workspace.' } });
    }

    // --- ZIP EXTRACTION FLOW ---
    if (ext === '.zip' && req.query.extract === 'true') {
      try {
        const result = await extractZipToResources(
          file.buffer,
          workspaceId,
          projectId,
          req.user!.id,
          parentId
        );
        return res.status(201).json({ resource: result.rootResources[0], extracted: true, resources: result.rootResources }); // Returning the first root resource for compatibility or the whole list
      } catch (zipErr: any) {
        console.error('ZIP Extraction failed:', zipErr);
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: zipErr.message || 'Failed to extract ZIP file.' } });
      }
    }

    // --- STANDARD FILE UPLOAD FLOW ---
    const existing = await prisma.resource.findFirst({
      where: {
        projectId,
        parentId,
        name: { equals: trimmedName, mode: 'insensitive' },
        isDeleted: false
      }
    });

    if (existing) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'A resource with this name already exists in this folder.' } });
    }

    const fileAssetId = randomUUID();
    const storageKey = `workspaces/${workspaceId}/projects/${projectId}/${fileAssetId}${ext}`;

    await storage.save(storageKey, file.buffer);

    try {
      const resource = await prisma.$transaction(async (tx) => {
        const resNode = await tx.resource.create({
          data: {
            projectId,
            parentId,
            name: trimmedName,
            type: ResourceType.FILE,
            createdBy: req.user!.id
          }
        });

        await tx.fileAsset.create({
          data: {
            id: fileAssetId,
            projectId,
            resourceId: resNode.id,
            uploaderId: req.user!.id,
            filename: trimmedName,
            path: storageKey,
            mimeType: file.mimetype,
            size: file.size,
          }
        });

        await tx.revision.create({
          data: {
            resourceId: resNode.id,
            authorId: req.user!.id,
            versionNumber: 1,
            fileAssetId: fileAssetId,
            size: file.size,
            message: 'Initial upload'
          }
        });

        await AuditService.logEvent({
          workspaceId,
          userId: req.user!.id,
          action: AuditEventAction.RESOURCE_UPLOADED,
          resource: resNode.id,
          metadata: { filename: trimmedName, size: file.size, mimeType: file.mimetype }
        }, tx);

        return resNode;
      });

      res.status(201).json({ resource });
    } catch (dbError) {
      await storage.delete(storageKey).catch(() => {}); // cleanup on DB fail
      throw dbError;
    }
  } catch (error) {
    console.error('Error uploading resource file:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to upload file.' } });
  }
};

export const downloadResource = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId, projectId, resourceId } = req.params;

    const resource = await prisma.resource.findFirst({
      where: {
        id: resourceId,
        projectId,
        isDeleted: false,
        type: ResourceType.FILE,
        project: { workspaceId, isDeleted: false }
      },
      include: { fileAsset: true }
    });

    if (!resource || !resource.fileAsset) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource file not found.' } });
    }

    const fileAsset = resource.fileAsset;

    if (!(await storage.exists(fileAsset.path))) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Physical file not found.' } });
    }

    const buffer = await storage.read(fileAsset.path);

    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resource.name)}"`);
    res.setHeader('Content-Type', fileAsset.mimeType);
    res.setHeader('Content-Length', fileAsset.size);

    return res.send(buffer);
  } catch (error) {
    console.error('Error downloading resource file:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to download file.' } });
  }
};
