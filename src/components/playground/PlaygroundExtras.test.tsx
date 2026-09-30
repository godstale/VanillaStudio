import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { PlaygroundExtras } from './PlaygroundExtras';

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
  id: 'my-slides',
  name: 'My Slides',
  description: 'A minimal slide template.',
  outputTypes: ['slides'],
  license: 'CC-BY-4.0',
});
const PALETTE = JSON.stringify({
  version: 1,
  id: 'my-warm',
  name: 'My Warm',
  tags: [],
  scheme: 'light',
  colors: { canvas: '#FFFFFF', ink: '#111111', primary: '#1E2BFA', accent: '#F59E0B' },
  source: 'user',
});

const mocks = vi.hoisted(() => ({ files: new Map<string, string>() }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, string>) => {
    if (cmd === 'list_dir') {
      const dir = (args.path as string).replace(/\/$/, '');
      const entries = [...mocks.files.keys()]
        .filter((p) => p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes('/'))
        .map((p) => ({ name: p.slice(dir.length + 1), path: p, is_dir: false, size: 0 }));
      // Template folders may be outside the project; missing dirs throw.
      if (entries.length === 0 && ![ROOT, `${ROOT}/palettes`].includes(dir)) throw new Error('not found');
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
  convertFileSrc: (p: string) => `asset://${p}`,
}));

vi.mock('@/lib/context/WorkspaceContext', () => ({
  useSafeWorkspace: () => ({ workspaceRoot: ROOT }),
}));

describe('PlaygroundExtras', () => {
  beforeEach(() => {
    mocks.files.clear();
    mocks.files.set(`${ROOT}/DESIGN.md`, DESIGN);
    mocks.files.set('C:/tpls/my-slides/SKILL.md', '# Skill');
    mocks.files.set('C:/tpls/my-slides/template.json', MANIFEST);
    mocks.files.set('C:/tpls/my-slides/DESIGN.md', DESIGN);
  });

  it('validates a template folder', async () => {
    renderWithProviders(<PlaygroundExtras />);
    fireEvent.change(screen.getByPlaceholderText(/templates\/my-slides/), { target: { value: 'C:/tpls/my-slides' } });
    // The template section renders first; the second "검사" belongs to DESIGN.md import.
    fireEvent.click(screen.getAllByRole('button', { name: '검사' })[0]);
    expect(await screen.findByText('올바른 템플릿입니다: My Slides')).toBeTruthy();
  });

  it('rejects a template folder missing DESIGN.md', async () => {
    mocks.files.delete('C:/tpls/my-slides/DESIGN.md');
    renderWithProviders(<PlaygroundExtras />);
    fireEvent.change(screen.getByPlaceholderText(/templates\/my-slides/), { target: { value: 'C:/tpls/my-slides' } });
    fireEvent.click(screen.getAllByRole('button', { name: '검사' })[0]);
    expect(await screen.findByText(/템플릿이 올바르지 않습니다/)).toBeTruthy();
  });

  it('edits and saves frame.md with a starter', async () => {
    renderWithProviders(<PlaygroundExtras />);
    const editor = await screen.findByLabelText('frame.md (영상 모션 지침)');
    expect((editor as HTMLTextAreaElement).value).toContain('# Frame guide');
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(mocks.files.get(`${ROOT}/frame.md`) ?? '').toContain('# Frame guide'));
    expect(await screen.findByText('저장됨')).toBeTruthy();
  });

  it('exports DESIGN.md tokens and validates pasted input', async () => {
    renderWithProviders(<PlaygroundExtras />);
    expect(await screen.findByRole('button', { name: 'Tailwind 변수 저장' })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/DESIGN.md 원문을 붙여넣으세요/), { target: { value: DESIGN } });
    const validators = screen.getAllByRole('button', { name: '검사' });
    fireEvent.click(validators[validators.length - 1]);
    expect(await screen.findByText('가져올 수 있는 DESIGN.md입니다.')).toBeTruthy();
  });

  it('imports a user palette and saves one from DESIGN.md', async () => {
    renderWithProviders(<PlaygroundExtras />);
    fireEvent.change(screen.getByPlaceholderText(/palette.json 원문을 붙여넣으세요/), { target: { value: PALETTE } });
    fireEvent.click(screen.getByRole('button', { name: '가져오기' }));
    await waitFor(() => expect(mocks.files.get(`${ROOT}/palettes/my-warm.json`) ?? '').toContain('My Warm'));
    expect(await screen.findByText('가져왔습니다: My Warm')).toBeTruthy();
  });
});
