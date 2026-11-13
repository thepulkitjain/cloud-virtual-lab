import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  FileText,
  Loader2,
  Lock,
  AlertCircle,
  Hash,
} from 'lucide-react';
import { StoredFile } from '../../types/storage.types';
import StorageService from '../../services/storage.service';
import { useToast } from '../../contexts/ToastContext';

interface FilePreviewModalProps {
  file: StoredFile | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (file: StoredFile) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  isOpen,
  onClose,
  onDownload,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { error } = useToast();

  useEffect(() => {
    let currentUrl: string | null = null;

    const loadContent = async () => {
      if (!file || !isOpen) return;

      setIsLoading(true);
      setErrorMsg(null);
      setTextContent(null);
      setBlobUrl(null);

      try {
        const { data, mimeType } = await StorageService.downloadFile(file.id);

        if (
          file.fileCategory === 'IMAGE' ||
          mimeType.startsWith('image/') ||
          file.fileCategory === 'PDF' ||
          mimeType === 'application/pdf'
        ) {
          currentUrl = URL.createObjectURL(data);
          setBlobUrl(currentUrl);
        } else if (
          file.fileCategory === 'CODE' ||
          file.fileCategory === 'DOCUMENT' ||
          mimeType.startsWith('text/') ||
          mimeType.includes('json') ||
          mimeType.includes('javascript')
        ) {
          const text = await data.text();
          // Truncate to first 50KB to keep UI snappy
          setTextContent(text.slice(0, 50000));
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to decrypt and preview file.');
        error(err.message || 'Could not load preview.');
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();

    // Cleanup: Revoke generated Blob URL to avoid memory leaks
    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [file, isOpen, error]);

  if (!isOpen || !file) return null;

  const isImage = file.fileCategory === 'IMAGE' || file.mimeType.startsWith('image/');
  const isPdf = file.fileCategory === 'PDF' || file.mimeType === 'application/pdf';
  const isText = textContent !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="max-w-4xl w-full max-h-[90vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate" title={file.originalName}>
                {file.originalName}
              </h3>
              <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                <span className="text-cyan-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  AES-256-GCM Decrypted
                </span>
                <span>•</span>
                <span>{file.mimeType}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onDownload(file)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-950 flex flex-col items-center justify-center min-h-[350px]">
          {isLoading ? (
            <div className="text-center space-y-3">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-300 font-mono">
                Decrypting AES-256-GCM cipher blocks...
              </p>
            </div>
          ) : errorMsg ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : isImage && blobUrl ? (
            <div className="max-h-[60vh] max-w-full flex items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-2">
              <img
                src={blobUrl}
                alt={file.originalName}
                className="max-h-[58vh] max-w-full object-contain rounded-lg"
              />
            </div>
          ) : isPdf && blobUrl ? (
            <iframe
              src={blobUrl}
              title={file.originalName}
              className="w-full h-[60vh] rounded-xl border border-slate-800 bg-white"
            />
          ) : isText ? (
            <div className="w-full h-[60vh] overflow-auto rounded-xl border border-slate-800 bg-slate-900 p-4 font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed select-text">
              {textContent}
            </div>
          ) : (
            <div className="text-center py-10 space-y-3">
              <FileText className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-white">Preview not supported for this file type</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                This file format cannot be rendered in-browser, but is safely decrypted and ready for download.
              </p>
              <button
                type="button"
                onClick={() => onDownload(file)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-xs font-semibold shadow transition"
              >
                <Download className="w-3.5 h-3.5" />
                Download Decrypted File
              </button>
            </div>
          )}
        </div>

        {/* Footer Meta */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-[11px] font-mono text-slate-400 shrink-0">
          <span className="flex items-center gap-1.5 truncate max-w-md" title={file.checksumSha256}>
            <Hash className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            SHA-256: {file.checksumSha256}
          </span>
          <span className="text-slate-500">
            Encrypted with unique 96-bit IV
          </span>
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
