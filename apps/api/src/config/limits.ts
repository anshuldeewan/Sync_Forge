export const LIMITS = {
  // Zip extraction limits to prevent resource exhaustion (Zip Bomb mitigation)
  ZIP_MAX_ENTRIES: parseInt(process.env.ZIP_MAX_ENTRIES || '1000', 10),
  ZIP_MAX_UNCOMPRESSED_SIZE: parseInt(process.env.ZIP_MAX_UNCOMPRESSED_SIZE || '209715200', 10), // 200MB default
  ZIP_MAX_PATH_LENGTH: parseInt(process.env.ZIP_MAX_PATH_LENGTH || '255', 10),
  MAX_FILE_SIZE_BYTES: parseInt(process.env.MAX_FILE_SIZE_BYTES || '52428800', 10), // 50MB default for single files
};
