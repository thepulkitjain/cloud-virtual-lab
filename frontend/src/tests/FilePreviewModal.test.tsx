import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import FilePreviewModal from '../components/storage/FilePreviewModal';
import StorageService from '../services/storage.service';
import { ToastProvider } from '../contexts/ToastContext';
import { StoredFile } from '../types/storage.types';

const mockPythonFile: StoredFile = {
  id: 'file-1',
  userId: 'student-1',
  originalName: 'solution.py',
  storedName: 'file-1.enc',
  mimeType: 'text/x-python',
  sizeBytes: '128',
  fileCategory: 'CODE',
  checksumSha256: 'abc123',
  isPublic: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('FilePreviewModal Syntax Highlighting', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders syntax-highlighted Python preview for decrypted .py files', async () => {
    const fakeBlob = {
      text: vi.fn().mockResolvedValue('def greet():\n    print("Hello Vault")'),
    } as unknown as Blob;

    vi.spyOn(StorageService, 'downloadFile').mockResolvedValue({
      data: fakeBlob,
      mimeType: 'text/x-python',
      fileName: 'solution.py',
    });

    render(
      <ToastProvider>
        <FilePreviewModal
          file={mockPythonFile}
          isOpen
          onClose={vi.fn()}
          onDownload={vi.fn()}
        />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Python 3 Syntax Preview/i)).toBeInTheDocument();
      const kw = screen.getByText('def');
      expect(kw).toHaveClass('text-purple-400');
      const str = screen.getByText('"Hello Vault"');
      expect(str).toHaveClass('text-emerald-400');
    });
  });
});
