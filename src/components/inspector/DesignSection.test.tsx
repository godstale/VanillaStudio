import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';

const fs = new Map<string, string>();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, a: { path: string; contents?: string }) => {
    const rel = a.path.replace(/^\/w\//, '');
    if (cmd === 'read_text_file') {
      const v = fs.get(rel);
      if (v === undefined) throw new Error('missing');
      return v;
    }
    if (cmd === 'write_text_file') {
      fs.set(rel, a.contents ?? '');
      return;
    }
    if (cmd === 'list_dir') {
      const base = `${rel.replace(/\/$/, '')}/`;
      const names = [...fs.keys()].filter((k) => (rel === '' ? !k.includes('/') : k.startsWith(base) && !k.slice(base.length).includes('/')));
      if (rel !== '' && names.length === 0) throw new Error('no dir');
      return names.map((k) => ({ name: k.slice(rel === '' ? 0 : base.length), is_dir: false, size: 0 }));
    }
    throw new Error(`unexpected ${cmd}`);
  },
}));

import { DesignSection } from './DesignSection';
import { readMood } from '@/lib/design/mood';

const GOOD = `---
version: alpha
name: Demo
colors:
  canvas: "#FAF7F0"
  ink: "#1F2430"
  primary: "#E8A93B"
  accent: "#C8553D"
---

# Demo
Primary is #E8A93B.
`;

const LOW_CONTRAST = GOOD.replace('"#1F2430"', '"#F0EBDD"');

function renderSection() {
  return render(
    <LanguageProvider>
      <DesignSection root="/w" slug="intro" />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  fs.clear();
  fs.set('DESIGN.md', GOOD);
});

describe('DesignSection', () => {
  it('shows the workspace tokens and no contrast warning for a good design', async () => {
    renderSection();
    expect(await screen.findByTestId('design-section')).toBeTruthy();
    expect(screen.getByTestId('design-summary')).toBeTruthy();
    expect(screen.queryByTestId('contrast-warnings')).toBeNull();
  });

  it('warns about low contrast pairs', async () => {
    fs.set('DESIGN.md', LOW_CONTRAST);
    renderSection();
    const warnings = await screen.findByTestId('contrast-warnings');
    expect(within(warnings).getAllByRole('listitem').length).toBeGreaterThan(0);
  });

  it('tells the user when there is no DESIGN.md', async () => {
    fs.delete('DESIGN.md');
    renderSection();
    expect(await screen.findByText(/DESIGN\.md가 없습니다|has no DESIGN\.md/)).toBeTruthy();
  });

  it('applies a palette: only colors change, the file is written', async () => {
    renderSection();
    await screen.findByTestId('design-section');
    const apply = screen.getAllByRole('button', { name: /^적용$|^Apply$/ })[0];
    fireEvent.click(apply);
    await waitFor(() => expect(fs.get('DESIGN.md')).not.toBe(GOOD));
    const next = fs.get('DESIGN.md')!;
    expect(next).toContain('# Demo');
    expect(next).not.toContain('"#FAF7F0"');
    expect(await screen.findByText(/적용했습니다|Applied/)).toBeTruthy();
  });

  it('saves mood keywords into the marked section', async () => {
    renderSection();
    await screen.findByTestId('design-section');
    const input = screen.getByLabelText(/분위기 키워드|Mood keywords/);
    fireEvent.change(input, { target: { value: 'calm' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(readMood(fs.get('DESIGN.md')!)).toEqual(['calm']));
    expect(fs.get('DESIGN.md')!.startsWith(GOOD.trimEnd())).toBe(true);
  });

  it('creates the scene override once and never overwrites it', async () => {
    renderSection();
    await screen.findByTestId('design-section');
    fireEvent.click(screen.getByRole('button', { name: /오버라이드 파일 만들기|Create override file/ }));
    await waitFor(() => expect(fs.get('scenes/intro/DESIGN.md')).toContain('extends: ../../DESIGN.md'));
    expect(await screen.findByText(/오버라이드 파일이 있습니다|override file exists/)).toBeTruthy();
    fs.set('scenes/intro/DESIGN.md', 'user edited');
    renderSection();
    expect((await screen.findAllByText(/오버라이드 파일이 있습니다|override file exists/)).length).toBeGreaterThan(0);
    expect(fs.get('scenes/intro/DESIGN.md')).toBe('user edited');
  });
});
