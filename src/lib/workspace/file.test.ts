import { beforeEach, describe, expect, it, vi } from 'vitest';

const files = new Map<string, string>();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: { path: string; contents?: string }) => {
    if (cmd === 'read_text_file') {
      const v = files.get(args.path);
      if (v === undefined) throw new Error('missing');
      return v;
    }
    if (cmd === 'write_text_file') {
      files.set(args.path, args.contents ?? '');
      return;
    }
    throw new Error(`unexpected ${cmd}`);
  },
}));

import { parseWorkspaceFile, readWorkspace, roundView, saveWorkspaceView, serializeWorkspace, updateWorkspace } from './file';
import { canvasFromPreset } from './schema';

const PATH = '/w/workspace.json';
const base = { version: 1 as const, workspaceId: 'ws_1', name: 'Demo', canvas: canvasFromPreset('16:9') };

beforeEach(() => {
  files.clear();
  files.set(PATH, serializeWorkspace(base));
});

describe('workspace file', () => {
  it('round-trips through canonical serialization', () => {
    const text = serializeWorkspace(base);
    expect(serializeWorkspace(parseWorkspaceFile(text))).toBe(text);
  });

  it('rounds the viewport to two decimals', () => {
    expect(roundView({ x: 1.23456, y: -9.999, zoom: 0.50049 })).toEqual({ x: 1.23, y: -10, zoom: 0.5 });
  });

  it('saves the view and keeps every other field', async () => {
    await saveWorkspaceView('/w', { x: 10.123, y: 20, zoom: 1.5 });
    const ws = await readWorkspace('/w');
    expect(ws).toMatchObject({ workspaceId: 'ws_1', name: 'Demo', view: { x: 10.12, y: 20, zoom: 1.5 } });
  });

  it('does not rewrite the file when the view is unchanged', async () => {
    await saveWorkspaceView('/w', { x: 1, y: 2, zoom: 1 });
    const first = files.get(PATH);
    files.set(PATH, `${first}`);
    const spy = vi.fn();
    const original = files.set.bind(files);
    files.set = (k, v) => {
      spy();
      return original(k, v);
    };
    await saveWorkspaceView('/w', { x: 1.001, y: 2, zoom: 1 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects an invalid file', async () => {
    files.set(PATH, '{"version":2}');
    await expect(readWorkspace('/w')).rejects.toThrow();
  });

  it('updateWorkspace changes only the given fields and keeps the view', async () => {
    await saveWorkspaceView('/w', { x: 1, y: 2, zoom: 1 });
    const next = await updateWorkspace('/w', { canvas: canvasFromPreset('9:16', 24), defaultAgent: 'codex' });
    expect(next).toMatchObject({ name: 'Demo', view: { x: 1, y: 2, zoom: 1 }, canvas: { aspect: '9:16', fps: 24 }, defaultAgent: 'codex' });
    expect((await readWorkspace('/w')).defaultAgent).toBe('codex');
  });

  it('updateWorkspace can clear the default agent and rejects invalid canvases before writing', async () => {
    await updateWorkspace('/w', { defaultAgent: 'codex' });
    await updateWorkspace('/w', { defaultAgent: undefined });
    expect((await readWorkspace('/w')).defaultAgent).toBeUndefined();
    const before = files.get(PATH);
    await expect(updateWorkspace('/w', { canvas: { ...base.canvas, fps: 0 } })).rejects.toThrow();
    expect(files.get(PATH)).toBe(before);
  });
});
