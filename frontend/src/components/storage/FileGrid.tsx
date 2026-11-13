import React from 'react';
import {
  Folder,
  FileText,
  Image as ImageIcon,
  Code2,
  Archive,
  File,
  Lock,
  Edit2,
  Trash2,
} from 'lucide-react';
import { StoredFile, StorageFolder, FileCategory } from '../../types/storage.types';
import FileActionMenu from './FileActionMenu';

interface FileGridProps {
  folders: StorageFolder[];
  files: StoredFile[];
  onOpenFolder: (folderId: string) => void;
  onRenameFolder: (folder: StorageFolder) => void;
  onDeleteFolder: (folder: StorageFolder) => void;
  onDownloadFile: (file: StoredFile) => void;
  onPreviewFile: (file: StoredFile) => void;
  onRenameFile: (file: StoredFile) => void;
  onMoveFile: (file: StoredFile) => void;
  onDeleteFile: (file: StoredFile) => void;
}

export const FileGrid: React.FC<FileGridProps> = ({
  folders,
  files,
  onOpenFolder,
  onRenameFolder,
  onDeleteFolder,
  onDownloadFile,
  onPreviewFile,
  onRenameFile,
  onMoveFile,
  onDeleteFile,
}) => {
  const formatBytes = (bytesStr?: string | number) => {
    if (!bytesStr) return '0 B';
    const bytes = typeof bytesStr === 'string' ? parseInt(bytesStr, 10) : bytesStr;
    if (isNaN(bytes) || bytes === 0) return '0 B';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const getFileCategoryIcon = (category: FileCategory) => {
    switch (category) {
      case 'PDF':
        return <FileText className="w-8 h-8 text-rose-400" />;
      case 'DOCUMENT':
        return <FileText className="w-8 h-8 text-blue-400" />;
      case 'IMAGE':
        return <ImageIcon className="w-8 h-8 text-emerald-400" />;
      case 'CODE':
        return <Code2 className="w-8 h-8 text-amber-400" />;
      case 'ARCHIVE':
        return <Archive className="w-8 h-8 text-purple-400" />;
      default:
        return <File className="w-8 h-8 text-slate-400" />;
    }
  };

  const totalItems = folders.length + files.length;

  if (totalItems === 0) {
    return (
      <div className="py-16 text-center bg-slate-900/40 rounded-2xl border border-slate-800/60 p-8">
        <Folder className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h4 className="text-sm font-semibold text-white">This directory is empty</h4>
        <p className="text-xs text-slate-400 mt-1">
          Upload files or create subfolders to start organizing your files.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {/* Folder Cards */}
      {folders.map((folder) => (
        <div
          key={folder.id}
          onClick={() => onOpenFolder(folder.id)}
          className="group relative p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-900 transition-all shadow-md cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition">
              <Folder className="w-5 h-5" />
            </div>

            <div
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => onRenameFolder(folder)}
                className="p-1 text-slate-500 hover:text-white rounded hover:bg-slate-800 transition"
                title="Rename Folder"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDeleteFolder(folder)}
                className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-950/20 transition"
                title="Delete Folder"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-3">
            <h4 className="text-xs font-semibold text-white truncate group-hover:text-cyan-300 transition">
              {folder.name}
            </h4>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              Folder • Click to open
            </p>
          </div>
        </div>
      ))}

      {/* File Cards */}
      {files.map((file) => (
        <div
          key={file.id}
          className="group relative p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 transition-all shadow-md flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div
              className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center cursor-pointer group-hover:scale-105 transition"
              onClick={() => onPreviewFile(file)}
            >
              {getFileCategoryIcon(file.fileCategory)}
            </div>

            <FileActionMenu
              file={file}
              onDownload={onDownloadFile}
              onPreview={onPreviewFile}
              onRename={onRenameFile}
              onMove={onMoveFile}
              onDelete={onDeleteFile}
            />
          </div>

          <div
            className="mt-3 cursor-pointer"
            onClick={() => onPreviewFile(file)}
          >
            <h4 className="text-xs font-semibold text-white truncate group-hover:text-cyan-300 transition" title={file.originalName}>
              {file.originalName}
            </h4>
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>{formatBytes(file.sizeBytes)}</span>
              <span className="flex items-center gap-1 text-cyan-400">
                <Lock className="w-2.5 h-2.5" />
                AES-256
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FileGrid;
