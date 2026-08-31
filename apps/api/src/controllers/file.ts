import { Response } from 'express';
import { AuthorizedRequest } from '../middleware/rbac';
import prisma from '@syncforge/db';
import { LocalStorageProvider } from '../services/storage/LocalStorageProvider';
import { randomUUID } from 'crypto';
import path from 'path';

// We could inject this via DI in a larger app
const storage = new LocalStorageProvider();

const FORBIDDEN_EXTENSIONS = ['.exe', '.bat', '.sh', '.cmd', '.msi', '.vbs', '.js', '.php'];

export const uploadFile = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId, projectId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'No file uploaded.' } });
    }

    const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_BYTES || '5242880', 10);
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: `File size exceeds ${MAX_FILE_SIZE} bytes.` } });
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (FORBIDDEN_EXTENSIONS.includes(ext)) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'File type not allowed.' } });
    }

    // Verify project belongs to workspace
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspaceId,
        isDeleted: false
      }
    });

    if (!project) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found.' } });
    }

    const fileId = randomUUID();
    const storageKey = `workspaces/${workspaceId}/projects/${projectId}/${fileId}${ext}`;

    await storage.save(storageKey, file.buffer);

    const asset = await prisma.fileAsset.create({
      data: {
        id: fileId,
        projectId,
        uploaderId: req.user!.id,
        filename: path.basename(file.originalname),
        path: storageKey,
        mimeType: file.mimetype,
        size: file.size,
      }
    });

    return res.status(201).json({ file: asset });
  } catch (error) {
    console.error('Error uploading file:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to upload file.' } });
  }
};

export const listFiles = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId, projectId } = req.params;

    // Verify project belongs to workspace
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspaceId,
        isDeleted: false
      }
    });

    if (!project) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found.' } });
    }

    const files = await prisma.fileAsset.findMany({
      where: { projectId },
      include: {
        uploader: {
          select: {
            id: true,
            displayName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ files });
  } catch (error) {
    console.error('Error listing files:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list files.' } });
  }
};

export const downloadFile = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId, projectId, fileId } = req.params;

    const fileAsset = await prisma.fileAsset.findFirst({
      where: {
        id: fileId,
        projectId,
        project: {
          workspaceId,
          isDeleted: false
        }
      }
    });

    if (!fileAsset) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found.' } });
    }

    if (!(await storage.exists(fileAsset.path))) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Physical file not found.' } });
    }

    const buffer = await storage.read(fileAsset.path);

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileAsset.filename)}"`);
    res.setHeader('Content-Type', fileAsset.mimeType);
    res.setHeader('Content-Length', fileAsset.size);

    return res.send(buffer);
  } catch (error) {
    console.error('Error downloading file:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to download file.' } });
  }
};

export const deleteFile = async (req: AuthorizedRequest, res: Response) => {
  try {
    const { workspaceId, projectId, fileId } = req.params;

    const fileAsset = await prisma.fileAsset.findFirst({
      where: {
        id: fileId,
        projectId,
        project: {
          workspaceId,
          isDeleted: false
        }
      }
    });

    if (!fileAsset) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found.' } });
    }

    await storage.delete(fileAsset.path);
    await prisma.fileAsset.delete({ where: { id: fileId } });

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting file:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete file.' } });
  }
};
