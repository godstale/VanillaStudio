import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { getDictionary } from '@/lib/i18n';
import { TerminalTab } from './TerminalTab';
import { decodeBase64, TERMINAL_AGENT_IDS, type PtyEvent } from './terminalApi';

const h = vi.hoisted(() => ({
  written: [] as Uint8Array[],
  dataHandler: null as null | ((d: string) => void),
  disposed: 0,
}));

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    loadAddon() {}
    open() {}
    write(d: Uint8Array) {
      h.written.push(d);
    }
    onData(cb: (d: string) => void) {
      h.dataHandler = cb;
      return { dispose() {} };
    }
    dispose() {
      h.disposed += 1;
    }
  },
}));
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { fit() {} } }));
vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

const api = vi.hoisted(() => ({
  handler: null as null | ((e: PtyEvent) => void),
  start: vi.fn(),
  write: vi.fn(),
  resize: vi.fn(),
  kill: vi.fn(),
}));

vi.mock('./terminalApi', async (orig) => ({
  ...(await orig<typeof import('./terminalApi')>()),
  ptyStart: (...args: unknown[]) => api.start(...args),
  ptyWrite: (...args: unknown[]) => api.write(...args),
  ptyResize: (...args: unknown[]) => api.resize(...args),
  ptyKill: (...args: unknown[]) => api.kill(...args),
}));

class RO {
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  h.written.length = 0;
  h.disposed = 0;
  vi.stubGlobal('ResizeObserver', RO);
  api.start.mockReset().mockImplementation(
    (_agent: string, _c: number, _r: number, cb: (e: PtyEvent) => void) => {
      api.handler = cb;
      return Promise.resolve(7);
    },
  );
  api.write.mockReset().mockResolvedValue(undefined);
  api.kill.mockReset().mockResolvedValue(undefined);
});

describe('terminal tab', () => {
  it('has i18n keys in both dictionaries', () => {
    for (const locale of ['ko', 'en'] as const) {
      const dict = getDictionary(locale) as Record<string, string>;
      for (const key of [
        'terminal.title',
        'terminal.desc',
        'terminal.start',
        'terminal.permissionNote',
        'terminal.exited',
        'terminal.exitedCode',
        'terminal.failed',
      ])
        expect(dict[key], `${locale}:${key}`).toBeTruthy();
    }
  });

  it('only offers fixed agent ids and takes no command input', () => {
    renderWithProviders(<TerminalTab />);
    expect(screen.getAllByRole('button')).toHaveLength(TERMINAL_AGENT_IDS.length);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('starts the chosen agent and relays output, input and exit', async () => {
    const { unmount } = renderWithProviders(<TerminalTab />);
    fireEvent.click(screen.getAllByRole('button')[4]);
    await act(async () => {});
    expect(api.start).toHaveBeenCalledWith('agy', 80, 24, expect.any(Function));

    act(() => api.handler?.({ event: 'output', data: btoa('hi') }));
    expect(new TextDecoder().decode(h.written[0])).toBe('hi');

    act(() => h.dataHandler?.('x'));
    expect(api.write).toHaveBeenCalledWith(7, 'x');

    act(() => api.handler?.({ event: 'exit', code: 3 }));
    expect(screen.getByRole('status').textContent).toContain('3');
    expect(api.kill).toHaveBeenCalledWith(7);
    unmount();
  });

  it('kills the session on unmount and reports start errors', async () => {
    const { unmount } = renderWithProviders(<TerminalTab />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    await act(async () => {});
    unmount();
    expect(api.kill).toHaveBeenCalledWith(7);
    expect(h.disposed).toBe(1);

    api.start.mockRejectedValueOnce('agent executable not found: claude');
    renderWithProviders(<TerminalTab />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    await act(async () => {});
    expect(screen.getByRole('alert').textContent).toContain('not found');
  });

  it('decodes base64 bytes', () => {
    expect([...decodeBase64('AP8=')]).toEqual([0, 255]);
  });
});
