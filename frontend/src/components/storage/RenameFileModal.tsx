import React, { useState, useEffect } from 'react';
import { Edit2, X, Loader2, AlertCircle } from 'lucide-react';
import { StoredFile, StorageFolder } from '../../types/storage.types';
import StorageService from '../../services/storage.service';
import { useToast } from '../../contexts/ToastContext';

interface RenameFileModalProps {
  item: StoredFile | StorageFolder | null;
  isFolder?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RenameFileModal: React.FC<RenameFileModalProps> = ({
  item,
  isFolder = false,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { success, error } = useToast();

  useEffect(() => {
    if (item) {
      setName(isFolder ? (item as StorageFolder).name : (item as StoredFile).originalName);
      setErrorMsg(null);
    }
  }, [item, isFolder]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMsg('Name cannot be empty.');
      return;
    }

    if (/[/\\:*?"<>|]/.test(trimmed)) {
      setErrorMsg('Name contains illegal characters (/\\:*?"<>|)');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (isFolder) {
        await StorageService.renameFolder(item.id, trimmed);
        success(`Folder renamed to "${trimmed}"`, 'Renamed');
      } else {
        await StorageService.renameFile(item.id, trimmed);
        success(`File renamed to "${trimmed}"`, 'Renamed');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Failed to rename item.';
      setErrorMsg(msg);
      error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Edit2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">
              Rename {isFolder ? 'Folder' : 'File'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">
              New Name
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-md transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RenameFileModal;
