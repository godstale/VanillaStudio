import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { canvasFromPreset, type Workspace } from '@/lib/workspace/schema';

const m = vi.hoisted(() => ({
  ws: null as unknown,
  updateWorkspace: vi.fn(),
  rerender: vi.fn(async () => 3),
  updateSettings: vi.fn(async () => undefined),
  root: '/w' as string | null,
}));

vi.mock('@/lib/context/WorkspaceContext', () => ({ useWorkspace: () => ({ workspaceRoot: m.root }) }));
vi.mock('@/lib/workspace/file', () => ({
  readWorkspace: async () => m.ws,
  updateWorkspace: m.updateWorkspace,
}));
vi.mock('@/lib/scene/files', () => ({ rerenderAllScenes: m.rerender }));
vi.mock('@/lib/db/repositories/settingsRepo', () => ({
  getSettings: async () => ({ templatesDir: 'C:\\tpl' }),
  updateSettings: m.updateSettings,
}));

import { SettingsWorkspace } from './SettingsWorkspace';

const base: Workspace = { version: 1, workspaceId: 'ws_1', name: 'Demo', canvas: canvasFromPreset('16:9'), defaultAgent: 'codex' };

function renderPage() {
  return render(
    <LanguageProvider>
      <SettingsWorkspace />
    </LanguageProvider>,
  );
}

const save = () => screen.getByRole('button', { name: /^저장$|^Save$/ }) as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
  m.root = '/w';
  m.ws = base;
  m.updateWorkspace.mockImplementation(async (_r: string, patch: object) => ({ ...base, ...patch }));
});

describe('SettingsWorkspace', () => {
  it('loads the current values', async () => {
    renderPage();
    expect(await screen.findByDisplayValue('C:\\tpl')).toBeTruthy();
    expect((screen.getByLabelText(/기본 에이전트|Default agent/) as HTMLSelectElement).value).toBe('codex');
    expect((screen.getByDisplayValue('16:9') as HTMLSelectElement).value).toBe('16:9');
  });

  it('asks for a workspace when none is open', () => {
    m.root = null;
    renderPage();
    expect(screen.getByText(/열린 워크스페이스가 없습니다|No workspace is open/)).toBeTruthy();
  });

  it('saves a preset change, stores templatesDir and re-renders every scene guide', async () => {
    renderPage();
    const preset = (await screen.findByDisplayValue('16:9')) as HTMLSelectElement;
    fireEvent.change(preset, { target: { value: '9:16' } });
    fireEvent.change(screen.getByLabelText(/사용자 가이드 템플릿 폴더|User guide template folder/), { target: { value: 'D:\\shared' } });
    fireEvent.click(save());
    await waitFor(() => expect(m.rerender).toHaveBeenCalled());
    expect(m.updateWorkspace).toHaveBeenCalledWith('/w', {
      canvas: { aspect: '9:16', width: 1080, height: 1920, fps: 30 },
      defaultAgent: 'codex',
    });
    expect(m.updateSettings).toHaveBeenCalledWith({ templatesDir: 'D:\\shared' });
    expect(m.rerender).toHaveBeenCalledWith('/w', { id: 'ws_1', name: 'Demo' });
    expect((await screen.findByRole('status')).textContent).toContain('3');
  });

  it('supports a custom size and clearing the default agent / templates folder', async () => {
    renderPage();
    const preset = (await screen.findByDisplayValue('16:9')) as HTMLSelectElement;
    fireEvent.change(preset, { target: { value: 'custom' } });
    const [w, h] = screen.getAllByRole('spinbutton');
    fireEvent.change(w, { target: { value: '800' } });
    fireEvent.change(h, { target: { value: '600' } });
    fireEvent.change(screen.getByLabelText(/기본 에이전트|Default agent/), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/사용자 가이드 템플릿 폴더|User guide template folder/), { target: { value: '' } });
    fireEvent.click(save());
    await waitFor(() => expect(m.updateWorkspace).toHaveBeenCalled());
    expect(m.updateWorkspace).toHaveBeenCalledWith('/w', { canvas: { aspect: 'custom', width: 800, height: 600, fps: 30 }, defaultAgent: undefined });
    expect(m.updateSettings).toHaveBeenCalledWith({ templatesDir: null });
  });

  it('blocks invalid input', async () => {
    renderPage();
    const input = await screen.findByLabelText(/사용자 가이드 템플릿 폴더|User guide template folder/);
    fireEvent.change(input, { target: { value: 'relative/path' } });
    expect(save().disabled).toBe(true);
    fireEvent.change(input, { target: { value: '' } });
    expect(save().disabled).toBe(false);
    fireEvent.change(screen.getAllByRole('spinbutton')[2], { target: { value: '0' } });
    expect(save().disabled).toBe(true);
  });

  it('shows the error when saving fails', async () => {
    m.updateWorkspace.mockRejectedValue(new Error('read-only disk'));
    renderPage();
    await screen.findByDisplayValue('16:9');
    fireEvent.click(save());
    expect((await screen.findByRole('status')).textContent).toContain('read-only disk');
    expect(m.rerender).not.toHaveBeenCalled();
  });
});
