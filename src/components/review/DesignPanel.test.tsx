import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { BridgeContext, type BridgeContextValue } from '@/lib/review/bridgeContextValue';
import type { ReadyInfo } from '@/lib/review/bridgeProtocol';
import type { PaletteOption } from '@/lib/review/designApply';
import { DesignPanel } from './DesignPanel';

const ROOT = 'C:/proj';
const DESIGN = `---
colors:
  canvas: "#FFFFFF"
  ink: "#111111"
  primary: "#1E2BFA"
  accent: "#F59E0B"
---
# Brand
`;
const MANIFEST = JSON.stringify({
  version: 1,
  name: 'Demo',
  outputType: 'video',
  format: { width: 1920, height: 1080, fps: 30, durationSec: 10 },
  template: null,
  palette: { id: 'default', source: 'builtin' },
  agents: { default: 'claude-code', enabled: ['claude-code'] },
  runtime: { version: '0.1.0' },
  createdAt: '2026-09-29T00:00:00.000Z',
});

const GOOD: PaletteOption = {
  id: 'paper-dawn',
  name: 'Paper Dawn',
  source: 'builtin',
  colors: { canvas: '#FAF6EC', ink: '#1F2A5A', primary: '#8E4394', accent: '#F2C230' },
};
// Nearly identical canvas/ink: preview contrast must fail without blocking apply.
const LOW: PaletteOption = {
  id: 'low-contrast',
  name: 'Low Contrast',
  source: 'builtin',
  colors: { canvas: '#888888', ink: '#8A8A8A', primary: '#1E2BFA', accent: '#F59E0B' },
};

const mocks = vi.hoisted(() => ({ files: new Map<string, string>() }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, string>) => {
    if (cmd === 'list_dir') {
      const dir = (args.path as string).replace(/\/$/, '');
      const entries = [...mocks.files.keys()]
        .filter((p) => p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes('/'))
        .map((p) => ({ name: p.slice(dir.length + 1), path: p, is_dir: false, size: 0 }));
      if (entries.length === 0) throw new Error('not found');
      return entries;
    }
    if (cmd === 'read_text_file') {
      const text = mocks.files.get(args.path as string);
      if (text === undefined) throw new Error('missing');
      return text;
    }
    if (cmd === 'write_text_file') {
      mocks.files.set(args.path as string, (args as unknown as { contents: string }).contents);
      return null;
    }
    if (cmd === 'checkpoint_commit') return { id: 'abc123', backend: 'git' };
    throw new Error(`unexpected command ${cmd}`);
  },
}));

const ready: ReadyInfo = { scenes: [], duration: 0, format: 'video', design: { hash: 'h', roles: {} } };

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

function renderPanel(bridge: BridgeContextValue, palettes: PaletteOption[] = [GOOD, LOW]) {
  return render(
    <LanguageProvider>
      <BridgeContext.Provider value={bridge}>
        <DesignPanel root={ROOT} palettes={palettes} />
      </BridgeContext.Provider>
    </LanguageProvider>,
  );
}

describe('DesignPanel', () => {
  beforeEach(() => {
    mocks.files.clear();
    mocks.files.set(`${ROOT}/DESIGN.md`, DESIGN);
    mocks.files.set(`${ROOT}/vanilla.json`, MANIFEST);
  });

  it('shows the current palette and contrast table', async () => {
    renderPanel(stubBridge());
    expect(await screen.findByTestId('swatch-canvas')).toBeTruthy();
    expect(screen.getByTestId('contrast-ink/canvas')).toBeTruthy();
    expect(screen.queryByTestId('design-contrast-warning')).toBeNull();
  });

  it('previews on select and reverts without touching files', async () => {
    const bridge = stubBridge();
    renderPanel(bridge);
    fireEvent.click(await screen.findByTestId('palette-option-paper-dawn'));
    const setDesign = vi.mocked(bridge.setDesign);
    expect(setDesign).toHaveBeenLastCalledWith(expect.objectContaining({ canvas: '#FAF6EC' }));
    expect(screen.getByTestId('design-preview-badge')).toBeTruthy();
    expect(mocks.files.get(`${ROOT}/DESIGN.md`)).toBe(DESIGN);

    fireEvent.click(screen.getByTestId('palette-option-paper-dawn'));
    expect(setDesign).toHaveBeenLastCalledWith(null);
    expect(screen.queryByTestId('design-preview-badge')).toBeNull();
  });

  it('warns on low contrast but still applies', async () => {
    const bridge = stubBridge();
    renderPanel(bridge);
    fireEvent.click(await screen.findByTestId('palette-option-low-contrast'));
    expect(await screen.findByTestId('design-contrast-warning')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    await waitFor(() => expect(screen.getByTestId('design-apply-state').textContent).toContain('적용됨'));
    expect(mocks.files.get(`${ROOT}/DESIGN.md`) ?? '').toContain('canvas: "#888888"');
    expect(vi.mocked(bridge.setDesign)).toHaveBeenLastCalledWith(null);
  });

  it('applies the palette: file rewrite, manifest update, preview cleared', async () => {
    const bridge = stubBridge();
    renderPanel(bridge);
    fireEvent.click(await screen.findByTestId('palette-option-paper-dawn'));
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    await waitFor(() => expect(screen.getByTestId('design-apply-state').textContent).toContain('적용됨'));
    expect(mocks.files.get(`${ROOT}/DESIGN.md`) ?? '').toContain('canvas: "#FAF6EC"');
    const manifest = JSON.parse(mocks.files.get(`${ROOT}/vanilla.json`) ?? '{}') as { palette: unknown };
    expect(manifest.palette).toEqual({ id: 'paper-dawn', source: 'builtin' });
    expect(vi.mocked(bridge.setDesign)).toHaveBeenLastCalledWith(null);
  });
});
