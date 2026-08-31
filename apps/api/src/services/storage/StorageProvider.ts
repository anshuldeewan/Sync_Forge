export interface StorageProvider {
  /**
   * Save a file to the storage backend.
   * @param path The generated storage path/key.
   * @param buffer The file content.
   * @returns The stored path.
   */
  save(path: string, buffer: Buffer): Promise<string>;

  /**
   * Read a file from the storage backend.
   * @param path The storage path/key.
   * @returns A buffer of the file content.
   */
  read(path: string): Promise<Buffer>;

  /**
   * Delete a file from the storage backend.
   * @param path The storage path/key.
   */
  delete(path: string): Promise<void>;

  /**
   * Check if a file exists.
   * @param path The storage path/key.
   */
  exists(path: string): Promise<boolean>;
}
