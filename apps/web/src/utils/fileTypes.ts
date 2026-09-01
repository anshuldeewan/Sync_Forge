export enum FileCategory {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  PDF = 'PDF',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
  SPREADSHEET = 'SPREADSHEET',
  PRESENTATION = 'PRESENTATION',
  CSV = 'CSV',
  ARCHIVE = 'ARCHIVE',
  UNKNOWN = 'UNKNOWN'
}

// Map extensions to their category
const EXTENSION_CATEGORY_MAP: Record<string, FileCategory> = {
  // TEXT / CODE
  txt: FileCategory.TEXT,
  md: FileCategory.TEXT,
  mdx: FileCategory.TEXT,
  markdown: FileCategory.TEXT,
  json: FileCategory.TEXT,
  jsonc: FileCategory.TEXT,
  js: FileCategory.TEXT,
  jsx: FileCategory.TEXT,
  ts: FileCategory.TEXT,
  tsx: FileCategory.TEXT,
  mjs: FileCategory.TEXT,
  cjs: FileCategory.TEXT,
  css: FileCategory.TEXT,
  scss: FileCategory.TEXT,
  less: FileCategory.TEXT,
  html: FileCategory.TEXT,
  htm: FileCategory.TEXT,
  xml: FileCategory.TEXT,
  yaml: FileCategory.TEXT,
  yml: FileCategory.TEXT,
  toml: FileCategory.TEXT,
  ini: FileCategory.TEXT,
  conf: FileCategory.TEXT,
  env: FileCategory.TEXT,
  py: FileCategory.TEXT,
  java: FileCategory.TEXT,
  c: FileCategory.TEXT,
  cpp: FileCategory.TEXT,
  h: FileCategory.TEXT,
  hpp: FileCategory.TEXT,
  cs: FileCategory.TEXT,
  go: FileCategory.TEXT,
  rs: FileCategory.TEXT,
  php: FileCategory.TEXT,
  rb: FileCategory.TEXT,
  sh: FileCategory.TEXT,
  bash: FileCategory.TEXT,
  zsh: FileCategory.TEXT,
  sql: FileCategory.TEXT,
  ps1: FileCategory.TEXT,
  bat: FileCategory.TEXT,
  vue: FileCategory.TEXT,
  svelte: FileCategory.TEXT,
  dockerfile: FileCategory.TEXT,
  gitignore: FileCategory.TEXT,
  gitattributes: FileCategory.TEXT,
  gitmodules: FileCategory.TEXT,
  editorconfig: FileCategory.TEXT,
  log: FileCategory.TEXT,

  // IMAGE
  png: FileCategory.IMAGE,
  jpg: FileCategory.IMAGE,
  jpeg: FileCategory.IMAGE,
  gif: FileCategory.IMAGE,
  webp: FileCategory.IMAGE,
  bmp: FileCategory.IMAGE,
  ico: FileCategory.IMAGE,
  avif: FileCategory.IMAGE,
  svg: FileCategory.IMAGE,

  // PDF
  pdf: FileCategory.PDF,

  // AUDIO
  mp3: FileCategory.AUDIO,
  wav: FileCategory.AUDIO,
  ogg: FileCategory.AUDIO,
  m4a: FileCategory.AUDIO,
  flac: FileCategory.AUDIO,

  // VIDEO
  mp4: FileCategory.VIDEO,
  webm: FileCategory.VIDEO,
  mov: FileCategory.VIDEO,

  // DOCUMENT
  doc: FileCategory.DOCUMENT,
  docx: FileCategory.DOCUMENT,
  odt: FileCategory.DOCUMENT,

  // SPREADSHEET
  xls: FileCategory.SPREADSHEET,
  xlsx: FileCategory.SPREADSHEET,
  ods: FileCategory.SPREADSHEET,

  // CSV
  csv: FileCategory.CSV,

  // PRESENTATION
  ppt: FileCategory.PRESENTATION,
  pptx: FileCategory.PRESENTATION,
  odp: FileCategory.PRESENTATION,

  // ARCHIVE
  zip: FileCategory.ARCHIVE,
  rar: FileCategory.ARCHIVE,
  '7z': FileCategory.ARCHIVE,
  tar: FileCategory.ARCHIVE,
  gz: FileCategory.ARCHIVE,
  bz2: FileCategory.ARCHIVE,
  xz: FileCategory.ARCHIVE
};

// Map extensionless exact filenames to TEXT category
const EXACT_TEXT_FILES = ['README', 'LICENSE', 'MAKEFILE', 'DOCKERFILE', 'PROCFILE', 'CHANGELOG'];

// Map extensions to Monaco languages
const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  jsonc: 'json',
  md: 'markdown',
  mdx: 'markdown',
  markdown: 'markdown',
  py: 'python',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  go: 'go',
  rs: 'rust',
  php: 'php',
  rb: 'ruby',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  sql: 'sql',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  dockerfile: 'dockerfile',
  vue: 'html',
  svelte: 'html',
  env: 'plaintext',
  txt: 'plaintext',
  bat: 'bat',
  ps1: 'powershell',
  ini: 'ini',
  conf: 'ini',
  toml: 'ini',
  log: 'plaintext'
};

/**
 * Given a filename and optionally a mimeType, determines the FileCategory.
 */
export function getFileCategory(filename: string, mimeType?: string): FileCategory {
  const extMatch = filename.match(/\.([a-z0-9]+)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';

  if (!ext && EXACT_TEXT_FILES.includes(filename.toUpperCase())) {
    return FileCategory.TEXT;
  }

  if (ext && EXTENSION_CATEGORY_MAP[ext]) {
    return EXTENSION_CATEGORY_MAP[ext];
  }

  if (mimeType) {
    if (mimeType.startsWith('text/csv')) return FileCategory.CSV;
    if (mimeType.startsWith('text/')) return FileCategory.TEXT;
    if (mimeType.startsWith('image/')) return FileCategory.IMAGE;
    if (mimeType.startsWith('audio/')) return FileCategory.AUDIO;
    if (mimeType.startsWith('video/')) return FileCategory.VIDEO;
    if (mimeType === 'application/pdf') return FileCategory.PDF;
    if (mimeType === 'application/json' || mimeType === 'application/xml') return FileCategory.TEXT;
    if (mimeType.includes('ms-excel') || mimeType.includes('spreadsheet')) return FileCategory.SPREADSHEET;
    if (mimeType.includes('ms-powerpoint') || mimeType.includes('presentation')) return FileCategory.PRESENTATION;
    if (mimeType.includes('officedocument') || mimeType.includes('msword')) return FileCategory.DOCUMENT;
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar') || mimeType.includes('7z') || mimeType.includes('gzip')) {
      return FileCategory.ARCHIVE;
    }
  }

  return FileCategory.UNKNOWN;
}

export function getFileCategoryDisplayName(filename: string, category: FileCategory): string {
  const extMatch = filename.match(/\.([a-z0-9]+)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';

  switch (category) {
    case FileCategory.TEXT:
      if (ext && EXTENSION_LANGUAGE_MAP[ext]) {
        const lang = EXTENSION_LANGUAGE_MAP[ext];
        return lang.charAt(0).toUpperCase() + lang.slice(1);
      }
      return 'Text / Code';
    case FileCategory.IMAGE:
      return ext ? `${ext.toUpperCase()} Image` : 'Image';
    case FileCategory.AUDIO:
      return ext ? `${ext.toUpperCase()} Audio` : 'Audio';
    case FileCategory.VIDEO:
      return ext ? `${ext.toUpperCase()} Video` : 'Video';
    case FileCategory.PDF:
      return 'PDF Document';
    case FileCategory.DOCUMENT:
      if (['doc', 'docx'].includes(ext)) return 'Word Document';
      return 'Document';
    case FileCategory.SPREADSHEET:
      if (['xls', 'xlsx'].includes(ext)) return 'Excel Spreadsheet';
      return 'Spreadsheet';
    case FileCategory.PRESENTATION:
      if (['ppt', 'pptx'].includes(ext)) return 'PowerPoint Presentation';
      return 'Presentation';
    case FileCategory.CSV:
      return 'CSV Data';
    case FileCategory.ARCHIVE:
      return ext ? `${ext.toUpperCase()} Archive` : 'Archive';
    default:
      return ext ? `${ext.toUpperCase()} File` : 'File';
  }
}

export function getMonacoLanguage(filename: string): string {
  const extMatch = filename.match(/\.([a-z0-9]+)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';

  if (!ext) {
    const upper = filename.toUpperCase();
    if (upper === 'README' || upper === 'LICENSE' || upper === 'CHANGELOG') return 'markdown';
    if (upper === 'MAKEFILE') return 'shell';
    if (upper === 'DOCKERFILE') return 'dockerfile';
    return 'plaintext';
  }

  return EXTENSION_LANGUAGE_MAP[ext] || 'plaintext';
}
