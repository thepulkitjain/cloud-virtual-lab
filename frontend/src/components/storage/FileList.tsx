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

interface FileListProps {
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

export const FileList: React.FC<FileListProps> = ({
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

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getFileCategoryIcon = (category: FileCategory) => {
    switch (category) {
      case 'PDF':
        return <FileText className="w-4 h-4 text-rose-400" />;
      case 'DOCUMENT':
        return <FileText className="w-4 h-4 text-blue-400" />;
      case 'IMAGE':
        return <ImageIcon className="w-4 h-4 text-emerald-400" />;
      case 'CODE':
        return <Code2 className="w-4 h-4 text-amber-400" />;
      case 'ARCHIVE':
        return <Archive className="w-4 h-4 text-purple-400" />;
      default:
        return <File className="w-4 h-4 text-slate-400" />;
    }
  };

  const totalItems = folders.length + files.length;

  if (totalItems === 0) {
    return (
      <div className="py-16 text-center bg-slate-900/40 rounded-2xl border border-slate-800/60 p-8">
        <Folder className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h4 className="text-sm font-semibold text-white">This folder is empty</h4>
        <p className="text-xs text-slate-400 mt-1">
          Upload files or create subfolders to start organizing your encrypted workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="px-5 py-3.5">Name</th>
              <th className="px-5 py-3.5">Category</th>
              <th className="px-5 py-3.5">Size</th>
              <th className="px-5 py-3.5">Uploaded</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-slate-300">
            {/* Folders first */}
            {folders.map((folder) => (
              <tr
                key={folder.id}
                onClick={() => onOpenFolder(folder.id)}
                className="hover:bg-slate-800/40 transition cursor-pointer group"
              >
                <td className="px-5 py-3.5 font-medium text-white flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500/20 transition">
                    <Folder className="w-4 h-4" />
                  </div>
                  <span className="truncate max-w-xs">{folder.name}</span>
                </td>
                <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500">
                  Folder
                </td>
                <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500">
                  —
                </td>
                <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400">
                  {formatDate(folder.createdAt)}
                </td>
                <td
                  className="px-5 py-3.5 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onRenameFolder(folder)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                      title="Rename Folder"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteFolder(folder)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-950/20 transition"
                      title="Delete Folder"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {/* Files */}
            {files.map((file) => (
              <tr
                key={file.id}
                className="hover:bg-slate-800/40 transition"
              >
                <td
                  className="px-5 py-3.5 font-medium text-white flex items-center gap-3 cursor-pointer"
                  onClick={() => onPreviewFile(file)}
                >
                  <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
                    {getFileCategoryIcon(file.fileCategory)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate max-w-xs hover:text-cyan-300 transition">
                      {file.originalName}
                    </p>
                    <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5 text-cyan-400" />
                      AES-256-GCM
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                    {file.fileCategory}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-mono text-[11px] text-slate-300">
                  {formatBytes(file.sizeBytes)}
                </td>
                <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400">
                  {formatDate(file.createdAt)}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <FileActionMenu
                    file={file}
                    onDownload={onDownloadFile}
                    onPreview={onPreviewFile}
                    onRename={onRenameFile}
                    onMove={onMoveFile}
                    onDelete={onDeleteFile}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FileList;
