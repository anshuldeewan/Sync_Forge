import yauzl from 'yauzl';
import path from 'path';
import { randomUUID } from 'crypto';
import { PrismaClient, ResourceType } from '@syncforge/db';
import { LocalStorageProvider } from '../storage/LocalStorageProvider';
import { LIMITS } from '../../config/limits';

const storage = new LocalStorageProvider();
const prisma = new PrismaClient();

interface ExtractorResult {
  rootResources: any[]; // The resources created at the root level of extraction
}

export const extractZipToResources = async (
  buffer: Buffer,
  workspaceId: string,
  projectId: string,
  uploaderId: string,
  baseParentId: string | null
): Promise<ExtractorResult> => {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      if (!zipfile) return reject(new Error('Failed to read zipfile'));

      let entryCount = 0;
      let uncompressedSize = 0;
      const writtenStorageKeys: string[] = [];
      const entriesToProcess: yauzl.Entry[] = [];

      zipfile.readEntry();

      zipfile.on('entry', (entry: yauzl.Entry) => {
        entryCount++;
        if (entryCount > LIMITS.ZIP_MAX_ENTRIES) {
          zipfile.close();
          return reject(new Error(`Exceeded maximum zip entries (${LIMITS.ZIP_MAX_ENTRIES})`));
        }
        if (entry.uncompressedSize) {
          uncompressedSize += entry.uncompressedSize;
          if (uncompressedSize > LIMITS.ZIP_MAX_UNCOMPRESSED_SIZE) {
            zipfile.close();
            return reject(new Error(`Exceeded maximum uncompressed size (${LIMITS.ZIP_MAX_UNCOMPRESSED_SIZE} bytes)`));
          }
        }

        // --- ZIP SLIP DEFENSE IN DEPTH ---
        const fileName = entry.fileName;
        if (fileName.length > LIMITS.ZIP_MAX_PATH_LENGTH) {
          zipfile.close();
          return reject(new Error(`Path too long: ${fileName}`));
        }
        if (fileName.includes('\0')) {
          zipfile.close();
          return reject(new Error(`Invalid character in path: ${fileName}`));
        }
        if (fileName.startsWith('/') || fileName.startsWith('\\') || /^[a-zA-Z]:/.test(fileName)) {
          zipfile.close();
          return reject(new Error(`Absolute paths not allowed: ${fileName}`));
        }
        if (fileName.includes('..') || fileName.includes('./')) { // simple traversal check
          zipfile.close();
          return reject(new Error(`Path traversal detected: ${fileName}`));
        }
        
        const normalized = path.posix.normalize(fileName.replace(/\\/g, '/'));
        if (normalized.startsWith('..')) {
          zipfile.close();
          return reject(new Error(`Path traversal detected after normalization: ${fileName}`));
        }

        entriesToProcess.push(entry);
        zipfile.readEntry();
      });

      zipfile.on('end', async () => {
        try {
          // Process entries safely
          const result = await processEntries(
            zipfile,
            entriesToProcess,
            workspaceId,
            projectId,
            uploaderId,
            baseParentId,
            writtenStorageKeys
          );
          resolve(result);
        } catch (processErr) {
          // Atomic Rollback: clean up any physical files written
          await cleanupPhysicalFiles(writtenStorageKeys);
          reject(processErr);
        }
      });

      zipfile.on('error', async (zipErr) => {
        await cleanupPhysicalFiles(writtenStorageKeys);
        reject(zipErr);
      });
    });
  });
};

const readEntryData = (zipfile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, readStream) => {
      if (err) return reject(err);
      if (!readStream) return reject(new Error('Failed to open read stream'));
      const chunks: Buffer[] = [];
      readStream.on('data', chunk => chunks.push(chunk));
      readStream.on('end', () => resolve(Buffer.concat(chunks)));
      readStream.on('error', reject);
    });
  });
};

const cleanupPhysicalFiles = async (keys: string[]) => {
  for (const key of keys) {
    try {
      await storage.delete(key);
    } catch (e) {
      console.error(`Failed to cleanup orphaned file ${key}:`, e);
    }
  }
};

const getUniqueName = async (
  tx: any,
  projectId: string,
  parentId: string | null,
  originalName: string
): Promise<string> => {
  let safeName = originalName;
  let counter = 1;
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);

  while (true) {
    const existing = await tx.resource.findFirst({
      where: {
        projectId,
        parentId,
        name: { equals: safeName, mode: 'insensitive' },
        isDeleted: false
      }
    });
    if (!existing) return safeName;
    safeName = `${base} (${counter})${ext}`;
    counter++;
  }
};

const processEntries = async (
  zipfile: yauzl.ZipFile,
  entries: yauzl.Entry[],
  workspaceId: string,
  projectId: string,
  uploaderId: string,
  baseParentId: string | null,
  writtenStorageKeys: string[]
): Promise<ExtractorResult> => {
  
  // Create a map to hold the physical files in memory before DB transaction
  // Note: For large archives, streaming directly to storage is better. 
  // Since our limit is 50MB, holding uncompressed in memory is acceptable for Phase 8H.
  const entryBuffers = new Map<string, Buffer>();
  
  for (const entry of entries) {
    if (!entry.fileName.endsWith('/')) {
      const buffer = await readEntryData(zipfile, entry);
      entryBuffers.set(entry.fileName, buffer);
    }
  }

  // Use a single Prisma transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    const folders: Record<string, string> = { '': baseParentId || '' };
    const rootResources: any[] = [];
    
    // Sort entries by depth to ensure parent folders are created first
    const sortedEntries = [...entries].sort((a, b) => {
      const depthA = a.fileName.split('/').length;
      const depthB = b.fileName.split('/').length;
      return depthA - depthB;
    });

    for (const entry of sortedEntries) {
      const normalizedPath = path.posix.normalize(entry.fileName.replace(/\\/g, '/'));
      const isDirectory = normalizedPath.endsWith('/');
      const cleanPath = isDirectory ? normalizedPath.slice(0, -1) : normalizedPath;
      
      const parts = cleanPath.split('/');
      const name = parts.pop()!;
      if (!name) continue; // Skip root or empty parts

      const parentPath = parts.join('/');
      
      let currentParentId = folders[parentPath];
      
      // Implicitly create missing intermediate folders if the ZIP lacks explicit dir entries
      if (currentParentId === undefined && parentPath !== '') {
        const pathSegments = parentPath.split('/');
        let buildPath = '';
        let lastId = baseParentId || '';
        
        for (const segment of pathSegments) {
          buildPath = buildPath ? `${buildPath}/${segment}` : segment;
          if (folders[buildPath] === undefined) {
            const safeFolderName = await getUniqueName(tx, projectId, lastId || null, segment);
            const newFolder = await tx.resource.create({
              data: {
                projectId,
                parentId: lastId || null,
                name: safeFolderName,
                type: ResourceType.FOLDER,
                createdBy: uploaderId
              }
            });
            folders[buildPath] = newFolder.id;
            if (!lastId) rootResources.push(newFolder);
          }
          lastId = folders[buildPath];
        }
        currentParentId = folders[parentPath];
      }

      // Check unique name and deduplicate
      const safeName = await getUniqueName(tx, projectId, currentParentId || null, name);

      if (isDirectory) {
        const newFolder = await tx.resource.create({
          data: {
            projectId,
            parentId: currentParentId || null,
            name: safeName,
            type: ResourceType.FOLDER,
            createdBy: uploaderId
          }
        });
        folders[cleanPath] = newFolder.id;
        if (!currentParentId) rootResources.push(newFolder);
      } else {
        const fileAssetId = randomUUID();
        const ext = path.extname(safeName).toLowerCase();
        const storageKey = `workspaces/${workspaceId}/projects/${projectId}/${fileAssetId}${ext}`;
        const buffer = entryBuffers.get(entry.fileName)!;

        // Write physical file
        await storage.save(storageKey, buffer);
        writtenStorageKeys.push(storageKey);

        const newFile = await tx.resource.create({
          data: {
            projectId,
            parentId: currentParentId || null,
            name: safeName,
            type: ResourceType.FILE,
            createdBy: uploaderId
          }
        });

        // Determine a basic mimetype (could use mime-types library, fallback to octet-stream)
        const mimeType = 'application/octet-stream'; 

        await tx.fileAsset.create({
          data: {
            id: fileAssetId,
            projectId,
            resourceId: newFile.id,
            uploaderId,
            filename: safeName,
            path: storageKey,
            mimeType,
            size: buffer.length
          }
        });

        await tx.revision.create({
          data: {
            resourceId: newFile.id,
            authorId: uploaderId,
            versionNumber: 1,
            fileAssetId: fileAssetId,
            size: buffer.length,
            message: 'Extracted from ZIP'
          }
        });

        if (!currentParentId) rootResources.push(newFile);
      }
    }
    
    return { rootResources };
  }, {
    maxWait: 10000, 
    timeout: 30000
  });

  return result;
};
