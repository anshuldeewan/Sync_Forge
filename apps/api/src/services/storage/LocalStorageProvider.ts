import * as fs from 'fs/promises';
import * as path from 'path';
import { StorageProvider } from './StorageProvider';

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(process.env.FILE_STORAGE_ROOT || './storage');
  }

  /**
   * Resolves and validates the absolute path to prevent path traversal.
   * @param key The relative storage key (e.g., workspaces/123/projects/456/file.pdf)
   * @returns The safe absolute path
   */
  private getSafePath(key: string): string {
    const safeKey = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
    const absolutePath = path.resolve(this.baseDir, safeKey);

    if (!absolutePath.startsWith(this.baseDir)) {
      throw new Error('Invalid file path: path traversal detected.');
    }

    return absolutePath;
  }

  async save(key: string, buffer: Buffer): Promise<string> {
    const fullPath = this.getSafePath(key);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, buffer);
    return key;
  }

  async read(key: string): Promise<Buffer> {
    const fullPath = this.getSafePath(key);
    return await fs.readFile(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.getSafePath(key);
    try {
      await fs.unlink(fullPath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = this.getSafePath(key);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
