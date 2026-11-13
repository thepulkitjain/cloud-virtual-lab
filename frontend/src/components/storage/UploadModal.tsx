import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  X,
  AlertCircle,
  Loader2,
  Lock,
} from 'lucide-react';
import { StorageFolder } from '../../types/storage.types';
import StorageService from '../../services/storage.service';
import { useToast } from '../../contexts/ToastContext';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
  currentFolderId: string | null;
  folders: StorageFolder[];
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const PROHIBITED_EXTENSIONS = ['.exe', '.bat', '.sh', '.msi', '.cmd', '.ps1', '.vbs', '.dll', '.com', '.scr', '.pif'];

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  currentFolderId,
  folders,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<string>(currentFolderId || '');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { success, error } = useToast();

  if (!isOpen) return null;

  const validateFile = (file: File): boolean => {
    setValidationError(null);

    // Extension check
    const lowerName = file.name.toLowerCase();
    const isProhibited = PROHIBITED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (isProhibited) {
      setValidationError(
        'Executable programs and dangerous scripts (.exe, .bat, .sh, .msi, etc.) are prohibited for security.'
      );
      return false;
    }

    // Size check
    if (file.size > MAX_FILE_SIZE) {
      setValidationError('File exceeds the maximum upload limit of 25 MB.');
      return false;
    }

    if (file.size === 0) {
      setValidationError('Cannot upload empty (0 byte) files.');
      return false;
    }

    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      } else {
        setSelectedFile(null);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      } else {
        setSelectedFile(null);
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setValidationError('Please choose a file to upload.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      await StorageService.uploadFile(
        selectedFile,
        targetFolderId || null,
        (percent) => setUploadProgress(percent)
      );

      success(`"${selectedFile.name}" encrypted with AES-256-GCM and stored!`, 'Upload Complete');
      onUploadSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.message || 'File upload failed.';
      setValidationError(msg);
      error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Upload Encrypted File</h3>
              <p className="text-[10px] text-slate-400 font-mono">
                AES-256-GCM Cryptographic Storage
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleUpload} className="p-5 space-y-4 text-xs">
          {validationError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{validationError}</div>
            </div>
          )}

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-cyan-400 bg-cyan-950/20'
                : 'border-slate-800 hover:border-slate-700 bg-slate-950/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />

            <UploadCloud
              className={`w-10 h-10 mx-auto mb-2 transition-transform ${
                isDragging ? 'scale-110 text-cyan-400' : 'text-slate-500'
              }`}
            />

            {selectedFile ? (
              <div className="space-y-1">
                <p className="text-white font-semibold truncate max-w-xs mx-auto">
                  {selectedFile.name}
                </p>
                <p className="text-[11px] text-cyan-400 font-mono">
                  {(selectedFile.size / 1024).toFixed(1)} KB • Ready for encryption
                </p>
              </div>
            ) : (
              <div>
                <p className="text-white font-medium">
                  Drag and drop your file here, or{' '}
                  <span className="text-cyan-400 hover:underline">browse</span>
                </p>
                <p className="text-[10px] text-slate-500 font-mono mt-1">
                  Supported: PDF, Documents, Code, Images (Max 25 MB)
                </p>
              </div>
            )}
          </div>

          {/* Destination Folder Selector */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">
              Destination Folder
            </label>
            <select
              value={targetFolderId}
              onChange={(e) => setTargetFolderId(e.target.value)}
              disabled={isUploading}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition"
            >
              <option value="" className="bg-slate-900">
                / (Root Directory)
              </option>
              {folders.map((f) => (
                <option key={f.id} value={f.id} className="bg-slate-900">
                  📁 /{f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-cyan-400 flex items-center gap-1.5">
                  <Lock className="w-3 h-3 animate-pulse" />
                  Encrypting &amp; Uploading...
                </span>
                <span className="text-white font-semibold">{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-md shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Encrypting...
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  Upload &amp; Encrypt
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadModal;
