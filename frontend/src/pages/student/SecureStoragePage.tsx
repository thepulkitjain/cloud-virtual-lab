import React, { useState, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  FolderPlus,
  Search,
  Grid,
  List,
  ArrowUpDown,
  Filter,
  RefreshCw,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import {
  StoredFile,
  StorageFolder,
  StorageQuotaResponse,
  FileCategory,
} from '../../types/storage.types';
import StorageService from '../../services/storage.service';
import QuotaMeter from '../../components/storage/QuotaMeter';
import FolderBreadcrumb, { BreadcrumbSegment } from '../../components/storage/FolderBreadcrumb';
import FileList from '../../components/storage/FileList';
import FileGrid from '../../components/storage/FileGrid';
import UploadModal from '../../components/storage/UploadModal';
import FilePreviewModal from '../../components/storage/FilePreviewModal';
import CreateFolderModal from '../../components/storage/CreateFolderModal';
import RenameFileModal from '../../components/storage/RenameFileModal';
import MoveFileModal from '../../components/storage/MoveFileModal';
import { useToast } from '../../contexts/ToastContext';

export const SecureStoragePage: React.FC = () => {
  // Data State
  const [quota, setQuota] = useState<StorageQuotaResponse | null>(null);
  const [folders, setFolders] = useState<StorageFolder[]>([]);
  const [allFolders, setAllFolders] = useState<StorageFolder[]>([]);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbSegment[]>([]);

  // Filtering & View State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FileCategory | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Loading & Error State
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null);
  const [renameItem, setRenameItem] = useState<{
    item: StoredFile | StorageFolder;
    isFolder: boolean;
  } | null>(null);
  const [moveFileItem, setMoveFileItem] = useState<StoredFile | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    id: string;
    name: string;
    isFolder: boolean;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { success, error } = useToast();

  // Load Quota
  const fetchQuota = useCallback(async () => {
    try {
      const q = await StorageService.getQuota();
      setQuota(q);
    } catch (err: any) {
      console.error('Failed to load quota:', err);
    }
  }, []);

  // Load Folder & File Items
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Quota
      await fetchQuota();

      // 2. Folders under current folder
      const folderList = await StorageService.listFolders(currentFolderId);
      setFolders(folderList);

      // 3. All folders (used by Move and Upload modals)
      const fullFolderList = await StorageService.listFolders();
      setAllFolders(fullFolderList);

      // 4. Files in current folder matching filters
      const fileList = await StorageService.listFiles({
        folderId: currentFolderId,
        search: searchQuery.trim() || undefined,
        category: selectedCategory === 'ALL' ? undefined : selectedCategory,
        sortBy,
        sortOrder,
      });
      setFiles(fileList);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to retrieve storage items.');
      error(err.message || 'Error loading storage.');
    } finally {
      setIsLoading(false);
    }
  }, [currentFolderId, searchQuery, selectedCategory, sortBy, sortOrder, fetchQuota, error]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Navigate into a folder
  const handleOpenFolder = (folderId: string) => {
    const targetFolder = folders.find((f) => f.id === folderId);
    const folderName = targetFolder ? targetFolder.name : 'Folder';

    setCurrentFolderId(folderId);
    setBreadcrumbs((prev) => [...prev, { id: folderId, name: folderName }]);
  };

  // Navigate via Breadcrumb
  const handleNavigateBreadcrumb = (targetId: string | null) => {
    if (targetId === null) {
      setCurrentFolderId(null);
      setBreadcrumbs([]);
    } else {
      const targetIndex = breadcrumbs.findIndex((b) => b.id === targetId);
      if (targetIndex !== -1) {
        setCurrentFolderId(targetId);
        setBreadcrumbs(breadcrumbs.slice(0, targetIndex + 1));
      }
    }
  };

  // Download Decrypted File
  const handleDownloadFile = async (file: StoredFile) => {
    try {
      const { data, fileName } = await StorageService.downloadFile(file.id);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      success(`"${file.originalName}" decrypted and downloaded.`, 'Download Complete');
    } catch (err: any) {
      error(err.message || 'Failed to download file.');
    }
  };

  // Delete Action Trigger
  const handleDeleteItem = (id: string, name: string, isFolder: boolean) => {
    setDeleteConfirmation({ id, name, isFolder });
  };

  // Confirm Delete Execution
  const executeDelete = async () => {
    if (!deleteConfirmation) return;
    setIsDeleting(true);

    try {
      if (deleteConfirmation.isFolder) {
        await StorageService.deleteFolder(deleteConfirmation.id);
        success(`Folder "${deleteConfirmation.name}" deleted.`, 'Folder Removed');
      } else {
        await StorageService.deleteFile(deleteConfirmation.id);
        success(`File "${deleteConfirmation.name}" deleted.`, 'File Removed');
      }
      setDeleteConfirmation(null);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to delete item.');
    } finally {
      setIsDeleting(false);
    }
  };

  const categories: Array<{ id: FileCategory | 'ALL'; label: string }> = [
    { id: 'ALL', label: 'All Files' },
    { id: 'DOCUMENT', label: 'Documents' },
    { id: 'PDF', label: 'PDFs' },
    { id: 'IMAGE', label: 'Images' },
    { id: 'CODE', label: 'Source Code' },
    { id: 'ARCHIVE', label: 'Archives' },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Quota Metric Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Title & Description */}
        <div className="lg:col-span-2 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            Authenticated AES-256-GCM Storage
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Secure Cloud Storage
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xl">
            Store laboratory source code, project reports, and course assets. All files are encrypted
            at-rest with authenticated AES-256-GCM ciphers, random 96-bit IVs, and SHA-256 integrity checksums.
          </p>
        </div>

        {/* Quota Meter Widget */}
        <QuotaMeter quota={quota} className="lg:col-span-1" />
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800">
        {/* Primary Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-md shadow-cyan-500/20 transition cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            Upload File
          </button>

          <button
            type="button"
            onClick={() => setIsCreateFolderOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 transition cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-cyan-400" />
            New Folder
          </button>

          <button
            type="button"
            onClick={fetchData}
            title="Refresh Directory"
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-56">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 text-xs focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2 pointer-events-none" />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-1" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none pr-2 cursor-pointer"
            >
              <option value="date" className="bg-slate-900">Date</option>
              <option value="name" className="bg-slate-900">Name</option>
              <option value="size" className="bg-slate-900">Size</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
              className="px-1.5 py-0.5 text-[10px] font-mono text-cyan-400 uppercase rounded hover:bg-slate-800 transition"
            >
              {sortOrder}
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'list'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Category Pills Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        <span className="text-slate-500 text-[11px] font-mono mr-1 flex items-center gap-1">
          <Filter className="w-3 h-3" />
          Filter:
        </span>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1 rounded-xl text-xs font-medium transition whitespace-nowrap cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Folder Breadcrumb */}
      <FolderBreadcrumb
        breadcrumbs={breadcrumbs}
        onNavigate={handleNavigateBreadcrumb}
        foldersCount={folders.length}
        filesCount={files.length}
      />

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Items Area */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
          <p className="text-xs font-mono">Loading encrypted storage directory...</p>
        </div>
      ) : viewMode === 'grid' ? (
        <FileGrid
          folders={folders}
          files={files}
          onOpenFolder={handleOpenFolder}
          onRenameFolder={(f) => setRenameItem({ item: f, isFolder: true })}
          onDeleteFolder={(f) => handleDeleteItem(f.id, f.name, true)}
          onDownloadFile={handleDownloadFile}
          onPreviewFile={(f) => setPreviewFile(f)}
          onRenameFile={(f) => setRenameItem({ item: f, isFolder: false })}
          onMoveFile={(f) => setMoveFileItem(f)}
          onDeleteFile={(f) => handleDeleteItem(f.id, f.originalName, false)}
        />
      ) : (
        <FileList
          folders={folders}
          files={files}
          onOpenFolder={handleOpenFolder}
          onRenameFolder={(f) => setRenameItem({ item: f, isFolder: true })}
          onDeleteFolder={(f) => handleDeleteItem(f.id, f.name, true)}
          onDownloadFile={handleDownloadFile}
          onPreviewFile={(f) => setPreviewFile(f)}
          onRenameFile={(f) => setRenameItem({ item: f, isFolder: false })}
          onMoveFile={(f) => setMoveFileItem(f)}
          onDeleteFile={(f) => handleDeleteItem(f.id, f.originalName, false)}
        />
      )}

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={fetchData}
        currentFolderId={currentFolderId}
        folders={allFolders}
      />

      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onSuccess={fetchData}
        parentId={currentFolderId}
      />

      {/* Rename File / Folder Modal */}
      <RenameFileModal
        isOpen={renameItem !== null}
        item={renameItem?.item || null}
        isFolder={renameItem?.isFolder || false}
        onClose={() => setRenameItem(null)}
        onSuccess={fetchData}
      />

      {/* Move File Modal */}
      <MoveFileModal
        isOpen={moveFileItem !== null}
        file={moveFileItem}
        folders={allFolders}
        onClose={() => setMoveFileItem(null)}
        onSuccess={fetchData}
      />

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={previewFile !== null}
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownloadFile}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">Confirm Permanent Deletion</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-slate-200">
                  "{deleteConfirmation.name}"
                </span>
                ? Encrypted blocks will be wiped and cannot be recovered.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-md transition disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Permanently'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecureStoragePage;
