export type FileCategory = 'DOCUMENT' | 'IMAGE' | 'CODE' | 'ARCHIVE' | 'PDF' | 'OTHER';

export interface StorageFolder {
  id: string;
  name: string;
  userId: string;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    files: number;
    children: number;
  };
}

export interface StoredFile {
  id: string;
  userId: string;
  folderId?: string | null;
  originalName: string;
  storedName: string;
  mimeType: string;
  fileCategory: FileCategory;
  sizeBytes: string;
  checksumSha256: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  folder?: {
    id: string;
    name: string;
  } | null;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface StorageQuotaResponse {
  quotaBytes: string;
  usedBytes: string;
  availableBytes: string;
  percentageUsed: number;
  totalFiles: number;
  totalFolders: number;
}

export interface CreateFolderPayload {
  name: string;
  parentId?: string | null;
}

export interface RenameFolderPayload {
  name: string;
}

export interface RenameFilePayload {
  name: string;
}

export interface MoveFilePayload {
  targetFolderId: string | null;
}

export interface StorageFilterParams {
  folderId?: string | null;
  search?: string;
  category?: FileCategory;
  sortBy?: 'name' | 'size' | 'date';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminStorageUsersResponse {
  users: Array<{
    userId: string;
    email: string;
    name: string;
    role: string;
    quotaBytes: string;
    usedBytes: string;
    percentageUsed: number;
    fileCount: number;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminStorageFilesResponse {
  files: StoredFile[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
