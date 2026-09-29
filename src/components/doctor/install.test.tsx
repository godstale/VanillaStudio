import { describe, expect, it, vi } from 'vitest';
import {
  act,
  renderHook,
  waitFor,
  screen,
  fireEvent,
} from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { getDictionary } from '@/lib/i18n';
import {
  appendLog,
  decideConsent,
  hashText,
  type ConsentStore,
  type InstallEvent,
} from './installModel';
import {
  useInstallDependencies,
  type InstallDeps,
} from './useInstallDependencies';
import { InstallDependenciesDialog } from './InstallDependenciesDialog';

describe('installModel', () => {
  it('asks the first time, skips when unchanged, re-asks when package.json changed', () => {
    expect(decideConsent(null, 'a')).toBe('ask-first');
    expect(decideConsent('a', 'a')).toBe('skip');
    expect(decideConsent('a', 'b')).toBe('ask-changed');
  });

  it('hashes text deterministically', async () => {
    expect(await hashText('{}')).toBe(await hashText('{}'));
    expect(await hashText('{}')).not.toBe(await hashText('{ }'));
    expect(await hashText('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('keeps only the newest log lines and ignores non-log events', () => {
    let lines = appendLog([], { kind: 'started', program: 'pnpm', argv: [] });
    expect(lines).toEqual([]);
    for (let i = 0; i < 5; i++)
      lines = appendLog(
        lines,
        { kind: 'log', stream: 'stdout', line: `l${i}` },
        3,
      );
    expect(lines.map((l) => l.line)).toEqual(['l2', 'l3', 'l4']);
  });
});

function memoryStore(): ConsentStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: (d) => data.get(d) ?? null,
    set: (d, h) => void data.set(d, h),
  };
}

function makeDeps(pkg: () => string, store: ConsentStore) {
  const run = vi.fn(
    async (_dir: string, onEvent: (e: InstallEvent) => void) => {
      onEvent({ kind: 'log', stream: 'stdout', line: 'Progress: resolved 1' });
      return 0;
    },
  );
  const deps: InstallDeps = {
    readPackageJson: async () => pkg(),
    run,
    cancel: async () => {},
    store,
  };
  return { deps, run };
}

describe('useInstallDependencies', () => {
  it('does not run before the user confirms, then remembers the consent', async () => {
    const store = memoryStore();
    let pkg = '{"name":"a"}';
    const { deps, run } = makeDeps(() => pkg, store);
    const { result } = renderHook(() => useInstallDependencies('C:\\p', deps));

    await act(() => result.current.request());
    expect(result.current.phase).toEqual({
      kind: 'consent',
      reason: 'ask-first',
    });
    expect(run).not.toHaveBeenCalled();

    await act(() => result.current.confirm());
    expect(run).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toEqual({ kind: 'done', exitCode: 0 });
    expect(result.current.logs).toEqual([
      { stream: 'stdout', line: 'Progress: resolved 1' },
    ]);

    // Same package.json: runs without asking.
    await act(() => result.current.request());
    expect(run).toHaveBeenCalledTimes(2);

    // Changed package.json: asks again and does not run.
    pkg = '{"name":"a","dependencies":{"x":"1"}}';
    await act(() => result.current.request());
    expect(result.current.phase).toEqual({
      kind: 'consent',
      reason: 'ask-changed',
    });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('declining returns to idle without running', async () => {
    const { deps, run } = makeDeps(() => '{}', memoryStore());
    const { result } = renderHook(() => useInstallDependencies('C:\\p', deps));
    await act(() => result.current.request());
    act(() => result.current.decline());
    expect(result.current.phase).toEqual({ kind: 'idle' });
    expect(run).not.toHaveBeenCalled();
  });

  it('reports backend error codes', async () => {
    const { deps } = makeDeps(() => '{}', memoryStore());
    deps.run = async () => {
      throw 'not-found:pnpm';
    };
    const { result } = renderHook(() => useInstallDependencies('C:\\p', deps));
    await act(() => result.current.request());
    await act(() => result.current.confirm());
    await waitFor(() =>
      expect(result.current.phase).toEqual({
        kind: 'error',
        code: 'not-found:pnpm',
      }),
    );
  });
});

describe('InstallDependenciesDialog', () => {
  const noop = () => {};

  it('shows the fixed command and requires a confirm click', () => {
    const onConfirm = vi.fn();
    renderWithProviders(
      <InstallDependenciesDialog
        phase={{ kind: 'consent', reason: 'ask-first' }}
        logs={[]}
        onConfirm={onConfirm}
        onDecline={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByText('pnpm install')).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '동의하고 설치' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders streamed log lines while running', () => {
    renderWithProviders(
      <InstallDependenciesDialog
        phase={{ kind: 'running' }}
        logs={[{ stream: 'stdout', line: 'Progress: resolved 5' }]}
        onConfirm={noop}
        onDecline={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByTestId('install-log').textContent).toContain(
      'Progress: resolved 5',
    );
  });

  it('has ko and en text for the install keys', () => {
    for (const locale of ['ko', 'en'] as const) {
      const dict = getDictionary(locale) as Record<string, string>;
      for (const k of ['title', 'desc', 'descChanged', 'confirm', 'failed'])
        expect(dict[`doctor.install.${k}`]).toBeTruthy();
    }
  });
});
