import React, { useState, useRef, useEffect } from 'react';
import {
  MoreVertical,
  Download,
  Eye,
  Edit2,
  FolderInput,
  Trash2,
} from 'lucide-react';
import { StoredFile } from '../../types/storage.types';

interface FileActionMenuProps {
  file: StoredFile;
  onDownload: (file: StoredFile) => void;
  onPreview: (file: StoredFile) => void;
  onRename: (file: StoredFile) => void;
  onMove: (file: StoredFile) => void;
  onDelete: (file: StoredFile) => void;
}

export const FileActionMenu: React.FC<FileActionMenuProps> = ({
  file,
  onDownload,
  onPreview,
  onRename,
  onMove,
  onDelete,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        title="File Options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-44 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl py-1 z-30 font-sans text-xs animate-fadeIn">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onPreview(file);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>Preview File</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onDownload(file);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Decrypt &amp; Download</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onRename(file);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <Edit2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Rename</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onMove(file);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <FolderInput className="w-3.5 h-3.5 text-indigo-400" />
            <span>Move to Folder</span>
          </button>

          <div className="border-t border-slate-800 my-1" />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onDelete(file);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete File</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default FileActionMenu;
