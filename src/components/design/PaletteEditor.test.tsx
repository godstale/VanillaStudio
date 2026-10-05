import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { PaletteEditor } from './PaletteEditor';

const ROOT = 'C:/proj';

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
    throw new Error(`unexpected command ${cmd}`);
  },
}));
vi.mock('@/lib/context/WorkspaceContext', () => ({
  useSafeWorkspace: () => ({ workspaceRoot: ROOT }),
}));

function roleHex(role: string): HTMLInputElement {
  return within(screen.getByTestId(`palette-role-${role}`)).getByLabelText(`${role} hex`) as HTMLInputElement;
}

describe('PaletteEditor', () => {
  beforeEach(() => {
    mocks.files.clear();
  });

  it('shows role rows and the contrast table for a built-in palette', () => {
    renderWithProviders(<PaletteEditor paletteId="paper-dawn" />);
    expect(roleHex('canvas').value).toBe('#FAF6EC');
    expect(screen.getByTestId('contrast-ink/canvas')).toBeTruthy();
  });

  it('commits hex edits and reflects them in the OKLCH panel', () => {
    renderWithProviders(<PaletteEditor paletteId="paper-dawn" />);
    const input = roleHex('primary');
    fireEvent.change(input, { target: { value: '#123456' } });
    fireEvent.blur(input);
    expect(roleHex('primary').value).toBe('#123456');
    expect(screen.getByText('#123456')).toBeTruthy();
  });

  it('keeps locked roles when derived roles are recomputed', () => {
    renderWithProviders(<PaletteEditor paletteId="paper-dawn" />);
    const beforeSecondary = roleHex('secondary').value;
    // Lock surface, then move a core role so derived roles shift.
    fireEvent.click(within(screen.getByTestId('palette-role-surface')).getByRole('button', { name: '잠금' }));
    const primary = roleHex('primary');
    fireEvent.change(primary, { target: { value: '#005500' } });
    fireEvent.blur(primary);
    const beforeSurface = roleHex('surface').value;
    fireEvent.click(screen.getByRole('button', { name: '파생 역할 다시 계산' }));
    expect(roleHex('surface').value).toBe(beforeSurface);
    expect(roleHex('secondary').value).not.toBe(beforeSecondary);
  });

  it('adjusts the picked role through OKLCH sliders', () => {
    renderWithProviders(<PaletteEditor paletteId="paper-dawn" />);
    fireEvent.click(within(screen.getByTestId('palette-role-primary')).getByText('primary'));
    const before = roleHex('primary').value;
    const lightness = screen.getByLabelText('primary 명도');
    fireEvent.change(lightness, { target: { value: '0.9' } });
    expect(roleHex('primary').value).not.toBe(before);
  });

  it('saves a project-local user palette with a checkpoint', async () => {
    renderWithProviders(<PaletteEditor paletteId="paper-dawn" />);
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.getByTestId('palette-save-state').textContent).toContain('저장됨'));
    const saved = mocks.files.get(`${ROOT}/palettes/paper-dawn.json`);
    expect(saved).toBeTruthy();
    const json = JSON.parse(saved ?? '{}') as { source: string; colors: Record<string, string> };
    expect(json.source).toBe('user');
    expect(json.colors.canvas).toBe('#FAF6EC');
  });

  it('reports an unknown palette id', () => {
    renderWithProviders(<PaletteEditor paletteId="no-such-palette" />);
    expect(screen.getByTestId('palette-editor').textContent).toContain('no-such-palette');
  });
});
