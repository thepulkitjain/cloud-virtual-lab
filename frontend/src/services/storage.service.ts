import apiClient from './api';
import { ApiResponse } from '../types/api.types';
import {
  StoredFile,
  StorageFolder,
  StorageQuotaResponse,
  StorageFilterParams,
  AdminStorageUsersResponse,
  AdminStorageFilesResponse,
} from '../types/storage.types';
import { AdminStorageOverview } from '../types/admin.types';

export class StorageService {
  /**
   * 1. Retrieve current student storage quota and metrics
   */
  static async getQuota(): Promise<StorageQuotaResponse> {
    const res = await apiClient.get<ApiResponse<{ quota: StorageQuotaResponse }>>('/storage/quota');
    return res.data.data!.quota;
  }

  /**
   * 2. List files with optional folder filtering, search, category, and sorting
   */
  static async listFiles(params?: StorageFilterParams): Promise<StoredFile[]> {
    const query = new URLSearchParams();
    if (params) {
      if (params.folderId !== undefined) {
        query.append('folderId', params.folderId === null ? '' : params.folderId);
      }
      if (params.search) query.append('search', params.search);
      if (params.category) query.append('category', params.category);
      if (params.sortBy) query.append('sortBy', params.sortBy);
      if (params.sortOrder) query.append('sortOrder', params.sortOrder);
    }
    const qStr = query.toString() ? `?${query.toString()}` : '';
    const res = await apiClient.get<ApiResponse<{ files: StoredFile[] }>>(`/storage/files${qStr}`);
    return res.data.data?.files || [];
  }

  /**
   * 3. Get single file metadata
   */
  static async getFile(id: string): Promise<StoredFile> {
    const res = await apiClient.get<ApiResponse<{ file: StoredFile }>>(`/storage/files/${id}`);
    return res.data.data!.file;
  }

  /**
   * 4. Upload file with AES-256-GCM encryption on server
   */
  static async uploadFile(
    file: File,
    folderId?: string | null,
    onProgress?: (percent: number) => void
  ): Promise<StoredFile> {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) {
      formData.append('folderId', folderId);
    }

    const res = await apiClient.post<ApiResponse<{ file: StoredFile }>>(
      '/storage/files/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(percentCompleted);
          }
        },
      }
    );
    return res.data.data!.file;
  }

  /**
   * 5. Download decrypted file as Blob
   */
  static async downloadFile(
    id: string
  ): Promise<{ data: Blob; fileName: string; mimeType: string }> {
    const response = await apiClient.get(`/storage/files/${id}/download`, {
      responseType: 'blob',
    });

    let fileName = 'downloaded_file';
    const disposition = response.headers['content-disposition'];
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        fileName = decodeURIComponent(match[1]);
      }
    }

    const mimeType = String(response.headers['content-type'] || 'application/octet-stream');
    return {
      data: response.data,
      fileName,
      mimeType,
    };
  }

  /**
   * 6. Rename file
   */
  static async renameFile(id: string, name: string): Promise<StoredFile> {
    const res = await apiClient.patch<ApiResponse<{ file: StoredFile }>>(
      `/storage/files/${id}`,
      { name }
    );
    return res.data.data!.file;
  }

  /**
   * 7. Move file to target folder (or root if null)
   */
  static async moveFile(id: string, targetFolderId: string | null): Promise<StoredFile> {
    const res = await apiClient.patch<ApiResponse<{ file: StoredFile }>>(
      `/storage/files/${id}/move`,
      { targetFolderId }
    );
    return res.data.data!.file;
  }

  /**
   * 8. Delete file
   */
  static async deleteFile(id: string): Promise<string> {
    const res = await apiClient.delete<ApiResponse>(`/storage/files/${id}`);
    return res.data.message;
  }

  /**
   * 9. List folders
   */
  static async listFolders(parentId?: string | null): Promise<StorageFolder[]> {
    const query = new URLSearchParams();
    if (parentId !== undefined) {
      query.append('parentId', parentId === null ? '' : parentId);
    }
    const qStr = query.toString() ? `?${query.toString()}` : '';
    const res = await apiClient.get<ApiResponse<{ folders: StorageFolder[] }>>(
      `/storage/folders${qStr}`
    );
    return res.data.data?.folders || [];
  }

  /**
   * 10. Create folder
   */
  static async createFolder(name: string, parentId?: string | null): Promise<StorageFolder> {
    const res = await apiClient.post<ApiResponse<{ folder: StorageFolder }>>(
      '/storage/folders',
      { name, parentId: parentId || null }
    );
    return res.data.data!.folder;
  }

  /**
   * 11. Rename folder
   */
  static async renameFolder(id: string, name: string): Promise<StorageFolder> {
    const res = await apiClient.patch<ApiResponse<{ folder: StorageFolder }>>(
      `/storage/folders/${id}`,
      { name }
    );
    return res.data.data!.folder;
  }

  /**
   * 12. Delete folder
   */
  static async deleteFolder(id: string): Promise<string> {
    const res = await apiClient.delete<ApiResponse>(`/storage/folders/${id}`);
    return res.data.message;
  }

  /* =========================================================================
   * ADMINISTRATIVE STORAGE ENDPOINTS (Role: ADMIN)
   * ========================================================================= */

  /**
   * 13. System-wide administrative storage overview
   */
  static async getAdminOverview(): Promise<AdminStorageOverview> {
    const res = await apiClient.get<ApiResponse<{ overview: AdminStorageOverview }>>(
      '/admin/storage/overview'
    );
    return res.data.data!.overview;
  }

  /**
   * 14. List user storage usage and quotas
   */
  static async getAdminUsers(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<AdminStorageUsersResponse> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const qStr = query.toString() ? `?${query.toString()}` : '';
    const res = await apiClient.get<ApiResponse<AdminStorageUsersResponse>>(
      `/admin/storage/users${qStr}`
    );
    return res.data.data!;
  }

  /**
   * 15. Update user storage quota
   */
  static async updateUserQuota(
    userId: string,
    quotaMb?: number,
    quotaBytes?: string
  ): Promise<any> {
    const res = await apiClient.patch<ApiResponse>(
      `/admin/storage/users/${userId}/quota`,
      {
        ...(quotaMb !== undefined && { quotaMb }),
        ...(quotaBytes !== undefined && { quotaBytes }),
      }
    );
    return res.data.data;
  }

  /**
   * 16. List all files across the system
   */
  static async getAdminFiles(params?: {
    search?: string;
    category?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }): Promise<AdminStorageFilesResponse> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.category) query.append('category', params.category);
    if (params?.userId) query.append('userId', params.userId);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const qStr = query.toString() ? `?${query.toString()}` : '';
    const res = await apiClient.get<ApiResponse<AdminStorageFilesResponse>>(
      `/admin/storage/files${qStr}`
    );
    return res.data.data!;
  }

  /**
   * 17. Admin delete file
   */
  static async adminDeleteFile(id: string): Promise<string> {
    const res = await apiClient.delete<ApiResponse>(`/admin/storage/files/${id}`);
    return res.data.message;
  }
}

export default StorageService;
