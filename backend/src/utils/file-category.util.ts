import path from 'path';
import { FileCategory } from '@prisma/client';

const DANGEROUS_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.msi',
  '.vbs',
  '.scr',
  '.pif',
  '.com',
  '.jar',
  '.app',
  '.dmg',
  '.reg',
  '.ps1',
  '.dll',
  '.iso',
  '.hta',
  '.cpl',
  '.wsf',
]);

const EXTENSION_CATEGORY_MAP: Record<string, FileCategory> = {
  // Documents
  '.pdf': FileCategory.PDF,
  '.doc': FileCategory.DOCUMENT,
  '.docx': FileCategory.DOCUMENT,
  '.txt': FileCategory.DOCUMENT,
  '.rtf': FileCategory.DOCUMENT,
  '.odt': FileCategory.DOCUMENT,
  '.xls': FileCategory.DOCUMENT,
  '.xlsx': FileCategory.DOCUMENT,
  '.csv': FileCategory.DOCUMENT,
  '.ppt': FileCategory.DOCUMENT,
  '.pptx': FileCategory.DOCUMENT,

  // Images
  '.png': FileCategory.IMAGE,
  '.jpg': FileCategory.IMAGE,
  '.jpeg': FileCategory.IMAGE,
  '.gif': FileCategory.IMAGE,
  '.svg': FileCategory.IMAGE,
  '.webp': FileCategory.IMAGE,
  '.bmp': FileCategory.IMAGE,

  // Code
  '.js': FileCategory.CODE,
  '.ts': FileCategory.CODE,
  '.jsx': FileCategory.CODE,
  '.tsx': FileCategory.CODE,
  '.py': FileCategory.CODE,
  '.java': FileCategory.CODE,
  '.c': FileCategory.CODE,
  '.cpp': FileCategory.CODE,
  '.h': FileCategory.CODE,
  '.cs': FileCategory.CODE,
  '.html': FileCategory.CODE,
  '.css': FileCategory.CODE,
  '.sql': FileCategory.CODE,
  '.json': FileCategory.CODE,
  '.yaml': FileCategory.CODE,
  '.yml': FileCategory.CODE,
  '.md': FileCategory.CODE,

  // Archives
  '.zip': FileCategory.ARCHIVE,
  '.tar': FileCategory.ARCHIVE,
  '.gz': FileCategory.ARCHIVE,
  '.7z': FileCategory.ARCHIVE,
  '.rar': FileCategory.ARCHIVE,
};

export const isDangerousExtension = (fileName: string): boolean => {
  const ext = path.extname(fileName).toLowerCase();
  return DANGEROUS_EXTENSIONS.has(ext);
};

export const resolveFileCategory = (fileName: string, mimeType: string): FileCategory => {
  const ext = path.extname(fileName).toLowerCase();

  if (ext === '.pdf' || mimeType === 'application/pdf') {
    return FileCategory.PDF;
  }

  if (EXTENSION_CATEGORY_MAP[ext]) {
    return EXTENSION_CATEGORY_MAP[ext];
  }

  if (mimeType.startsWith('image/')) {
    return FileCategory.IMAGE;
  }

  if (mimeType.startsWith('text/') || mimeType === 'application/json') {
    return FileCategory.CODE;
  }

  if (
    mimeType === 'application/zip' ||
    mimeType === 'application/x-tar' ||
    mimeType === 'application/gzip'
  ) {
    return FileCategory.ARCHIVE;
  }

  return FileCategory.OTHER;
};
