import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { MemorySqlFallback, setDatabase } from '@/lib/db/client';
import * as settingsRepo from '@/lib/db/repositories/settingsRepo';
import { BUILTIN_AGENTS } from '@/lib/agents/registry';
import { stopAllBusy } from '@/lib/workspace/switchGuard';
import type { PtyEventLike, SessionDeps, TermLike } from '@/lib/terminal/sessions';
import { TerminalDock } from './TerminalDock';
import { TerminalProvider } from './TerminalProvider';
import { useTerminals, type TerminalContextValue } from './terminalContextValue';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

class FakeTerm implements TermLike {
  cols = 90;
  rows = 20;
  element: HTMLElement | null = null;
  opened = 0;
  write() {}
  paste() {}
  onData() {
    return { dispose() {} };
  }
  open(host: HTMLElement) {
    this.opened += 1;
    this.element = document.createElement('div');
    this.element.setAttribute('data-xterm', 'yes');
    host.appendChild(this.element);
  }
  fit() {}
  focus() {}
  dispose() {}
}

let handler: (e: PtyEventLike) => void = () => undefined;
let startImpl: () => Promise<number>;
const terms: FakeTerm[] = [];
const api = {
  start: vi.fn(),
  write: vi.fn(async () => undefined),
  resize: vi.fn(async () => undefined),
  kill: vi.fn(async () => undefined),
  decode: () => new Uint8Array(),
};

const deps: SessionDeps = {
  api: api as unknown as SessionDeps['api'],
  createTerm: () => {
    const t = new FakeTerm();
    terms.push(t);
    return t;
  },
  classify: (m) => (m.includes('untrusted') ? 'untrusted' : m.includes('not found') ? 'not-installed' : 'other'),
};

let ctx: TerminalContextValue;
const setCtx = (c: TerminalContextValue) => {
  ctx = c;
};

function Grab() {
  const value = useTerminals();
  useEffect(() => setCtx(value));
  return null;
}

function renderDock(readiness?: { quietMs?: number; timeoutMs?: number; pollMs?: number }) {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <TerminalProvider deps={deps} loadRegistry={async () => [...BUILTIN_AGENTS]} readiness={readiness}>
          <Grab />
          <div style={{ height: 300 }}>
            <TerminalDock />
          </div>
        </TerminalProvider>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

const run = (slug: string, name: string, preferredAgentId?: string, prompt?: string) =>
  act(async () => {
    await ctx.runAgent({ workspaceId: 'ws_1', sceneId: `scn_${slug}`, sceneSlug: slug, sceneName: name, preferredAgentId, prompt });
  });

const running = () => screen.getByRole('tab', { name: /실행 중|running/ });

beforeEach(async () => {
  setDatabase(new MemorySqlFallback());
  await stopAllBusy();
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => undefined) } });
  terms.length = 0;
  api.start.mockReset().mockImplementation((_o: unknown, cb: (e: PtyEventLike) => void) => {
    handler = cb;
    return startImpl();
  });
  api.kill.mockClear();
  startImpl = () => Promise.resolve(5);
});

describe('TerminalDock', () => {
  it('shows a hint when nothing is running', () => {
    renderDock();
    expect(screen.getByText(/실행 중인 터미널이 없습니다|No terminals are running/)).toBeTruthy();
  });

  it('Run agent opens a tab named after the scene and agent, with the xterm attached', async () => {
    renderDock();
    await run('intro', 'Intro', 'codex');
    const tab = await screen.findByRole('tab', { name: /Intro · Codex/ });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    await waitFor(() => expect(running()).toBeTruthy());
    expect(screen.getByTestId('terminal-dock').querySelector('[data-xterm="yes"]')).not.toBeNull();
    expect(api.start.mock.calls[0][0]).toMatchObject({ agentId: 'codex', sceneSlug: 'intro' });
  });

  it('uses the default agent when none is preferred', async () => {
    renderDock();
    await run('a', 'A');
    expect(screen.getByRole('tab', { name: /A · Claude Code/ })).toBeTruthy();
  });

  it('keeps one tab per scene+agent and switching tabs re-attaches the same terminal (reconnect)', async () => {
    renderDock();
    await run('a', 'Alpha', 'codex');
    await run('b', 'Beta', 'codex');
    await run('a', 'Alpha', 'codex'); // already running: no second session
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(api.start).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('tab', { name: /Alpha · Codex/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Beta · Codex/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Alpha · Codex/ }));
    expect(terms[0].opened).toBe(1); // opened once, moved afterwards
    expect(screen.getByTestId('terminal-dock').querySelector('[data-xterm="yes"]')).not.toBeNull();
  });

  it('closing a running tab asks first; cancelling keeps it running', async () => {
    renderDock();
    await run('a', 'Alpha', 'codex');
    await waitFor(() => expect(running()).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Alpha 터미널 닫기|Close terminal of Alpha/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /계속 실행|Keep running/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.kill).not.toHaveBeenCalled();
    expect(screen.getAllByRole('tab')).toHaveLength(1);
  });

  it('confirming stops the agent and removes the tab', async () => {
    renderDock();
    await run('a', 'Alpha', 'codex');
    await waitFor(() => expect(running()).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Alpha 터미널 닫기|Close terminal of Alpha/ }));
    fireEvent.click(await screen.findByRole('button', { name: /종료하고 닫기|Stop and close/ }));
    await waitFor(() => expect(screen.queryAllByRole('tab')).toHaveLength(0));
    expect(api.kill).toHaveBeenCalledWith(5);
  });

  it('an exited tab closes without asking and reports the exit code', async () => {
    renderDock();
    await run('a', 'Alpha', 'codex');
    await waitFor(() => expect(running()).toBeTruthy());
    act(() => handler({ event: 'exit', code: 4 }));
    expect(await screen.findByText(/코드 4|code 4/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Alpha 터미널 닫기|Close terminal of Alpha/ }));
    await waitFor(() => expect(screen.queryAllByRole('tab')).toHaveLength(0));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('explains a missing agent and links to the environment check', async () => {
    startImpl = () => Promise.reject(new Error('agent executable not found: claude'));
    renderDock();
    await run('a', 'Alpha');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/설치되어 있지 않거나|not installed/);
    expect(within(alert).getByRole('link').getAttribute('href')).toBe('/settings/doctor');
  });

  it('explains an untrusted workspace', async () => {
    startImpl = () => Promise.reject(new Error('untrusted-workspace'));
    renderDock();
    await run('a', 'Alpha');
    expect((await screen.findByRole('alert')).textContent).toMatch(/신뢰하지 않은|not trusted/);
  });

  it('runAgent fails with no-enabled-agent when every agent is off', async () => {
    render(
      <LanguageProvider>
        <MemoryRouter>
          <TerminalProvider deps={deps} loadRegistry={async () => BUILTIN_AGENTS.map((a) => ({ ...a, enabled: false }))}>
            <Grab />
          </TerminalProvider>
        </MemoryRouter>
      </LanguageProvider>,
    );
    await expect(ctx.runAgent({ workspaceId: 'w', sceneId: 's', sceneSlug: 'a', sceneName: 'A' })).rejects.toThrow('no-enabled-agent');
    expect(api.start).not.toHaveBeenCalled();
  });

  describe('prompt delivery', () => {
    const clipboard = () => (navigator.clipboard.writeText as ReturnType<typeof vi.fn>);

    it('copies the prompt to the clipboard and tells the user to paste it (auto-paste off)', async () => {
      renderDock();
      await run('a', 'Alpha', 'codex', 'THE PROMPT');
      expect(clipboard()).toHaveBeenCalledWith('THE PROMPT');
      expect((await screen.findByTestId('terminal-notice')).textContent).toMatch(/클립보드에 복사했습니다|copied to the clipboard/);
    });

    it('auto-paste: waits until the agent output goes quiet, then pastes and says so', async () => {
      await settingsRepo.updateSettings({ terminalAutoPaste: true });
      renderDock({ quietMs: 80, timeoutMs: 3000, pollMs: 20 });
      await run('a', 'Alpha', 'claude-code', 'THE PROMPT'); // bracketed
      await waitFor(() => expect(running()).toBeTruthy());
      act(() => handler({ event: 'output', data: btoa('Welcome') }));
      await waitFor(() => expect(screen.getByTestId('terminal-notice').textContent).toMatch(/붙여넣었습니다|pasted into/), { timeout: 2000 });
      expect(clipboard()).toHaveBeenCalledWith('THE PROMPT');
    });

    it('auto-paste: tells the user to paste manually when readiness is never detected', async () => {
      await settingsRepo.updateSettings({ terminalAutoPaste: true });
      renderDock({ quietMs: 50, timeoutMs: 200, pollMs: 20 });
      await run('a', 'Alpha', 'claude-code', 'THE PROMPT');
      await waitFor(() => expect(screen.getByTestId('terminal-notice').textContent).toMatch(/자동으로 붙여넣지 않았습니다|nothing was pasted/), { timeout: 2000 });
    });

    it('clipboard-only agents never auto-paste, even when the setting is on', async () => {
      await settingsRepo.updateSettings({ terminalAutoPaste: true });
      render(
        <LanguageProvider>
          <MemoryRouter>
            <TerminalProvider deps={deps} loadRegistry={async () => BUILTIN_AGENTS.map((a) => ({ ...a, pasteMode: 'clipboard' as const }))} readiness={{ quietMs: 20, timeoutMs: 300, pollMs: 10 }}>
              <Grab />
              <TerminalDock />
            </TerminalProvider>
          </MemoryRouter>
        </LanguageProvider>,
      );
      await run('a', 'Alpha', 'codex', 'THE PROMPT');
      await waitFor(() => expect(running()).toBeTruthy());
      act(() => handler({ event: 'output', data: btoa('ready') }));
      await new Promise((r) => setTimeout(r, 150));
      expect(screen.getByTestId('terminal-notice').textContent).toMatch(/클립보드에 복사했습니다|copied to the clipboard/);
      expect(api.write).not.toHaveBeenCalledWith(5, 'THE PROMPT');
    });

    it('reports a clipboard failure and still starts the terminal', async () => {
      vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) } });
      Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });
      renderDock();
      await run('a', 'Alpha', 'codex', 'THE PROMPT');
      expect((await screen.findByTestId('terminal-notice')).textContent).toMatch(/복사하지 못했습니다|Could not copy/);
      expect(screen.getByRole('tab', { name: /Alpha · Codex/ })).toBeTruthy();
    });

    it('the notice can be dismissed', async () => {
      renderDock();
      await run('a', 'Alpha', 'codex', 'P');
      fireEvent.click(await screen.findByRole('button', { name: /안내 닫기|Dismiss/ }));
      expect(screen.queryByTestId('terminal-notice')).toBeNull();
    });
  });
});
