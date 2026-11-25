import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CodeEditor from '../components/labs/CodeEditor';
import StorageService from '../services/storage.service';
import { StoredFile } from '../types/storage.types';

describe('CodeEditor Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Python 3 starter template, line numbers, and syntax highlighting', () => {
    const onRunCode = vi.fn();
    render(<CodeEditor onRunCode={onRunCode} />);

    expect(screen.getByText('app.py')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run Python 3/i })).toBeInTheDocument();

    const textarea = screen.getByLabelText('Python 3 code editor') as HTMLTextAreaElement;
    expect(textarea.value).toContain('def add_numbers(a, b):');
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('switches between Python 3 and JavaScript while preserving independent buffers', () => {
    const onRunCode = vi.fn();
    render(<CodeEditor onRunCode={onRunCode} />);

    const pyTextarea = screen.getByLabelText('Python 3 code editor') as HTMLTextAreaElement;
    fireEvent.change(pyTextarea, { target: { value: 'print("custom python")' } });

    fireEvent.click(screen.getByRole('button', { name: 'JavaScript' }));
    expect(screen.getByText('index.js')).toBeInTheDocument();

    const jsTextarea = screen.getByLabelText('JavaScript code editor') as HTMLTextAreaElement;
    expect(jsTextarea.value).toContain('getRuntimeStatus');
    fireEvent.change(jsTextarea, { target: { value: 'console.log("custom js");' } });

    // Switch back to Python and verify its edited buffer is preserved
    fireEvent.click(screen.getByRole('button', { name: 'Python 3' }));
    expect((screen.getByLabelText('Python 3 code editor') as HTMLTextAreaElement).value).toBe(
      'print("custom python")'
    );

    // Switch back to JS and verify its edited buffer is preserved
    fireEvent.click(screen.getByRole('button', { name: 'JavaScript' }));
    expect((screen.getByLabelText('JavaScript code editor') as HTMLTextAreaElement).value).toBe(
      'console.log("custom js");'
    );
  });

  it('inserts language-specific indentation on Tab key without shifting focus', () => {
    const onRunCode = vi.fn();
    render(<CodeEditor onRunCode={onRunCode} />);

    const textarea = screen.getByLabelText('Python 3 code editor') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'x = 1' } });
    textarea.selectionStart = 0;
    textarea.selectionEnd = 0;

    fireEvent.keyDown(textarea, { key: 'Tab' });
    expect(textarea.value).toBe('    x = 1');

    // Switch to JS (2-space indent)
    fireEvent.click(screen.getByRole('button', { name: 'JavaScript' }));
    const jsTextarea = screen.getByLabelText('JavaScript code editor') as HTMLTextAreaElement;
    fireEvent.change(jsTextarea, { target: { value: 'const a = 1;' } });
    jsTextarea.selectionStart = 0;
    jsTextarea.selectionEnd = 0;

    fireEvent.keyDown(jsTextarea, { key: 'Tab' });
    expect(jsTextarea.value).toBe('  const a = 1;');
  });

  it('passes edited code buffer and language to onRunCode on Run click and Ctrl+Enter', () => {
    const onRunCode = vi.fn();
    render(<CodeEditor onRunCode={onRunCode} />);

    const textarea = screen.getByLabelText('Python 3 code editor') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'print(2 + 2)' } });

    fireEvent.click(screen.getByRole('button', { name: /Run Python 3/i }));
    expect(onRunCode).toHaveBeenCalledWith('python3 app.py', {
      code: 'print(2 + 2)',
      language: 'python',
    });

    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    expect(onRunCode).toHaveBeenCalledTimes(2);
  });

  it('resets code buffer to starter template and copies code to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const onRunCode = vi.fn();
    render(<CodeEditor onRunCode={onRunCode} />);

    const textarea = screen.getByLabelText('Python 3 code editor') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'print("modified")' } });
    expect(textarea.value).toBe('print("modified")');

    fireEvent.click(screen.getByRole('button', { name: /Copy/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('print("modified")');
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Reset/i }));
    expect(textarea.value).toContain('def add_numbers(a, b):');
  });

  it('disables Run button when disabled prop is true', () => {
    const onRunCode = vi.fn();
    render(<CodeEditor onRunCode={onRunCode} disabled />);

    const runBtn = screen.getByRole('button', { name: /Run Python 3/i });
    expect(runBtn).toBeDisabled();
  });

  it('saves current code buffer to Encrypted Vault via StorageService.uploadFile', async () => {
    const uploadSpy = vi.spyOn(StorageService, 'uploadFile').mockResolvedValue({
      id: 'saved-1',
      userId: 'u-1',
      originalName: 'app.py',
      storedName: 'saved-1.enc',
      mimeType: 'text/plain',
      sizeBytes: '20',
      fileCategory: 'CODE',
      checksumSha256: 'abc123',
      isPublic: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    render(<CodeEditor onRunCode={vi.fn()} />);

    const textarea = screen.getByLabelText('Python 3 code editor') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'print("vault-saved")' } });

    fireEvent.click(screen.getByRole('button', { name: /Save to Vault/i }));

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalledTimes(1);
      const uploadedFile = uploadSpy.mock.calls[0][0];
      expect(uploadedFile.name).toBe('app.py');
      expect(screen.getByText('Saved')).toBeInTheDocument();
    });
  });

  it('opens and decrypts a .js file from Encrypted Vault and switches language', async () => {
    const vaultFile: StoredFile = {
      id: 'vault-js-1',
      userId: 'u-1',
      originalName: 'helper.js',
      storedName: 'vault-js-1.enc',
      mimeType: 'application/javascript',
      sizeBytes: '45',
      fileCategory: 'CODE',
      checksumSha256: 'def456',
      isPublic: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    vi.spyOn(StorageService, 'listFiles').mockResolvedValue([vaultFile]);
    vi.spyOn(StorageService, 'downloadFile').mockResolvedValue({
      data: {
        text: vi.fn().mockResolvedValue('console.log("loaded from vault");'),
      } as unknown as Blob,
      mimeType: 'application/javascript',
      fileName: 'helper.js',
    });

    render(<CodeEditor onRunCode={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Open Vault/i }));

    await waitFor(() => {
      expect(screen.getByText('helper.js')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('helper.js'));

    await waitFor(() => {
      const jsTextarea = screen.getByLabelText('JavaScript code editor') as HTMLTextAreaElement;
      expect(jsTextarea.value).toBe('console.log("loaded from vault");');
    });
  });
});
