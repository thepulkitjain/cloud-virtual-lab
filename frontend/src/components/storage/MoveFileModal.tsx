import React, { useState } from 'react';
import { FolderInput, X, Loader2, AlertCircle, Folder } from 'lucide-react';
import { StoredFile, StorageFolder } from '../../types/storage.types';
import StorageService from '../../services/storage.service';
import { useToast } from '../../contexts/ToastContext';

interface MoveFileModalProps {
  file: StoredFile | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  folders: StorageFolder[];
}

export const MoveFileModal: React.FC<MoveFileModalProps> = ({
  file,
  isOpen,
  onClose,
  onSuccess,
  folders,
}) => {
  const [targetFolderId, setTargetFolderId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { success, error } = useToast();

  if (!isOpen || !file) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const destination = targetFolderId === '' ? null : targetFolderId;

    try {
      await StorageService.moveFile(file.id, destination);
      success(`File moved successfully!`, 'File Relocated');
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Failed to move file.';
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
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <FolderInput className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Move File</h3>
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
            <p className="text-slate-400 mb-1">Moving file:</p>
            <p className="font-semibold text-white truncate max-w-xs">{file.originalName}</p>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">
              Select Destination
            </label>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              <label
                className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                  targetFolderId === ''
                    ? 'bg-cyan-950/30 border-cyan-500/50 text-cyan-200'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="destinationFolder"
                  value=""
                  checked={targetFolderId === ''}
                  onChange={() => setTargetFolderId('')}
                  className="hidden"
                />
                <Folder className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>/ (Root Directory)</span>
              </label>

              {folders.map((f) => (
                <label
                  key={f.id}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                    targetFolderId === f.id
                      ? 'bg-cyan-950/30 border-cyan-500/50 text-cyan-200'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="destinationFolder"
                    value={f.id}
                    checked={targetFolderId === f.id}
                    onChange={() => setTargetFolderId(f.id)}
                    className="hidden"
                  />
                  <Folder className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </label>
              ))}
            </div>
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
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-md transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Moving...
                </>
              ) : (
                'Move File Here'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MoveFileModal;
