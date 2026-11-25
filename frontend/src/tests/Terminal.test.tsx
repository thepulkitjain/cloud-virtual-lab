import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Terminal, { TerminalEntry } from '../components/labs/Terminal';

describe('Terminal Component', () => {
  const sampleEntries: TerminalEntry[] = [
    {
      id: '1',
      command: 'pwd',
      output: '/home/student',
      currentPath: '/home/student',
      timestamp: '10:00:00 AM',
    },
  ];

  it('renders terminal entries, prompt path, and executes submitted commands', async () => {
    const onExecute = vi.fn().mockResolvedValue(undefined);
    render(
      <Terminal
        currentPath="/home/student"
        entries={sampleEntries}
        onExecute={onExecute}
      />
    );

    expect(screen.getByText('pwd')).toBeInTheDocument();
    expect(screen.getAllByText('/home/student').length).toBeGreaterThan(0);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ls -la' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(onExecute).toHaveBeenCalledWith('ls -la');
      expect(input.value).toBe('');
    });
  });

  it('handles local clear command via onClear without calling onExecute', () => {
    const onExecute = vi.fn().mockResolvedValue(undefined);
    const onClear = vi.fn();

    render(
      <Terminal
        entries={sampleEntries}
        onExecute={onExecute}
        onClear={onClear}
      />
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'clear' } });
    fireEvent.submit(input.closest('form')!);

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('navigates command history with ArrowUp and ArrowDown keys', async () => {
    const onExecute = vi.fn().mockResolvedValue(undefined);
    render(<Terminal entries={[]} onExecute={onExecute} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'whoami' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(onExecute).toHaveBeenCalledWith('whoami'));

    fireEvent.change(input, { target: { value: 'uname' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(onExecute).toHaveBeenCalledWith('uname'));

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('uname');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('whoami');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('uname');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('');
  });

  it('invokes onTabComplete on Tab key and updates input with completedLine', async () => {
    const onExecute = vi.fn().mockResolvedValue(undefined);
    const onTabComplete = vi.fn().mockResolvedValue({
      completedLine: 'whoami ',
      matches: ['whoami'],
      prefix: 'wh',
      hasMultiple: false,
      isCommand: true,
    });

    render(
      <Terminal
        entries={[]}
        onExecute={onExecute}
        onTabComplete={onTabComplete}
      />
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'wh' } });
    fireEvent.keyDown(input, { key: 'Tab' });

    await waitFor(() => {
      expect(onTabComplete).toHaveBeenCalledWith('wh');
      expect(input.value).toBe('whoami ');
    });
  });

  it('disables command execution when isLoading is true', () => {
    const onExecute = vi.fn().mockResolvedValue(undefined);
    render(<Terminal entries={[]} onExecute={onExecute} isLoading />);

    expect(screen.getByText(/Processing simulated command/i)).toBeInTheDocument();

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input).toBeDisabled();
  });
});
