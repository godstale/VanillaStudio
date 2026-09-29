import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { BridgeContext, type BridgeContextValue } from '@/lib/review/bridgeContextValue';
import type { ReadyInfo, SceneMeta } from '@/lib/review/bridgeProtocol';
import { PARAMS_SAVE_DELAY_MS } from '@/lib/review/params';
import { ParamsPanel } from './ParamsPanel';

const ROOT = 'C:/proj';

const mocks = vi.hoisted(() => ({ files: new Map<string, string>() }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, string>) => {
    if (cmd === 'list_dir') {
      const dir = args.path.replace(/\/$/, '');
      const entries = [...mocks.files.keys()]
        .filter((p) => p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes('/'))
        .map((p) => ({ name: p.slice(dir.length + 1), path: p, is_dir: false, size: 0 }));
      if (entries.length === 0) throw new Error('not found');
      return entries;
    }
    if (cmd === 'read_text_file') {
      const text = mocks.files.get(args.path);
      if (text === undefined) throw new Error('missing');
      return text;
    }
    if (cmd === 'write_text_file') {
      mocks.files.set(args.path, (args as unknown as { contents: string }).contents);
      return null;
    }
    throw new Error(`unexpected command ${cmd}`);
  },
}));

const scene: SceneMeta = {
  id: 's1',
  duration: 5,
  params: {
    speed: { kind: 'number', default: 1, min: 0, max: 10, label: 'Speed' },
    title: { kind: 'text', default: 'Hi', label: 'Title' },
    fg: { kind: 'color', default: '#000000', label: 'Color' },
    on: { kind: 'boolean', default: false, label: 'On' },
    mode: { kind: 'select', options: ['a', 'b'], default: 'a', label: 'Mode' },
  },
};

const ready: ReadyInfo = { scenes: [scene], duration: 5, format: 'video', design: { hash: 'h', roles: {} } };

function stubBridge(): BridgeContextValue {
  return {
    status: 'ready',
    ready,
    readyCount: 1,
    error: null,
    registerFrame: () => undefined,
    send: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    setParams: vi.fn(),
    goto: vi.fn(),
    setDesign: vi.fn(),
    reload: vi.fn(),
    capture: vi.fn(),
    setParamsValues: vi.fn(),
    playing: false,
    subscribe: () => () => undefined,
    timeStore: { get: () => ({ t: 0, sceneId: null }), subscribe: () => () => undefined },
  };
}

function renderPanel(bridge: BridgeContextValue) {
  return render(
    <LanguageProvider>
      <BridgeContext.Provider value={bridge}>
        <ParamsPanel root={ROOT} />
      </BridgeContext.Provider>
    </LanguageProvider>,
  );
}

describe('ParamsPanel', () => {
  beforeEach(() => {
    mocks.files.clear();
  });

  it('shows schema defaults when there is no values file', async () => {
    const bridge = stubBridge();
    renderPanel(bridge);
    expect(await screen.findByDisplayValue('Hi')).toBeTruthy();
    expect(bridge.setParams).toHaveBeenCalledWith('s1', expect.objectContaining({ speed: 1, title: 'Hi' }));
  });

  it('loads the user file over the defaults', async () => {
    mocks.files.set(`${ROOT}/params/s1.values.json`, JSON.stringify({ speed: 7, title: 'Yo', extra: 1 }));
    const bridge = stubBridge();
    renderPanel(bridge);
    expect(await screen.findByDisplayValue('Yo')).toBeTruthy();
    expect(bridge.setParams).toHaveBeenCalledWith('s1', expect.objectContaining({ speed: 7 }));
  });

  it('applies edits instantly and saves them after a debounce', async () => {
    const bridge = stubBridge();
    renderPanel(bridge);
    const title = (await screen.findByDisplayValue('Hi')) as HTMLInputElement;
    vi.useFakeTimers();
    try {
      fireEvent.change(title, { target: { value: 'Hello' } });
      // Instant reflection, before the file settles.
      expect(bridge.setParams).toHaveBeenLastCalledWith('s1', expect.objectContaining({ title: 'Hello' }));
      expect(mocks.files.has(`${ROOT}/params/s1.values.json`)).toBe(false);
      await act(async () => {
        vi.advanceTimersByTime(PARAMS_SAVE_DELAY_MS + 1);
      });
      const saved = mocks.files.get(`${ROOT}/params/s1.values.json`);
      expect(JSON.parse(saved ?? '{}')).toMatchObject({ title: 'Hello', speed: 1 });
      expect(screen.getByTestId('params-save-state').textContent).toContain('저장됨');
    } finally {
      vi.useRealTimers();
    }
  });

  it('drives every field kind through setParams', async () => {
    const bridge = stubBridge();
    renderPanel(bridge);
    await screen.findByDisplayValue('Hi');
    const setParams = vi.mocked(bridge.setParams);
    setParams.mockClear();

    fireEvent.change(screen.getByLabelText('Speed value'), { target: { value: '4' } });
    expect(setParams).toHaveBeenLastCalledWith('s1', expect.objectContaining({ speed: 4 }));
    fireEvent.click(screen.getByLabelText('On'));
    expect(setParams).toHaveBeenLastCalledWith('s1', expect.objectContaining({ on: true }));
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'b' } });
    expect(setParams).toHaveBeenLastCalledWith('s1', expect.objectContaining({ mode: 'b' }));
    fireEvent.change(screen.getByLabelText('Color hex'), { target: { value: '#ff0000' } });
    expect(setParams).toHaveBeenLastCalledWith('s1', expect.objectContaining({ fg: '#ff0000' }));
  });
});
